'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/db';
import { Order, Lot } from '@/types';

interface LotHistoryProps {
    clientId: string;
    lotId: string;
}

export function LotHistory({ clientId, lotId }: LotHistoryProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadHistory() {
            setLoading(true);
            try {
                // 1. Fetch all orders for this lot
                const allOrders = await db.getAll('orders');
                const lotOrders = allOrders
                    .filter((o: Order) => o.lotId === lotId && (o.status === 'DONE' || o.status === 'CONFIRMED') && o.type !== 'HARVEST')
                    .map((o: Order) => ({
                        id: o.id,
                        date: o.date,
                        time: o.time,
                        type: o.type,
                        status: o.status,
                        description: o.plantingDensity ? 'Siembra' : 'Pulverización',
                        items: o.items,
                        author: o.createdBy || 'Sistema',
                        timestamp: new Date(`${o.date}T${o.time || '00:00'}`).getTime()
                    }));

                // 2. Fetch Harvest Movements
                const allMovements = await db.getAll('movements');
                const harvestMovements = allMovements
                    .filter((m: any) => m.referenceId === lotId && m.type === 'HARVEST')
                    .map((m: any) => ({
                        id: m.id,
                        date: m.date,
                        time: m.time,
                        type: 'HARVEST',
                        description: 'Cosecha',
                        observedYield: m.quantity,
                        crop: m.productName,
                        contractorName: m.contractorName,
                        harvestLaborCost: m.harvestLaborCost,
                        author: m.createdBy || 'Sistema',
                        timestamp: new Date(`${m.date}T${m.time || '00:00'}`).getTime()
                    }));

                const events = [...lotOrders, ...harvestMovements];

                // Sort by timestamp descending
                setHistory(events.sort((a, b) => b.timestamp - a.timestamp));
            } catch (error) {
                console.error('Error loading lot history:', error);
            } finally {
                setLoading(false);
            }
        }

        loadHistory();
    }, [lotId]);

    if (loading) return <div className="text-xs text-slate-400 p-4">Cargando historial...</div>;

    if (history.length === 0) {
        return (
            <div className="text-center py-8">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Sin Actividades</p>
                <p className="text-[10px] text-slate-300">Aparecerán aquí las tareas completadas.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 font-bold text-slate-700 w-24">Fecha</th>
                        <th className="px-4 py-3 font-bold text-slate-700 w-24">Tipo</th>
                        <th className="px-4 py-3 font-bold text-slate-700">Descripción</th>
                        <th className="px-4 py-3 font-bold text-slate-700 text-right">Rinde / Costo</th>
                        <th className="px-4 py-3 font-bold text-slate-700 w-10"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {history.map((event) => (
                        <tr key={event.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-4 py-3 align-top">
                                <div className="font-mono text-slate-600 font-bold">{new Date(event.timestamp).toLocaleDateString()}</div>
                                <div className="text-[10px] text-slate-400">{event.time}</div>
                            </td>
                            <td className="px-4 py-3 align-top">
                                <div className="flex flex-col gap-1 items-start">
                                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider
                                        ${event.type === 'SOWING' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                            event.type === 'HARVEST' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                'bg-slate-100 text-slate-500 border border-slate-200'}`}>
                                        {event.type === 'SOWING' ? 'Siembra' :
                                            event.type === 'HARVEST' ? 'Cosecha' : 'Aplic.'}
                                    </span>
                                    {event.status && (
                                        <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border
                                            ${event.status === 'CONFIRMED' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                                'bg-slate-50 text-slate-400 border-slate-100' // Realizado defaults to subtle
                                            }`}>
                                            {event.status === 'CONFIRMED' ? 'Asignado' : 'Realizado'}
                                        </span>
                                    )}
                                </div>
                            </td>
                            <td className="px-4 py-3 align-top">
                                {event.type === 'HARVEST' ? (
                                    <div>
                                        <div className="font-bold text-slate-800">Cosecha de {event.crop}</div>
                                        {event.contractorName && (
                                            <div className="text-xs text-slate-500 mt-0.5">Contratista: {event.contractorName}</div>
                                        )}
                                        <div className="text-[10px] text-slate-400 mt-1">
                                            Por: {event.author}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {event.items?.map((item: any, i: number) => (
                                            <div key={i} className="text-slate-600">
                                                <span className="font-semibold">{item.productName}</span>
                                                <span className="text-slate-400 text-xs ml-2">
                                                    ({item.plantingDensity ? `${item.plantingDensity} ${item.plantingDensityUnit}` : `${item.totalQuantity} ${item.unit}`})
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                                {event.type === 'HARVEST' ? (
                                    <div>
                                        <div className="font-mono font-bold text-blue-700">{event.observedYield?.toLocaleString()} kg</div>
                                        {event.harvestLaborCost && (
                                            <div className="text-xs font-mono text-slate-500 mt-0.5">
                                                Lab: ${event.harvestLaborCost.toLocaleString()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-slate-400 text-xs">-</div>
                                )}
                            </td>
                            <td className="px-4 py-3 align-top">
                                {/* Actions placeholder */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
