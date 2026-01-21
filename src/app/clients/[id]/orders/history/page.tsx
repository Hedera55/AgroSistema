'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { OrderActivity, Order } from '@/types';

export default function OrderHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [activities, setActivities] = useState<OrderActivity[]>([]);
    const [orders, setOrders] = useState<Record<string, Order>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            const [allActivities, allOrders] = await Promise.all([
                db.getAll('order_activities'),
                db.getAll('orders')
            ]);

            const clientActivities = allActivities
                .filter((a: OrderActivity) => a.clientId === clientId)
                .sort((a: OrderActivity, b: OrderActivity) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const ordersMap = allOrders.reduce((acc: Record<string, Order>, order: Order) => {
                acc[order.id] = order;
                return acc;
            }, {} as Record<string, Order>);

            setActivities(clientActivities);
            setOrders(ordersMap);
            setLoading(false);
        }
        loadData();
    }, [clientId]);

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return {
            date: date.toLocaleDateString('es-AR'),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                .toLowerCase()
                .replace(' am', ' a.m.')
                .replace(' pm', ' p.m.')
        };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/clients/${clientId}/orders`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver a Órdenes</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Historial de Órdenes</h1>
                    <p className="text-slate-500 mt-1">Registro de cambios y creación de órdenes.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando historial...</div>
                ) : activities.length === 0 ? (
                    <div className="p-12 text-center">
                        <h3 className="text-lg font-medium text-slate-900">Sin actividad</h3>
                        <p className="text-slate-500">No hay registros de actividad todavía.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nro de Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acción</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {activities.map((a) => {
                                    const { date, time } = formatDate(a.timestamp);
                                    const order = orders[a.orderId];
                                    const displayNum = a.orderNumber || order?.orderNumber || '---';
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-slate-900 font-medium">{date}</div>
                                                <div className="text-xs text-slate-400">{time}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-slate-900 font-bold text-lg">
                                                    {displayNum}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 w-fit px-1.5 py-0.5 rounded ${a.action === 'CREATE' ? 'bg-blue-100 text-blue-700' :
                                                        a.action === 'STATUS_CHANGE' ? 'bg-purple-100 text-purple-700' :
                                                            'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {a.action === 'CREATE' ? 'Creación' :
                                                            a.action === 'STATUS_CHANGE' ? 'Cambio de Estado' : a.action}
                                                    </span>
                                                    <span className="text-slate-700">{a.description}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-medium">
                                                {a.userName}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
