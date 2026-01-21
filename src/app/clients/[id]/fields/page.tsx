'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useFarms, useLots } from '@/hooks/useLocations';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Farm, Lot } from '@/types';
import DynamicMap from '@/components/DynamicMap';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { kml } from '@tmcw/togeojson';

export default function FieldsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { farms, addFarm, updateFarm, deleteFarm, loading: farmsLoading } = useFarms(id);

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showFarmForm, setShowFarmForm] = useState(false);
    const [newFarmName, setNewFarmName] = useState('');
    const [editingFarmId, setEditingFarmId] = useState<string | null>(null);

    // Selected Farm for adding lots
    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
    const [showLotForm, setShowLotForm] = useState(false);

    // Hoisted Lots State
    const { lots, addLot, updateLot, deleteLot, loading: lotsLoading } = useLots(selectedFarmId || '');
    const [editingLotId, setEditingLotId] = useState<string | null>(null);
    const [lotName, setLotName] = useState('');
    const [lotHectares, setLotHectares] = useState('');

    const handleAddLot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lotName || !lotHectares) return;
        if (!selectedFarmId) return;

        if (editingLotId) {
            // Update
            const lotToUpdate = lots.find(l => l.id === editingLotId);
            if (lotToUpdate) {
                await updateLot({
                    ...lotToUpdate,
                    name: lotName,
                    hectares: parseFloat(lotHectares),
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }
            setEditingLotId(null);
        } else {
            // Create
            await addLot({
                id: generateId(),
                farmId: selectedFarmId,
                name: lotName,
                hectares: parseFloat(lotHectares),
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }

        setLotName('');
        setLotHectares('');
        setShowLotForm(false);
    };

    const handleEditLot = (lot: Lot) => {
        setLotName(lot.name);
        setLotHectares(lot.hectares.toString());
        setEditingLotId(lot.id);
        setShowLotForm(true);
        // Clear farm editing
        setEditingFarmId(null);
        setShowFarmForm(false);
    };

    const handleDeleteLot = async (lotId: string) => {
        if (confirm('¿Está seguro de eliminar este lote?')) {
            await deleteLot(lotId);
        }
    };

    const handleKmlUpload = async (lot: Lot, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const kmlText = event.target?.result as string;
            try {
                const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
                const geojson = kml(dom);

                await updateLot({
                    ...lot,
                    boundary: geojson as any,
                    lastUpdatedBy: displayName || 'Sistema'
                });
                alert('KML cargado correctamente.');
            } catch (error) {
                console.error('Error parsing KML:', error);
                alert('Error al procesar el archivo KML. Asegúrese de que sea un archivo válido.');
            }
        };
        reader.readAsText(file);
    };

    const handleFarmKmlUpload = async (farm: Farm, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const kmlText = event.target?.result as string;
            try {
                const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
                const geojson = kml(dom);

                await updateFarm({
                    ...farm,
                    boundary: geojson as any,
                    lastUpdatedBy: displayName || 'Sistema'
                });
                alert('KML cargado correctamente.');
            } catch (error) {
                console.error('Error parsing KML:', error);
                alert('Error al procesar el archivo KML. Asegúrese de que sea un archivo válido.');
            }
        };
        reader.readAsText(file);
    };

    const handleAddFarm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFarmName) return;

        if (editingFarmId) {
            // Update
            const farmToUpdate = farms.find(f => f.id === editingFarmId);
            if (farmToUpdate) {
                await updateFarm({
                    ...farmToUpdate,
                    name: newFarmName,
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }
            setEditingFarmId(null);
        } else {
            // Create
            await addFarm({
                id: generateId(),
                clientId: id,
                name: newFarmName,
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }
        setNewFarmName('');
        setShowFarmForm(false);
    };

    const handleEditFarm = (farm: Farm, e: React.MouseEvent) => {
        e.stopPropagation();
        setNewFarmName(farm.name);
        setEditingFarmId(farm.id);
        setShowFarmForm(true);
        // Clear lot editing
        setEditingLotId(null);
        setShowLotForm(false);
    };

    const handleDeleteFarm = async (farmId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('¿Está seguro de eliminar este campo? Se eliminarán también sus lotes.')) {
            await deleteFarm(farmId);
            if (selectedFarmId === farmId) setSelectedFarmId(null);
        }
    };

    const cancelEdit = () => {
        setShowFarmForm(false);
        setEditingFarmId(null);
        setNewFarmName('');
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Campos y Lotes</h1>
                    <p className="text-slate-500 mt-1">Administre los campos y sus respectivos lotes.</p>
                </div>
                {!isReadOnly && (
                    <Button onClick={() => {
                        if (showFarmForm) cancelEdit();
                        else setShowFarmForm(true);
                    }}>
                        {showFarmForm ? 'Cancelar' : 'Agregar campo'}
                    </Button>
                )}
            </div>

            {showFarmForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingFarmId ? 'Editar Campo' : 'Nuevo Campo'}</h2>
                    <form onSubmit={handleAddFarm} className="space-y-4">
                        <div className="flex gap-4 items-end">
                            <Input
                                label="Nombre del Campo"
                                placeholder="ej. La Estelita"
                                value={newFarmName}
                                onChange={e => setNewFarmName(e.target.value)}
                                required
                            />
                            <Button type="submit">{editingFarmId ? '➜' : 'Guardar Campo'}</Button>
                        </div>

                        {editingFarmId && (
                            <div className="pt-2 border-t border-slate-200">
                                <label className="text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2 w-full">
                                    {farms.find(f => f.id === editingFarmId)?.boundary ? 'Cambiar KML' : 'Cargar KML'}
                                    <input
                                        type="file"
                                        accept=".kml"
                                        className="hidden"
                                        onChange={(e) => {
                                            const farm = farms.find(f => f.id === editingFarmId);
                                            if (farm) handleFarmKmlUpload(farm, e);
                                        }}
                                    />
                                </label>
                            </div>
                        )}
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800">Campos</h2>
                    {farmsLoading ? (
                        <div>Cargando campos...</div>
                    ) : farms.length === 0 ? (
                        <div className="p-8 bg-slate-50 rounded-lg text-center text-slate-500">No hay campos agregados todavía.</div>
                    ) : (
                        farms.map(farm => (
                            <div
                                key={farm.id}
                                className={`p-4 bg-white rounded-xl shadow-sm border cursor-pointer transition-all ${selectedFarmId === farm.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
                                onClick={() => {
                                    setSelectedFarmId(selectedFarmId === farm.id ? null : farm.id);
                                    setSelectedLotId(null);
                                    setEditingLotId(null);
                                    setShowLotForm(false);
                                }}
                            >
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-slate-900">{farm.name}</h3>
                                    <div className="flex items-center gap-2">
                                        {farm.boundary && (
                                            <Link
                                                href={`/clients/${id}/map?selected=${farm.id}`}
                                                onClick={(e) => e.stopPropagation()}
                                                className="p-1 px-2 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                            >
                                                Ver mapa
                                            </Link>
                                        )}
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    onClick={(e) => handleEditFarm(farm, e)}
                                                    className="p-1 px-2 text-xs font-semibold bg-slate-100 text-slate-500 rounded hover:bg-slate-200 hover:text-emerald-700 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteFarm(farm.id, e)}
                                                    className="p-1 px-2 text-xs font-semibold bg-slate-100 text-slate-500 rounded hover:bg-red-100 hover:text-red-700 transition-colors"
                                                >
                                                    Eliminar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">Lotes</h2>
                        {!isReadOnly && selectedFarmId && (
                            <Button size="sm" variant="secondary" onClick={() => {
                                // If we are already adding a new lot (form open, no editing ID), toggle off
                                if (showLotForm && !editingLotId) {
                                    setShowLotForm(false);
                                } else {
                                    // Otherwise reset to Add mode
                                    setEditingLotId(null);
                                    setLotName('');
                                    setLotHectares('');
                                    setShowLotForm(true);
                                }
                            }}>
                                {(showLotForm && !editingLotId) ? 'Cancelar' : 'Agregar Lote'}
                            </Button>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
                        {selectedFarmId ? (
                            <div className="space-y-6">
                                {showLotForm && (
                                    <form onSubmit={handleAddLot} className="space-y-4 bg-slate-50 p-4 rounded-lg animate-fadeIn relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-semibold text-slate-700">{editingLotId ? 'Editar Lote' : 'Nuevo Lote'}</span>
                                            <Button type="submit" size="sm" className="!p-1 !h-8 !w-8 flex items-center justify-center rounded-full">➜</Button>
                                        </div>
                                        <Input
                                            label="Nombre del Lote"
                                            placeholder="ej. Lote 3B"
                                            value={lotName}
                                            onChange={e => setLotName(e.target.value)}
                                            required
                                        />
                                        <Input
                                            label="Hectáreas"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={lotHectares}
                                            onChange={e => setLotHectares(e.target.value)}
                                            required
                                        />

                                        {editingLotId && (
                                            <div className="pt-2 border-t border-slate-200">
                                                <label className="text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2 w-full">
                                                    {lots.find(l => l.id === editingLotId)?.boundary ? 'Cambiar KML' : 'Cargar KML'}
                                                    <input
                                                        type="file"
                                                        accept=".kml"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const lot = lots.find(l => l.id === editingLotId);
                                                            if (lot) handleKmlUpload(lot, e);
                                                        }}
                                                    />
                                                </label>
                                            </div>
                                        )}
                                    </form>
                                )}

                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {lotsLoading ? (
                                        <div className="text-center text-sm text-slate-500">Cargando lotes...</div>
                                    ) : lots.length === 0 ? (
                                        <div className="text-center text-sm text-slate-500 py-4">No hay lotes para este campo.</div>
                                    ) : (
                                        lots
                                            .filter(lot => lot.id !== editingLotId)
                                            .map(lot => (
                                                <div
                                                    key={lot.id}
                                                    className={`flex justify-between items-center p-3 rounded-xl border-2 transition-all group cursor-pointer ${selectedLotId === lot.id ? 'border-emerald-500 bg-slate-50' : 'bg-slate-50 border-slate-100'}`}
                                                    onClick={() => setSelectedLotId(selectedLotId === lot.id ? null : lot.id)}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-medium text-slate-700">{lot.name}</span>
                                                        <span className="text-sm text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">{lot.hectares} ha</span>
                                                    </div>
                                                    {!isReadOnly && (
                                                        <div className="flex gap-2 transition-opacity">
                                                            <Link
                                                                href={`/clients/${id}/map?selected=${lot.id}`}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${lot.boundary
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                    : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed hidden'}`}
                                                            >
                                                                Ver mapa
                                                            </Link>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditLot(lot);
                                                                }}
                                                                className="text-xs font-semibold bg-white text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                                            >
                                                                Editar
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteLot(lot.id);
                                                                }}
                                                                className="text-xs font-semibold bg-white text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-red-300 hover:text-red-700 transition-colors"
                                                            >
                                                                Eliminar
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400">
                                <div className="text-4xl mb-2">🚜</div>
                                <p>Seleccione un Campo para gestionar lotes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
