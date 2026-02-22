'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/services/db';
import { Order, Client, Warehouse } from '@/types';

interface LotHistoryProps {
    clientId: string;
    lotId: string;
    onSelectEvent?: (event: any) => void;
    onEditEvent?: (event: any) => void;
}

export function LotHistory({ clientId, lotId, onSelectEvent, onEditEvent }: LotHistoryProps) {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadHistory() {
            setLoading(true);
            try {
                // 1. Fetch all orders for this lot
                const allOrders = await db.getAll('orders');
                const lotOrders = allOrders
                    .filter((o: Order) => (o.lotId === lotId || o.lotIds?.includes(lotId)) && (o.status === 'DONE' || o.status === 'CONFIRMED') && o.type !== 'HARVEST')
                    .map((o: Order) => ({
                        id: o.id,
                        date: o.date,
                        time: o.time,
                        type: o.type,
                        status: o.status,
                        items: o.items,
                        serviceCost: (o.servicePrice || 0) * (o.treatedArea || 0),
                        author: o.createdBy || 'Sistema',
                        timestamp: new Date(`${o.date}T${o.time || '00:00'}`).getTime(),
                        rawOrder: o
                    }));

                // 2. Fetch Harvest Movements and group them
                const allMovements = await db.getAll('movements');
                const movementsForLot = allMovements.filter((m: any) => m.referenceId === lotId && m.type === 'HARVEST' && m.productName !== 'Labor de Cosecha');

                // Grouping by date and time
                const groups: Record<string, any> = {};
                movementsForLot.forEach((m: any) => {
                    const key = `${m.date}_${m.time || '00:00'}`;
                    if (!groups[key]) {
                        groups[key] = {
                            id: m.id, // Use first one's ID
                            date: m.date,
                            time: m.time,
                            type: 'HARVEST',
                            observedYield: 0,
                            crop: m.productName,
                            contractorName: m.contractorName,
                            author: m.createdBy || 'Sistema',
                            timestamp: new Date(`${m.date}T${m.time || '00:00'}`).getTime(),
                            movements: []
                        };
                    }
                    groups[key].observedYield += m.quantity;
                    groups[key].movements.push(m);
                });

                const harvestEvents = Object.values(groups);

                // Filter out harvest orders if they was already fetched via orders (type: 'HARVEST')
                // but keep those that are purely movements. We already filter o.type !== 'HARVEST' in the first step.

                const events = [...lotOrders, ...harvestEvents];

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
                        <th className="px-4 py-3 font-bold text-slate-700 text-right">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {history.map((event) => (
                        <tr
                            key={event.id}
                            className="hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => onSelectEvent?.(event)}
                        >
                            <td className="px-4 py-3 align-top">
                                <div className="font-mono text-slate-600 font-bold">
                                    {isNaN(event.timestamp) ? event.date : new Date(event.timestamp).toLocaleDateString()}
                                </div>
                                <div className="text-[10px] text-slate-400">{event.time}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-center">
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
                                                'bg-slate-50 text-slate-400 border-slate-100'
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
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        {event.items?.map((item: any, i: number) => (
                                            <div key={i} className="text-slate-600">
                                                <span className="font-semibold">{item.productName}</span>
                                                <span className="text-slate-400 text-xs ml-2">
                                                    ({item.plantingDensity ? `${item.plantingDensity} ${item.plantingDensityUnit === 'KG_HA' ? 'kg/ha' : 'pl/ha'}` : `${item.totalQuantity} ${item.unit}`})
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
                                    </div>
                                ) : (
                                    <div>
                                        {event.serviceCost > 0 ? (
                                            <div className="text-xs font-mono text-slate-500">
                                                Costo de Labor: ${event.serviceCost.toLocaleString()}
                                            </div>
                                        ) : (
                                            <div className="text-slate-400 text-xs">-</div>
                                        )}
                                    </div>
                                )}
                            </td>
                            <td className="px-4 py-3 align-top text-right">
                                <div className="flex items-center justify-end gap-2">
                                    {event.type === 'HARVEST' && onEditEvent && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditEvent(event);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                            title="Editar Cosecha"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                    )}
                                    <div className="text-slate-300 group-hover:text-emerald-500 transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
