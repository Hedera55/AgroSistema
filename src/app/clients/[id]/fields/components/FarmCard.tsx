'use client';

import { Farm } from '@/types';
import Link from 'next/link';

interface FarmCardProps {
    clientId: string;
    farm: Farm;
    selectedFarmId: string | null;
    onSelect: (id: string) => void;
    isReadOnly: boolean;
    onEdit: (farm: Farm) => void;
    onDelete: (id: string) => void;
    onOpenPanel: (type: 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details', id: string, farmId: string, lotId: string | undefined, name: string, subtitle?: string) => void;
    activePanelType?: string;
    activePanelId?: string;
}

export function FarmCard({
    clientId,
    farm,
    selectedFarmId,
    onSelect,
    isReadOnly,
    onEdit,
    onDelete,
    onOpenPanel,
    activePanelType,
    activePanelId
}: FarmCardProps) {
    return (
        <div
            key={farm.id}
            className={`p-4 bg-white rounded-xl shadow-sm border cursor-pointer transition-all ${selectedFarmId === farm.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
            onClick={() => onSelect(farm.id)}
        >
            <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 truncate">{farm.name}</h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {farm.boundary && (
                            <Link
                                href={`/clients/${clientId}/map?selected=${farm.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 px-2 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                            >
                                Ver mapa
                            </Link>
                        )}
                        {!isReadOnly && (
                            <>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onEdit(farm); }}
                                    className="p-1 px-2 text-xs font-semibold bg-white text-slate-500 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                >
                                    Editar
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(farm.id); }}
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
                                onOpenPanel('observations', farm.id, farm.id, undefined, farm.name);
                            }}
                            className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanelType === 'observations' && activePanelId === farm.id
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
    );
}
