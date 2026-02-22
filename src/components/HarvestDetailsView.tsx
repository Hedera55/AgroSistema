'use client';

import React from 'react';
import { InventoryMovement, Client, Warehouse } from '@/types';
import { Button } from '@/components/ui/Button';

interface HarvestDetailsViewProps {
    harvestMovement: InventoryMovement;
    harvestMovements: InventoryMovement[]; // The distributions
    client: Client;
    warehouses: Warehouse[];
    farms: any[];
    lots: any[];
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
    onClose,
    onEdit,
    onSelectMovement,
    isReadOnly = false
}) => {
    // Ingrained Name Resolution
    const lotId = harvestMovement.referenceId?.split('_')[0] || (harvestMovement as any).lotId;
    const lot = lots.find(l => l.id === lotId);
    const farm = farms.find(f => f.id === lot?.farmId || f.id === (harvestMovement as any).farmId);
    const resolvedFarmName = farm?.name || 'Desconocido';
    const resolvedLotName = lot?.name || 'S/N';

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp border-t-4 border-t-blue-500">
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                        Cosecha
                    </span>
                    <div className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200 shadow-sm flex items-center gap-1.5">
                        <span className="text-[10px] font-black uppercase tracking-wider">{resolvedFarmName} - {resolvedLotName}</span>
                    </div>
                </div>
                <div className="mt-1">
                    <h3 className="font-bold text-slate-800 text-lg">
                        Detalles
                    </h3>
                </div>
                <div className="flex gap-2">
                    {!isReadOnly && onEdit && (
                        <button
                            onClick={onEdit}
                            className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400"
                        >
                            ✏️
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-8 pt-8 pb-8">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha</label>
                        <p className="text-sm font-bold text-slate-700">
                            {harvestMovement.date ? new Date(harvestMovement.date).toLocaleDateString() : '-'}
                        </p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Rinde Obtenido</label>
                        <p className="text-sm font-bold text-blue-600">
                            {harvestMovement.quantity?.toLocaleString()} {harvestMovement.unit}
                        </p>
                    </div>
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

                <div className="pb-8">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-white text-slate-400 font-bold uppercase tracking-wider border-b border-slate-50">
                                <th className="px-8 py-3 text-left">Destino</th>
                                <th className="px-8 py-3 text-right">Cantidad</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {harvestMovements.length > 0 ? harvestMovements.map((m: any) => (
                                <tr
                                    key={m.id}
                                    className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                                    onClick={() => onSelectMovement?.(m)}
                                >
                                    <td className="px-8 py-4 font-bold text-slate-800">
                                        {m.receiverName || warehouses.find(w => w.id === m.warehouseId)?.name || 'Desconocido'}
                                    </td>
                                    <td className="px-8 py-4 text-right font-mono font-black text-blue-700 text-sm">
                                        {m.quantity.toLocaleString()} {m.unit}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={2} className="px-8 py-4 text-center text-slate-400 italic">
                                        No hay distribuciones registradas.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
