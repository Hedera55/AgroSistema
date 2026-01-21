'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Button } from '@/components/ui/Button';
import { Order, Farm, Lot, Client } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { useFarms } from '@/hooks/useLocations';

export default function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();

    // Data Hooks
    const { orders: rawOrders, loading: ordersLoading, updateOrderStatus, deleteOrder } = useOrders(id);
    const { farms, loading: farmsLoading } = useFarms(id);

    // Local state for lots (since useLots is farm-specific)
    const [lots, setLots] = useState<Lot[]>([]);
    const [lotsLoading, setLotsLoading] = useState(true);
    const [client, setClient] = useState<Client | null>(null);

    // Load lots and client separately
    useEffect(() => {
        async function loadExtras() {
            const [allLots, clientData] = await Promise.all([
                db.getAll('lots'),
                db.get('clients', id)
            ]);
            setLots(allLots);
            setClient(clientData || null);
            setLotsLoading(false);
        }
        loadExtras();
    }, [id]);

    const loading = ordersLoading || farmsLoading || lotsLoading;

    // Enrich orders with Farm/Lot names
    const orders = useMemo(() => {
        if (loading) return [];
        return rawOrders.map(o => ({
            ...o,
            farmName: farms.find(f => f.id === o.farmId)?.name || 'Unknown Farm',
            lotName: lots.find(l => l.id === o.lotId)?.name || 'Unknown Lot',
            hectares: lots.find(l => l.id === o.lotId)?.hectares || 0
        })); // The hook already sorts by date
    }, [rawOrders, farms, lots, loading]);

    const { generateOrderPDF } = usePDF();

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const handleDownload = (order: Order & { farmName: string; lotName: string }) => {
        if (client) {
            generateOrderPDF(order, client.name);
        }
    };

    const handleToggleStatus = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        const nextStatus = order.status === 'DONE' ? 'PENDING' : 'DONE';

        try {
            await updateOrderStatus(orderId, nextStatus, displayName || 'Sistema');
        } catch (e) {
            alert('Error al actualizar el estado');
        }
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (!confirm('¿Está seguro que desea eliminar esta orden?')) return;
        try {
            await deleteOrder(orderId, displayName || 'Sistema');
        } catch (e) {
            alert('Error al eliminar la orden');
        }
    };

    const isExpired = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const orderDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return orderDate < today;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes</h1>
                    <p className="text-slate-500 mt-1">Ver órdenes de pulverización y planillas de siembra.</p>
                </div>
                {!isReadOnly && (
                    <Link href={`/clients/${id}/orders/new`}>
                        <Button>+ Nueva Orden</Button>
                    </Link>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando órdenes...</div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <h3 className="text-lg font-medium text-slate-900">No se encontraron órdenes</h3>
                        <p className="text-slate-500">Cree la primera orden de aplicación para este cliente.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nro de orden</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ubicación</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Autor</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                        {order.orderNumber || '---'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                                        <div>{order.date}</div>
                                        <div className="text-xs text-slate-400 font-normal">{order.time || '--:--'}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                        <div className="font-medium text-slate-800">{order.lotName} ({order.hectares} ha)</div>
                                        <div className="text-xs text-slate-400">{order.farmName}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">PULVERIZACIÓN</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => !isReadOnly && handleToggleStatus(order.id)}
                                            className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${!isReadOnly ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
                                         ${order.status === 'DONE' ? 'bg-green-100 text-green-800' :
                                                    (order.status === 'PENDING' && isExpired(order.date)) ? 'bg-red-100 text-red-800' :
                                                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'}`}
                                            title={isReadOnly ? '' : "Click para cambiar estado"}
                                        >
                                            {order.status === 'DONE' ? 'APLICADA' :
                                                (order.status === 'PENDING' && isExpired(order.date)) ? 'FECHA PASADA' :
                                                    order.status === 'PENDING' ? 'PENDIENTE' : order.status}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm text-slate-600">
                                        {order.createdBy || 'Sistema'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                        <div className="flex justify-end gap-2">
                                            <div className="relative group/tooltip">
                                                <button
                                                    onClick={() => handleDownload(order)}
                                                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-colors"
                                                >
                                                    pdf
                                                </button>
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                    descargar pdf
                                                </div>
                                            </div>

                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className="bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                                                    title="Eliminar Orden"
                                                >
                                                    Elim.
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {!loading && (
                <div className="flex justify-end pt-2">
                    <Link href={`/clients/${id}/orders/history`}>
                        <button
                            className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                        >
                            Historial de Órdenes
                        </button>
                    </Link>
                </div>
            )}
        </div>
    );
}
