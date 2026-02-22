'use client';

import React from 'react';
import { InventoryMovement, Client, Warehouse } from '@/types';
import { Button } from '@/components/ui/Button';

interface HarvestDetailsViewProps {
    harvestMovement: InventoryMovement;
    harvestMovements: InventoryMovement[]; // The distributions
    client: Client;
    warehouses: any[];
    farms: any[];
    lots: any[];
    campaigns?: any[];
    onClose: () => void;
    onEdit?: () => void;
    onSelectMovement?: (movement: InventoryMovement) => void;
    isReadOnly?: boolean;
}

export const HarvestDetailsView: React.FC<HarvestDetailsViewProps> = ({
    harvestMovement,
    harvestMovements,
    client,
    warehouses,
    farms,
    lots,
    campaigns,
    onClose,
    onEdit,
    onSelectMovement,
    isReadOnly = false
}) => {
    // Smart name resolution
    const lotId = harvestMovement.referenceId?.split('_')[0];
    const resolvedLot = lots.find(l => l.id === lotId);
    const resolvedFarm = farms.find(f => f.id === resolvedLot?.farmId || (harvestMovement as any).farmId);

    const farmName = resolvedFarm?.name || (harvestMovement as any).farmName;
    const lotName = resolvedLot?.name || (harvestMovement as any).lotName;
    const campaignName = campaigns?.find(c => c.id === harvestMovement.campaignId)?.name || harvestMovement.campaignId || '-';

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp border-t-4 border-t-blue-500">
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                    <h3 className="font-bold text-slate-800 text-lg flex-shrink-0">
                        Detalles
                    </h3>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-700 flex-shrink-0">
                        Cosecha
                    </span>
                    {farmName && lotName && (
                        <div className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-100 flex items-center gap-1.5 min-w-0 transition-all">
                            <span className="text-[10px] font-black uppercase tracking-widest truncate">{farmName} - {lotName}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar Cosecha"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8 px-8 pt-8 pb-10">
                    {/* Row 1 */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha de cosecha</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.date ? new Date(harvestMovement.date).toLocaleDateString() : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Campaña</label>
                        <p className="text-sm font-bold text-slate-700">{campaignName}</p>
                    </div>
                    <div className="hidden lg:block"></div>

                    {/* Row 2 */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Cultivo - Nombre Comercial</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.productName}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Rinde total</label>
                        <p className="text-sm font-bold text-blue-600">
                            {harvestMovement.quantity?.toLocaleString()} {harvestMovement.unit}
                        </p>
                    </div>
                    <div className="hidden lg:block"></div>

                    {/* Row 3 */}
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Contratista</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.contractorName || '-'}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Costo Labor Total</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.harvestLaborCost ? `USD ${harvestMovement.harvestLaborCost.toLocaleString()}` : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Pagado por</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.investorName || '-'}
                        </p>
                    </div>
                </div>

                <div className="px-8 pb-12">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Distribución de Cosecha</h3>
                    <div className="space-y-8">
                        {harvestMovements.length > 0 ? harvestMovements.map((m: any) => (
                            <div
                                key={m.id}
                                className="grid grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-8 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => onSelectMovement?.(m)}
                            >
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Destino</label>
                                    <p className="text-sm font-bold text-slate-700">
                                        {m.receiverName || warehouses.find(w => w.id === m.warehouseId)?.name || 'Desconocido'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cantidad</label>
                                    <p className="text-sm font-bold text-blue-600">
                                        {m.quantity.toLocaleString()} {m.unit}
                                    </p>
                                </div>
                                <div className="hidden lg:flex items-center justify-end text-slate-300">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                </div>
                            </div>
                        )) : (
                            <div className="text-slate-400 italic text-xs">
                                No hay distribuciones registradas.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
