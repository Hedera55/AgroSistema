'use client';

import { Lot, Order } from '@/types';
import Link from 'next/link';

interface LotCardProps {
    clientId: string;
    lot: Lot;
    selectedLotId: string | null;
    onSelect: (id: string | null) => void;
    isReadOnly: boolean;
    harvestPlanOrder: Order | undefined;
    onEdit: (lot: Lot) => void;
    onDelete: (id: string) => void;
    onOpenPanel: (type: 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details', id: string, farmId: string, lotId: string | undefined, name: string, subtitle?: string) => void;
    onIsHarvesting: (val: boolean) => void;
    onCancelHarvest: (lot: Lot) => void;
    onClearCrop: (lot: Lot) => void;
    fetchSowingDetails: (id: string) => void;
    fetchHarvestDetails: (id: string) => void;
}

export function LotCard({
    clientId,
    lot,
    selectedLotId,
    onSelect,
    isReadOnly,
    harvestPlanOrder,
    onEdit,
    onDelete,
    onOpenPanel,
    onIsHarvesting,
    onCancelHarvest,
    onClearCrop,
    fetchSowingDetails,
    fetchHarvestDetails,
    activePanel
}: LotCardProps & { activePanel: any }) {
    return (
        <div
            className={`flex flex-col gap-3 p-3 rounded-xl border-2 transition-all group cursor-pointer ${selectedLotId === lot.id ? 'border-emerald-500 bg-slate-50' : 'bg-slate-50 border-slate-100'}`}
            onClick={() => onSelect(selectedLotId === lot.id ? null : lot.id)}
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
                            href={`/clients/${clientId}/map?selected=${lot.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 px-2 text-[10px] font-bold bg-white text-slate-400 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors uppercase tracking-tight"
                        >
                            Ver plano
                        </Link>
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(lot); }}
                            className="p-1 px-2 text-[10px] font-bold bg-white text-slate-400 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-600 transition-colors uppercase tracking-tight"
                        >
                            Configurar
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(lot.id); }}
                            className="p-1 px-2 text-[10px] font-bold bg-white text-slate-400 rounded border border-slate-200 hover:border-red-300 hover:text-red-600 transition-colors uppercase tracking-tight"
                        >
                            Eliminar
                        </button>
                    </div>
                )}
            </div>

            {/* Line 2: Status Pill & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
                {/* Status Pill */}
                <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter border-2 ${lot.status === 'SOWED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    lot.status === 'HARVESTED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                        'bg-slate-100 text-slate-400 border-slate-200'
                    }`}>
                    {lot.status === 'EMPTY' ? 'CAMPO VACÍO' :
                        lot.status === 'SOWED' ? (lot.cropSpecies || 'SEMBRADO') :
                            lot.status === 'HARVESTED' ? `COSECHADO (${lot.cropSpecies})` :
                                lot.status}
                </span>

                {/* Primary Actions based on status */}
                <div className="flex gap-1.5 ml-auto">
                    {lot.status === 'EMPTY' && !isReadOnly && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onOpenPanel('crop_assign', lot.id, lot.farmId, lot.id, lot.name);
                            }}
                            className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm transition-all"
                        >
                            Asignar Cultivo
                        </button>
                    )}

                    {lot.status === 'SOWED' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fetchSowingDetails(lot.id);
                                    onOpenPanel('sowing_details', lot.id, lot.farmId, lot.id, lot.name, lot.cropSpecies);
                                }}
                                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 font-bold border-2 border-emerald-200 hover:bg-emerald-200 shadow-sm transition-all flex items-center gap-1.5"
                            >
                                🥗 Ver Siembra
                            </button>
                            {!isReadOnly && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        fetchSowingDetails(lot.id);
                                        onIsHarvesting(true);
                                    }}
                                    className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold border-2 shadow-sm transition-all flex items-center gap-1.5 ${harvestPlanOrder
                                        ? 'bg-amber-600 text-white border-amber-500 hover:bg-amber-700'
                                        : 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-700'
                                        }`}
                                >
                                    🚜 Cosechar
                                    {harvestPlanOrder && <span className="text-[8px] bg-white/20 px-1 rounded ml-0.5">PLANIFICADO</span>}
                                </button>
                            )}
                        </>
                    )}

                    {lot.status === 'HARVESTED' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    fetchHarvestDetails(lot.id);
                                    onOpenPanel('harvest_details', lot.id, lot.farmId, lot.id, lot.name, lot.cropSpecies);
                                }}
                                className="text-[10px] px-2.5 py-1.5 rounded-lg bg-slate-700 text-white font-bold border-2 border-slate-600 hover:bg-slate-800 shadow-sm transition-all flex items-center gap-1.5"
                            >
                                📊 Resumen Cosecha
                            </button>
                            {!isReadOnly && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onCancelHarvest(lot); }}
                                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white text-red-600 font-bold border-2 border-red-50 hover:bg-red-50 shadow-sm transition-all flex items-center gap-1.5"
                                        title="Cancelar cosecha"
                                    >
                                        ↺
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onClearCrop(lot); }}
                                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-white text-slate-400 font-bold border-2 border-slate-100 hover:bg-slate-100 shadow-sm transition-all flex items-center gap-1.5"
                                        title="Limpiar ciclo"
                                    >
                                        🧹
                                    </button>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Line 3: Footer actions (Visible when selected) */}
            {selectedLotId === lot.id && (
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-200/50 animate-fadeIn">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenPanel('history', lot.id, lot.farmId, lot.id, lot.name);
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'history' && activePanel?.id === lot.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                            }`}
                    >
                        Historial
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenPanel('observations', lot.id, lot.farmId, lot.id, lot.name);
                        }}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'observations' && activePanel?.id === lot.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                            }`}
                    >
                        Observaciones
                    </button>
                </div>
            )}
        </div>
    );
}
