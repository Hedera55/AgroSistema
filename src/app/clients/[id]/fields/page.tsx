'use client';

import { use, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useFarms, useLots } from '@/hooks/useLocations';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useInventory, useClientStock } from '@/hooks/useInventory';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Farm, Lot } from '@/types';
import DynamicMap from '@/components/DynamicMap';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { kml } from '@tmcw/togeojson';
import { ObservationsSection } from '@/components/ObservationsSection';
import { LotHistory } from '@/components/LotHistory';
import { db } from '@/services/db';
import { syncService } from '@/services/sync';

export default function FieldsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { farms, addFarm, updateFarm, deleteFarm, loading: farmsLoading } = useFarms(id);
    const { warehouses } = useWarehouses(id);
    const { products, addProduct } = useInventory();
    const { stock, updateStock } = useClientStock(id);

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
    const [lotCropSpecies, setLotCropSpecies] = useState('');
    const [lotYield, setLotYield] = useState('');
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [observedYield, setObservedYield] = useState('');


    // Unified Panel State (Observations, Crop Assignment, History)
    const [activePanel, setActivePanel] = useState<{
        type: 'observations' | 'crop_assign' | 'history';
        id: string; // The specific lot or farm ID
        farmId: string;
        lotId?: string;
        name: string;
        subtitle?: string;
    } | null>(null);

    const obsSectionRef = useRef<HTMLDivElement>(null);

    // Auto-close panel when parent context is deselected
    useEffect(() => {
        if (!activePanel) return;

        // If the farm associated with the panel is no longer selected, close it
        if (activePanel.farmId && activePanel.farmId !== selectedFarmId) {
            setActivePanel(null);
            return;
        }

        // If the lot associated with the panel is no longer selected, close it
        if (activePanel.lotId && activePanel.lotId !== selectedLotId) {
            setActivePanel(null);
            return;
        }
    }, [selectedFarmId, selectedLotId, activePanel]);

    const openPanel = (type: 'observations' | 'crop_assign' | 'history', id: string, farmId: string, lotId: string | undefined, name: string, subtitle?: string) => {
        // Toggle if already open with same type and ID
        if (activePanel?.type === type && activePanel?.id === id) {
            setActivePanel(null);
            return;
        }

        setActivePanel({ type, id, farmId, lotId, name, subtitle });
        // Smooth scroll to section
        setTimeout(() => {
            obsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

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
                status: 'EMPTY',
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }

        setLotName('');
        setLotHectares('');
        setShowLotForm(false);
    };

    const handleMarkHarvested = async (lot: Lot) => {
        if (!observedYield) return;
        const yieldVal = parseFloat(observedYield);

        try {
            // 1. Update Lot Status
            await updateLot({
                ...lot,
                status: 'HARVESTED',
                observedYield: yieldVal,
                lastUpdatedBy: displayName || 'Sistema'
            });

            // 2. Add to Stock in "Acopio de Granos"
            const harvestWarehouse = warehouses.find(h => h.name === 'Acopio de Granos' || h.name === 'Acopio de Cosechas');
            if (harvestWarehouse && lot.cropSpecies) {
                // Find or create product for this crop
                let product = products.find(p => p.name === lot.cropSpecies && p.clientId === id);
                if (!product) {
                    product = await addProduct({
                        clientId: id,
                        name: lot.cropSpecies,
                        brandName: 'PRODUCCIÓN PROPIA',
                        type: 'SEED',
                        unit: 'KG',
                        price: 0,
                    });
                }

                // Update Stock
                const existingStock = stock.find(s => s.productId === product!.id && s.warehouseId === harvestWarehouse.id);
                const currentQty = existingStock?.quantity || 0;

                await updateStock({
                    id: existingStock?.id,
                    clientId: id,
                    warehouseId: harvestWarehouse.id,
                    productId: product!.id,
                    quantity: currentQty + yieldVal,
                    lastUpdated: new Date().toISOString()
                });

                // Record Movement
                const farm = farms.find(f => f.id === lot.farmId);
                await db.put('movements', {
                    id: generateId(),
                    clientId: id,
                    warehouseId: harvestWarehouse.id,
                    productId: product!.id,
                    productName: product!.name,
                    type: 'HARVEST',
                    quantity: yieldVal,
                    unit: product!.unit,
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    referenceId: lot.id,
                    notes: `Cosecha de lote ${lot.name} (${farm?.name || 'Campo desconocido'})`,
                    createdBy: displayName || 'Sistema',
                    createdAt: new Date().toISOString(),
                    synced: false
                });

                syncService.pushChanges();
            }

            setIsHarvesting(false);
            setObservedYield('');
        } catch (error) {
            console.error('Error marking harvested:', error);
            alert('Error al registrar la cosecha.');
        }
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
                    kmlData: kmlText,
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
                    kmlData: kmlText,
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

    const handleRemoveFarmKml = async (farm: Farm) => {
        if (!confirm('¿Está seguro de eliminar el KML de este campo?')) return;

        try {
            await updateFarm({
                ...farm,
                boundary: undefined,
                kmlData: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
            alert('KML eliminado correctamente.');
        } catch (error) {
            console.error('Error removing KML:', error);
            alert('Error al eliminar el KML.');
        }
    };

    const handleRemoveLotKml = async (lot: Lot) => {
        if (!confirm('¿Está seguro de eliminar el KML de este lote?')) return;

        try {
            await updateLot({
                ...lot,
                boundary: undefined,
                kmlData: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
            alert('KML eliminado correctamente.');
        } catch (error) {
            console.error('Error removing KML:', error);
            alert('Error al eliminar el KML.');
        }
    };

    const handleClearCrop = async (lot: Lot) => {
        if (!confirm('¿Está seguro de limpiar los datos del cultivo de este lote?')) return;

        try {
            await updateLot({
                ...lot,
                status: 'EMPTY',
                cropSpecies: undefined,
                yield: undefined,
                observedYield: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
        } catch (error) {
            console.error('Error clearing crop:', error);
            alert('Error al limpiar el cultivo.');
        }
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

    const handleEditFarm = (farm: Farm) => {
        setNewFarmName(farm.name);
        setEditingFarmId(farm.id);
        setShowFarmForm(true);
        // Clear lot editing
        setEditingLotId(null);
        setShowLotForm(false);
    };

    const handleDeleteFarm = async (farmId: string) => {
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

    if (role === 'CONTRATISTA') {
        return (
            <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-4xl mb-4">🚫</div>
                <h2 className="text-xl font-bold text-slate-800">Acceso Denegado</h2>
                <p className="text-slate-500 mt-2">Los contratistas solo tienen acceso a la sección de órdenes asignadas.</p>
                <Link href={`/clients/${id}/orders`} className="inline-block mt-6 text-emerald-600 font-bold hover:underline font-mono">Ir a Mis Órdenes →</Link>
            </div>
        );
    }

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
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn relative">
                    <button
                        onClick={cancelEdit}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Cancelar edición"
                    >
                        ✕
                    </button>
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
                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
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
                                {farms.find(f => f.id === editingFarmId)?.boundary && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const farm = farms.find(f => f.id === editingFarmId);
                                            if (farm) handleRemoveFarmKml(farm);
                                        }}
                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                        title="Eliminar KML"
                                    >
                                        Eliminar KML
                                    </button>
                                )}
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
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-900 truncate">{farm.name}</h3>
                                        <div className="flex items-center gap-2 flex-shrink-0">
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
                                                        onClick={(e) => { e.stopPropagation(); handleEditFarm(farm); }}
                                                        className="p-1 px-2 text-xs font-semibold bg-white text-slate-500 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteFarm(farm.id); }}
                                                        className="p-1 px-2 text-xs font-semibold bg-white text-slate-500 rounded border border-slate-200 hover:border-red-300 hover:text-red-700 transition-colors"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {selectedFarmId === farm.id && (
                                        <div className="flex justify-end pt-2 border-t border-slate-200/50 animate-fadeIn">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPanel('observations', farm.id, farm.id, undefined, farm.name);
                                                }}
                                                className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'observations' && activePanel?.id === farm.id
                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                                    }`}
                                            >
                                                Observaciones
                                            </button>
                                        </div>
                                    )}
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
                                            <div className="flex gap-2">
                                                <Button type="submit" size="sm" className="!p-1 !h-8 !w-8 flex items-center justify-center rounded-full">➜</Button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowLotForm(false);
                                                        setEditingLotId(null);
                                                        setLotName('');
                                                        setLotHectares('');
                                                    }}
                                                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Cancelar"
                                                >
                                                    ✕
                                                </button>
                                            </div>
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
                                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
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
                                                {lots.find(l => l.id === editingLotId)?.boundary && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const lot = lots.find(l => l.id === editingLotId);
                                                            if (lot) handleRemoveLotKml(lot);
                                                        }}
                                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                                        title="Eliminar KML"
                                                    >
                                                        Eliminar KML
                                                    </button>
                                                )}
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
                                                <div key={lot.id}>
                                                    <div
                                                        className={`flex flex-col gap-3 p-3 rounded-xl border-2 transition-all group cursor-pointer ${selectedLotId === lot.id ? 'border-emerald-500 bg-slate-50' : 'bg-slate-50 border-slate-100'}`}
                                                        onClick={() => setSelectedLotId(selectedLotId === lot.id ? null : lot.id)}
                                                    >
                                                        {/* Line 1: Identity & Admin Actions */}
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <span className="font-bold text-slate-900 truncate">{lot.name}</span>
                                                                <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest flex-shrink-0">{lot.hectares} ha</span>
                                                            </div>

                                                            {!isReadOnly && (
                                                                <div className="flex gap-2 flex-shrink-0 mt-0.5">
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

                                                        {/* Selected View: 3-Line Layout */}
                                                        {selectedLotId === lot.id && (
                                                            <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50 animate-fadeIn">
                                                                {/* Line 2: Status & Action Buttons */}
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        {lot.status && (
                                                                            <span
                                                                                title={lot.status === 'SOWED' ? 'Sembrado' :
                                                                                    lot.status === 'HARVESTED' ? 'Cosechado' :
                                                                                        lot.status === 'NOT_SOWED' ? 'Asignado' : 'Vacío'}
                                                                                className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg border shadow-sm ${lot.status === 'SOWED' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                                                    lot.status === 'HARVESTED' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                                        lot.status === 'NOT_SOWED' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                                                            'bg-slate-100 text-slate-500 border-slate-200'
                                                                                    }`}
                                                                            >
                                                                                {lot.status === 'SOWED' ? 'S' :
                                                                                    lot.status === 'HARVESTED' ? 'C' :
                                                                                        lot.status === 'NOT_SOWED' ? 'A' : 'V'}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {!isReadOnly && (
                                                                        <div className="flex gap-2">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openPanel('observations', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                                                                }}
                                                                                className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'observations' && activePanel?.id === lot.id
                                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                                                                    }`}
                                                                            >
                                                                                Observaciones
                                                                            </button>
                                                                            {lot.status !== 'SOWED' && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openPanel('crop_assign', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                                                                    }}
                                                                                    className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'crop_assign' && activePanel?.id === lot.id
                                                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                                                                        }`}
                                                                                >
                                                                                    {lot.status === 'NOT_SOWED' ? 'Editar Cultivo' : 'Asignar Cultivo'}
                                                                                </button>
                                                                            )}
                                                                            {lot.status === 'SOWED' && !isHarvesting && (
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        setIsHarvesting(true);
                                                                                        setSelectedLotId(lot.id);
                                                                                    }}
                                                                                    className="text-xs font-bold bg-blue-50 text-blue-600 px-3 py-1.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm uppercase tracking-wider"
                                                                                >
                                                                                    marcar cosechado
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Line 3: Crop Info (Clean & Simple) */}
                                                                {lot.cropSpecies && lot.status !== 'EMPTY' && (
                                                                    <div className="text-[11px] font-bold text-slate-500 px-0.5 flex items-center gap-1.5 w-full">
                                                                        <span className="text-emerald-700 font-black uppercase tracking-widest">{lot.cropSpecies}</span>
                                                                        {lot.yield && lot.status !== 'HARVESTED' ? <span className="text-slate-400 font-medium tracking-tight">({lot.yield} kg/ha)</span> : ''}
                                                                        {lot.status === 'HARVESTED' && lot.observedYield ? (
                                                                            <span className="text-blue-600 ml-auto font-normal text-[10px] bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase tracking-widest mr-2">Rinde: {lot.observedYield} kg</span>
                                                                        ) : <div className="ml-auto"></div>}

                                                                        {lot.status === 'HARVESTED' && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleClearCrop(lot);
                                                                                }}
                                                                                className="text-slate-400 hover:text-red-500 transition-colors px-1"
                                                                                title="Limpiar cultivo (Resetear a Vacío)"
                                                                            >
                                                                                ✕
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isHarvesting && selectedLotId === lot.id && (
                                                        <div className="mt-2 p-3 bg-blue-50 rounded-xl border border-blue-100 flex gap-2 items-end animate-fadeIn" onClick={e => e.stopPropagation()}>
                                                            <div className="flex-1">
                                                                <Input
                                                                    label="Rinde Observado (kg tot.)"
                                                                    type="number"
                                                                    placeholder="ej. 3500"
                                                                    value={observedYield}
                                                                    onChange={e => setObservedYield(e.target.value)}
                                                                />
                                                            </div>
                                                            <Button size="sm" onClick={() => handleMarkHarvested(lot)}>Confirmar</Button>
                                                            <Button size="sm" variant="ghost" onClick={() => setIsHarvesting(false)}>✕</Button>
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

                    {/* Lot Actions Below List */}
                    {selectedLotId && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => {
                                    const lot = lots.find(l => l.id === selectedLotId);
                                    if (lot) {
                                        openPanel('history', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                    }
                                }}
                                className={`px-6 py-2.5 rounded-xl border-2 font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-md
                                    ${activePanel?.type === 'history'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xl scale-[1.02]'
                                        : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:text-slate-800 hover:shadow-lg hover:scale-[1.01]'
                                    }`}
                            >
                                Ver Historial del Lote
                            </button>
                        </div>
                    )}
                </div>
            </div>


            {/* Unified Floating Panel Section */}
            {
                activePanel && (
                    <div
                        ref={obsSectionRef}
                        className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg animate-fadeIn ring-1 ring-slate-100 scroll-mt-6"
                    >
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                <h2 className="text-lg font-bold text-slate-800 flex-shrink-0">
                                    {activePanel.type === 'observations' ? 'Observaciones' :
                                        activePanel.type === 'crop_assign' ? (lots.find(l => l.id === activePanel.id)?.status === 'NOT_SOWED' ? 'Editar Cultivo' : 'Asignar Cultivo') : 'Historial del Lote'}
                                </h2>
                                <div className="hidden md:block w-px h-5 bg-slate-300"></div>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                                        {activePanel.name}
                                    </span>
                                    {activePanel.subtitle && (
                                        <span className="text-xs text-slate-500 truncate">
                                            {activePanel.subtitle}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activePanel.type === 'crop_assign' && lots.find(l => l.id === activePanel.id)?.status === 'NOT_SOWED' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            const lot = lots.find(l => l.id === activePanel.id);
                                            if (lot) {
                                                await updateLot({
                                                    ...lot,
                                                    cropSpecies: '',
                                                    yield: 0,
                                                    status: 'EMPTY',
                                                    lastUpdatedBy: displayName || 'Sistema'
                                                });
                                                setActivePanel(null);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold uppercase tracking-widest mr-2"
                                    >
                                        Eliminar asignación
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest">
                                    ✕ Cerrar
                                </Button>
                            </div>
                        </div>
                        <div className="px-2 pb-2">
                            {activePanel.type === 'observations' && (
                                <ObservationsSection
                                    clientId={id}
                                    farmId={activePanel.farmId}
                                    lotId={activePanel.lotId}
                                />
                            )}
                            {activePanel.type === 'crop_assign' && (
                                <div className="p-6 bg-white animate-fadeIn">
                                    {(() => {
                                        const cp = activePanel;
                                        if (!cp || cp.type !== 'crop_assign') return null;
                                        const lot = lots.find(l => l.id === cp.id);
                                        if (!lot) return null;
                                        return (
                                            <form
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    const formData = new FormData(e.currentTarget);
                                                    const crop = formData.get('crop') as string;
                                                    const expectedYield = formData.get('yield') as string;

                                                    await updateLot({
                                                        ...lot,
                                                        cropSpecies: crop,
                                                        yield: parseFloat(expectedYield) || 0,
                                                        status: crop ? 'NOT_SOWED' : (lot.status === 'EMPTY' || !lot.status ? 'EMPTY' : lot.status),
                                                        lastUpdatedBy: displayName || 'Sistema'
                                                    });
                                                    setActivePanel(null);
                                                }}
                                                className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
                                            >
                                                <div className="md:col-span-1">
                                                    <Input
                                                        name="crop"
                                                        label="Especie / Cultivo"
                                                        placeholder="ej. Maíz"
                                                        defaultValue={lot.cropSpecies || ''}
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    <Input
                                                        name="yield"
                                                        label="Rinde Esperado (kg/ha)"
                                                        type="number"
                                                        placeholder="0"
                                                        defaultValue={lot.yield?.toString() || ''}
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    <Button type="submit" className="w-full">Guardar Asignación</Button>
                                                </div>
                                            </form>
                                        );
                                    })()}
                                </div>
                            )}
                            {activePanel.type === 'history' && (
                                <div className="p-6 bg-white max-h-[600px] overflow-y-auto">
                                    <LotHistory clientId={id} lotId={activePanel.id} />
                                </div>
                            )}
                        </div>
                    </div>
                )
            }
        </div >
    );
}
