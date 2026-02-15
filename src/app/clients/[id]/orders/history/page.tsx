'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { OrderActivity, Order, Farm, Lot, Client } from '@/types';
import { OrderDetailView } from '@/components/OrderDetailView';

export default function OrderHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [activities, setActivities] = useState<OrderActivity[]>([]);
    const [orders, setOrders] = useState<Record<string, Order>>({});
    const [farms, setFarms] = useState<Farm[]>([]);
    const [lots, setLots] = useState<Lot[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);
    const [activitiesLimit, setActivitiesLimit] = useState(20);
    const [selectedOrder, setSelectedOrder] = useState<(Order & { farmName?: string; lotName?: string; hectares?: number }) | null>(null);

    useEffect(() => {
        async function loadData() {
            const [allActivities, allOrders, allFarms, allLots, allWarehouses, allClients] = await Promise.all([
                db.getAll('order_activities'),
                db.getAll('orders'),
                db.getAll('farms'),
                db.getAll('lots'),
                db.getAll('warehouses'),
                db.getAll('clients')
            ]);

            const currentClient = allClients.find((c: Client) => c.id === clientId);
            setClient(currentClient || null);

            const clientActivities = allActivities
                .filter((a: OrderActivity) => a.clientId === clientId)
                .sort((a: OrderActivity, b: OrderActivity) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            const ordersMap = allOrders.reduce((acc: Record<string, Order>, order: Order) => {
                acc[order.id] = order;
                return acc;
            }, {} as Record<string, Order>);

            setActivities(clientActivities);
            setOrders(ordersMap);
            setFarms(allFarms);
            setLots(allLots);
            setWarehouses(allWarehouses);
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
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Historial de Cambios de Órdenes</h1>
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
                    <div
                        className="overflow-x-auto"
                        onWheel={(e) => {
                            if (e.deltaY !== 0) {
                                e.preventDefault();
                                e.currentTarget.scrollLeft += e.deltaY;
                            }
                        }}
                    >
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha de carga de dato</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nro de Orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Acción</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {activities.slice(0, activitiesLimit).map((a) => {
                                    const { date, time } = formatDate(a.timestamp);
                                    const order = orders[a.orderId];
                                    const displayNum = a.orderNumber || order?.orderNumber || '---';

                                    const handleRowClick = () => {
                                        if (!order) return;
                                        const farm = farms.find(f => f.id === order.farmId);
                                        const lot = lots.find(l => l.id === order.lotId);
                                        setSelectedOrder({
                                            ...order,
                                            farmName: farm?.name,
                                            lotName: lot?.name,
                                            hectares: lot?.hectares
                                        });
                                    };

                                    return (
                                        <tr
                                            key={a.id}
                                            className={`hover:bg-slate-50 transition-colors cursor-pointer ${selectedOrder?.id === a.orderId ? 'bg-emerald-50' : ''}`}
                                            onClick={handleRowClick}
                                        >
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
                {(activities.length > activitiesLimit || activitiesLimit > 20) && (
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center flex justify-center gap-4">
                        {activities.length > activitiesLimit && (
                            <button
                                onClick={() => setActivitiesLimit(prev => prev + 10)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                            >
                                Cargar 10 más
                            </button>
                        )}
                        {activitiesLimit > 20 && (
                            <button
                                onClick={() => setActivitiesLimit(prev => Math.max(20, prev - 10))}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                            >
                                Cargar 10 menos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selectedOrder && client && (
                <div className="mt-8 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-slideUp">
                    <OrderDetailView
                        order={selectedOrder}
                        client={client}
                        onClose={() => setSelectedOrder(null)}
                        warehouses={warehouses}
                    />
                </div>
            )}
        </div>
    );
}
