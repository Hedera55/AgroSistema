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
                    .filter((o: Order) => o.lotId === lotId && o.status === 'DONE')
                    .map((o: Order) => ({
                        id: o.id,
                        date: o.date,
                        time: o.time,
                        type: o.type,
                        description: o.plantingDensity ? 'Siembra' : 'Pulverización',
                        items: o.items,
                        author: o.createdBy || 'Sistema',
                        timestamp: new Date(`${o.date}T${o.time || '00:00'}`).getTime()
                    }));

                // 2. Fetch lot data to check for harvest
                const lot = await db.get('lots', lotId);
                const events = [...lotOrders];

                if (lot?.status === 'HARVESTED' && lot.observedYield) {
                    events.push({
                        id: 'harvest-' + lot.id,
                        date: lot.updatedAt?.split('T')[0] || '',
                        time: lot.updatedAt?.split('T')[1]?.substring(0, 5) || '',
                        type: 'HARVEST',
                        description: 'Cosecha',
                        observedYield: lot.observedYield,
                        crop: lot.cropSpecies,
                        author: lot.lastUpdatedBy || 'Sistema',
                        timestamp: new Date(lot.updatedAt || 0).getTime()
                    });
                }

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
        <div className="relative">
            {/* Vertical Line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-100"></div>

            <div className="space-y-6 relative">
                {history.map((event, idx) => (
                    <div key={event.id} className="flex gap-4 pl-2">
                        <div className={`z-10 w-4 h-4 rounded-full mt-1.5 border-4 border-white shadow-sm
                            ${event.type === 'SOWING' ? 'bg-emerald-500' :
                                event.type === 'HARVEST' ? 'bg-blue-500' : 'bg-red-500'}`}>
                        </div>
                        <div className="flex-1 pb-4 border-b border-slate-50 last:border-0">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                                    {event.description}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">
                                    {event.date} {event.time && `| ${event.time}`}
                                </span>
                            </div>

                            {event.type === 'HARVEST' ? (
                                <div className="text-sm text-slate-600 bg-blue-50/50 p-2 rounded-lg border border-blue-50 mt-2">
                                    Cosecha de <span className="font-bold text-blue-700">{event.crop}</span>:
                                    <span className="font-black ml-1 text-slate-800">{event.observedYield.toLocaleString()} kg</span>
                                </div>
                            ) : (
                                <div className="mt-2 space-y-1">
                                    {event.items?.map((item: any, i: number) => (
                                        <div key={i} className="text-xs text-slate-500 flex justify-between">
                                            <span>• {item.productName}</span>
                                            <span className="font-mono text-[10px]">{item.totalQuantity} {item.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-2 text-[10px] text-slate-400 font-medium">
                                Por: <span className="text-slate-500">{event.author}</span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
