'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Warehouse } from '@/types';

interface WarehouseManagerProps {
    showWarehouses: boolean;
    setShowWarehouses: (val: boolean) => void;
    showWarehouseForm: boolean;
    setShowWarehouseForm: (val: boolean) => void;
    warehouses: Warehouse[];
    addWarehouse: (name: string) => Promise<void>;
    updateWarehouse: (w: Warehouse) => Promise<void>;
    deleteWarehouse: (id: string) => Promise<void>;
    activeWarehouseIds: string[];
    toggleWarehouseSelection: (id: string) => void;
    setAllWarehouses: (ids: string[]) => void;
    selectedInManagerId: string | null;
    setSelectedInManagerId: (id: string | null) => void;
    editingWarehouseId: string | null;
    setEditingWarehouseId: (id: string | null) => void;
    editName: string;
    setEditName: (val: string) => void;
    setSelectedStockIds: (ids: string[]) => void;
    setSellingStockId: (id: string | null) => void;
    setShowMovePanel: (val: boolean) => void;
    isReadOnly: boolean;
    warehouseContainerRef: React.RefObject<HTMLDivElement | null>;
    stock: any[]; // ClientStock[]
    defaultHarvestWarehouseId?: string;
    onSetDefaultWarehouse?: (id: string) => void;
}

export function WarehouseManager({
    showWarehouses,
    setShowWarehouses,
    showWarehouseForm,
    setShowWarehouseForm,
    warehouses,
    addWarehouse,
    updateWarehouse,
    deleteWarehouse,
    activeWarehouseIds,
    toggleWarehouseSelection,
    setAllWarehouses,
    selectedInManagerId,
    setSelectedInManagerId,
    editingWarehouseId,
    setEditingWarehouseId,
    editName,
    setEditName,
    setSelectedStockIds,
    setSellingStockId,
    setShowMovePanel,
    isReadOnly,
    warehouseContainerRef,
    stock,
    defaultHarvestWarehouseId,
    onSetDefaultWarehouse
}: WarehouseManagerProps) {
    const [showDefaultSelector, setShowDefaultSelector] = useState(false);
    if (!showWarehouses || isReadOnly) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-6">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">Galpones Disponibles</h3>
                    {!isReadOnly && (
                        <button
                            onClick={() => setShowDefaultSelector(!showDefaultSelector)}
                            className={`p-1 rounded-full transition-colors ${showDefaultSelector ? 'text-emerald-600 bg-emerald-50' : 'text-slate-300 hover:text-slate-600'}`}
                            title="Seleccionar galpón default de cosecha"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            setAllWarehouses(warehouses.map(w => w.id));
                        }}
                        className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest"
                    >
                        Seleccionar todos
                    </button>
                    <button
                        onClick={() => setShowWarehouseForm(!showWarehouseForm)}
                        className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest"
                    >
                        {showWarehouseForm ? 'Cancelar' : 'Agregar'}
                    </button>
                    <button
                        onClick={() => setShowWarehouses(false)}
                        className="text-slate-400 hover:text-slate-600 p-1"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>

            {showDefaultSelector && !isReadOnly && (
                <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200 animate-fadeIn">
                    <label className="block text-[10px] font-black uppercase text-slate-500 mb-2 tracking-widest">
                        Seleccionar galpón default de cosecha
                    </label>
                    <select
                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        value={defaultHarvestWarehouseId || ''}
                        onChange={(e) => {
                            if (onSetDefaultWarehouse) {
                                onSetDefaultWarehouse(e.target.value);
                                setShowDefaultSelector(false);
                            }
                        }}
                    >
                        <option value="">Seleccionar un galpón...</option>
                        {warehouses.map(w => (
                            <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                    </select>
                    <p className="mt-2 text-[10px] text-slate-400 italic">
                        Los remanentes de cosecha sin asignar se enviarán automáticamente a este galpón.
                    </p>
                </div>
            )}

            {showWarehouseForm && (
                <div className="flex items-center gap-2 mb-6 animate-fadeIn">
                    <div className="flex-1">
                        <Input
                            placeholder="Nombre del nuevo galpón..."
                            id="new-warehouse-name"
                            className="h-[38px] text-sm"
                            onKeyDown={async (e) => {
                                if (e.key === 'Enter') {
                                    const input = e.currentTarget as HTMLInputElement;
                                    if (input.value) {
                                        await addWarehouse(input.value);
                                        input.value = '';
                                    }
                                }
                            }}
                        />
                    </div>
                    <Button
                        onClick={async () => {
                            const input = document.getElementById('new-warehouse-name') as HTMLInputElement;
                            if (input.value) {
                                await addWarehouse(input.value);
                                input.value = '';
                            }
                        }}
                        size="sm"
                        className="h-[38px] px-6"
                    >
                        Agregar
                    </Button>
                </div>
            )}
            <div className="space-y-3" ref={warehouseContainerRef}>
                {warehouses.map(w => (
                    <div
                        key={w.id}
                        onClick={() => {
                            if (selectedInManagerId === w.id) {
                                toggleWarehouseSelection(w.id);
                                setSelectedStockIds([]);
                                setSellingStockId(null);
                                setShowMovePanel(false);
                            } else {
                                setSelectedInManagerId(w.id);
                            }
                        }}
                        className={`p-2 rounded-xl border transition-all cursor-pointer select-none ${activeWarehouseIds.includes(w.id) ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'} ${selectedInManagerId === w.id ? 'shadow-md border-emerald-300' : ''}`}
                    >
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3 flex-1">
                                <div className={`relative w-10 h-10 rounded-full flex items-center justify-center text-lg ${activeWarehouseIds.includes(w.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    📦
                                    {defaultHarvestWarehouseId === w.id && (
                                        <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 shadow-sm" title="Galpón default de cosecha">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    {editingWarehouseId === w.id ? (
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            <input
                                                autoFocus
                                                className="flex-1 text-sm border-2 border-emerald-500 rounded px-2 py-1 outline-none"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Enter' && editName) {
                                                        await updateWarehouse({ ...w, name: editName });
                                                        setEditingWarehouseId(null);
                                                    }
                                                }}
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (editName) {
                                                        await updateWarehouse({ ...w, name: editName });
                                                        setEditingWarehouseId(null);
                                                    }
                                                }}
                                                className="bg-emerald-600 text-white px-3 rounded font-bold text-xs"
                                            >
                                                Ok
                                            </button>
                                        </div>
                                    ) : (
                                        <span className={`font-bold block ${activeWarehouseIds.includes(w.id) ? 'text-emerald-900' : 'text-slate-700'}`}>{w.name}</span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-2 items-center">
                                {activeWarehouseIds.includes(w.id) && editingWarehouseId !== w.id && (
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-1 bg-emerald-100 rounded border border-emerald-200">Activo</span>
                                )}
                                {(selectedInManagerId === w.id || activeWarehouseIds.includes(w.id)) && (
                                    <div className="flex gap-2 animate-fadeIn" onClick={e => e.stopPropagation()}>
                                        {editingWarehouseId !== w.id && (
                                            <>
                                                {!activeWarehouseIds.includes(w.id) && (
                                                    <button
                                                        onClick={() => {
                                                            toggleWarehouseSelection(w.id);
                                                            setSelectedStockIds([]);
                                                            setSellingStockId(null);
                                                            setShowMovePanel(false);
                                                        }}
                                                        className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg shadow-sm transition-all"
                                                    >
                                                        Abrir
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setEditingWarehouseId(w.id);
                                                        setEditName(w.name);
                                                    }}
                                                    className="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => {
                                                if (editingWarehouseId === w.id) {
                                                    setEditingWarehouseId(null);
                                                } else {
                                                    if (confirm('¿Eliminar galpón?')) deleteWarehouse(w.id);
                                                }
                                            }}
                                            className="text-slate-400 hover:text-red-500 p-2"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
