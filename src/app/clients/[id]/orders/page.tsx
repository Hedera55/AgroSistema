'use client';

import { use, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
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
    const [dataLoading, setDataLoading] = useState(true);
    const scrollRef = useHorizontalScroll();
    const [client, setClient] = useState<Client | null>(null);
    const [ordersLimit, setOrdersLimit] = useState(16);

    // Load lots and client separately
    useEffect(() => {
        async function loadExtras() {
            const [allLots, clientData] = await Promise.all([
                db.getAll('lots'),
                db.get('clients', id)
            ]);
            setLots(allLots);
            setClient(clientData || null);
            setDataLoading(false);
        }
        loadExtras();
    }, [id]);

    const loading = ordersLoading || farmsLoading || dataLoading;

    // Enrich orders with Farm/Lot names
    const orders = useMemo(() => {
        if (loading) return [];
        let filtered = rawOrders.filter(o => o.type !== 'HARVEST');
        if (role === 'CONTRATISTA') {
            // Contractors only need to see their assigned orders (filtered above by type? No, wait)
            // If contractors NEED to see Harvest orders, we shouldn't filter them out globally here 
            // if the goal was "Orders of 'cosecha' should not appear in the órdenes table" for the client/admin.
            // But contractors *do* need to see them as per previous request.
            // So: 
            // If Client/Admin -> Exclude Harvest (filtered).
            // If Contractor -> Include Harvest (don't filter) BUT filter by applicatorId.

            // Re-evaluating:
            // The previous request was "Ensure Harvest Order visibility for Contractors".
            // The NEW request is "Orders of 'cosecha' should not appear in the órdenes table".
            // Usually "Orders Table" implies the Client's view.
            // Contractors have their own filtered view.

            // Let's filter HARVEST out for everyone *except* contractors? 
            // Or maybe the user implies the "Ordenes" page is for "Sowing/Application" planning.
            // Let's assume for now keeping Harvest visible for contractors is correct, 
            // but hiding it for everyone else.
        }

        // Actually, cleaner logic:
        // 1. Start with filtered by harvest exclusion (default preference)
        // 2. BUT if contractor, they MIGHT need it? 
        // Let's look at the logic.

        filtered = rawOrders;

        if (role === 'CONTRATISTA') {
            filtered = filtered.filter(o => o.applicatorId === profile?.id);
        } else {
            // For Admin/Client, hide HARVEST orders as requested
            filtered = filtered.filter(o => o.type !== 'HARVEST');
        }
        return filtered.map(o => ({
            ...o,
            farmName: farms.find(f => f.id === o.farmId)?.name || 'Unknown Farm',
            lotName: lots.find(l => l.id === o.lotId)?.name || 'Unknown Lot',
            hectares: lots.find(l => l.id === o.lotId)?.hectares || 0
        })); // The hook already sorts by date
    }, [rawOrders, farms, lots, loading, role, profile]);

    const { generateOrderPDF } = usePDF();

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const handleDownload = async (order: Order & { farmName: string; lotName: string }) => {
        if (client) {
            await generateOrderPDF(order, client);
        }
    };

    const handleToggleStatus = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        if (order.type === 'SOWING') {
            const blockingHarvest = rawOrders.filter(o => !o.deleted).find(o =>
                o.type === 'HARVEST' &&
                (o.status === 'DONE' || o.status === 'CONFIRMED') &&
                o.sowingOrderId === order.id
            );

            if (blockingHarvest) {
                alert('Ya ha sido cosechada, no se puede cancelar la siembra');
                return;
            }
        }

        const nextStatus = order.status === 'DONE' ? 'PENDING' : 'DONE';

        try {
            let finalPrice = order.servicePrice;
            if (nextStatus === 'DONE' && (!order.servicePrice || order.servicePrice === 0)) {
                const val = prompt('No se ha registrado el costo todavía. Ingrese el costo por hectárea ($/ha) o cancele para omitir el costo por ahora:', '');
                if (val !== null && val !== '') {
                    const price = parseFloat(val);
                    if (!isNaN(price)) {
                        finalPrice = price;
                    }
                }
            }

            const auditData = nextStatus === 'DONE' ? {
                appliedBy: displayName || 'Sistema',
                appliedAt: new Date().toISOString()
            } : {
                appliedBy: undefined,
                appliedAt: undefined
            };

            await updateOrderStatus(orderId, nextStatus, displayName || 'Sistema', auditData, finalPrice);

            // AUTO-UPDATE-LOT: If unapplying a Sowing order, revert lot to EMPTY
            if (nextStatus === 'PENDING' && order.type === 'SOWING') {
                const lot = lots.find(l => l.id === order.lotId);
                if (lot) {
                    await db.put('lots', {
                        ...lot,
                        status: 'EMPTY',
                        cropSpecies: '',     // Clear crop
                        yield: 0,            // Clear yield
                        observedYield: 0,    // Clear observed
                        updatedAt: new Date().toISOString()
                    });
                    // Refresh local state to reflect change immediately (optional but good)
                    setLots(prev => prev.map(l => l.id === lot.id ? { ...l, status: 'EMPTY', cropSpecies: '', yield: 0, observedYield: 0 } : l));
                }
            }
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

    const handleEditPrice = async (orderId: string, currentPrice?: number) => {
        const val = prompt('Ingrese el costo del servicio por hectárea ($/ha):', currentPrice?.toString() || '');
        if (val === null) return;
        const newPrice = parseFloat(val);
        if (isNaN(newPrice)) {
            alert('Por favor ingrese un número válido');
            return;
        }

        try {
            await updateOrderStatus(orderId, undefined, displayName || 'Sistema', undefined, newPrice);
        } catch (e) {
            alert('Error al actualizar el precio');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link
                        href={role === 'CONTRATISTA' ? '/clients' : `/clients/${id}`}
                        className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block"
                    >
                        {role === 'CONTRATISTA' ? '← Mis Clientes' : '← Volver al Dashboard'}
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Órdenes</h1>
                    <p className="text-slate-500 mt-1">Ver órdenes de pulverización y planillas de siembra.</p>
                </div>
                {!isReadOnly && role !== 'CONTRATISTA' && (
                    <Link href={`/clients/${id}/orders/new`}>
                        <Button>+ Nueva Orden</Button>
                    </Link>
                )}
            </div>

            <div
                ref={scrollRef}
                className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto"
            >
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Emisión</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Ubicación</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Monto Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Autor</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {orders.slice(0, ordersLimit).map(order => (
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
                                        {order.type === 'SOWING' ? (
                                            <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-bold uppercase">Siembra</span>
                                        ) : order.type === 'HARVEST' ? (
                                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold uppercase">Cosecha</span>
                                        ) : (
                                            <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold uppercase">Pulverización</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                        <button
                                            onClick={() => (!isReadOnly || role === 'CONTRATISTA') && handleToggleStatus(order.id)}
                                            className={`text-xs px-3 py-1.5 rounded-full font-bold transition-all ${(!isReadOnly || role === 'CONTRATISTA') ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
                                         ${order.status === 'DONE' ? 'bg-green-100 text-green-800' :
                                                    (order.status === 'PENDING' && isExpired(order.date)) ? 'bg-red-100 text-red-800' :
                                                        order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                            'bg-gray-100 text-gray-800'}`}
                                            title={isReadOnly ? '' : "Click para cambiar estado"}
                                        >
                                            {order.status === 'DONE' ? (order.type === 'HARVEST' ? 'COSECHADA' : 'APLICADA') :
                                                (order.status === 'PENDING' && isExpired(order.date)) ? 'FECHA PASADA' :
                                                    order.status === 'PENDING' ? 'PENDIENTE' :
                                                        order.status === 'CONFIRMED' ? 'PLANIFICADA' :
                                                            order.status}
                                        </button>
                                    </td>
                                    <td
                                        className="px-6 py-4 whitespace-nowrap text-right font-mono cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleEditPrice(order.id, order.servicePrice)}
                                    >
                                        {order.servicePrice && order.servicePrice > 0 ? (
                                            <div className="flex flex-col items-end">
                                                <span className="text-slate-900 font-bold text-sm">
                                                    ${(order.servicePrice * order.hectares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ) : order.status === 'DONE' ? (
                                            <span className="text-red-500 italic text-[10px] font-bold hover:underline">Falta el costo</span>
                                        ) : (
                                            <span className="text-slate-300">---</span>
                                        )}
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
                {(orders.length > ordersLimit || ordersLimit > 16) && (
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center flex justify-center gap-4">
                        {orders.length > ordersLimit && (
                            <button
                                onClick={() => setOrdersLimit(prev => prev + 10)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                            >
                                Cargar 10 más
                            </button>
                        )}
                        {ordersLimit > 16 && (
                            <button
                                onClick={() => setOrdersLimit(prev => Math.max(16, prev - 10))}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                            >
                                Cargar 10 menos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {!loading && (
                <div className="flex justify-end pt-2">
                    <Link href={`/clients/${id}/orders/history`}>
                        <button
                            className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                        >
                            Historial de Cambios
                        </button>
                    </Link>
                </div>
            )}
        </div>
    );
}
