'use client';

import { use, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Order, Farm, Lot, Client } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { useFarms } from '@/hooks/useLocations';
import { supabase } from '@/lib/supabase';
import { OrderDetailView } from '@/components/OrderDetailView';

export default function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();

    // Data Hooks
    const { orders: rawOrders, loading: ordersLoading, updateOrderStatus, deleteOrder } = useOrders(id);
    const { farms, loading: farmsLoading } = useFarms(id);

    // Local state for lots (since useLots is farm-specific)
    const [lots, setLots] = useState<Lot[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [contractors, setContractors] = useState<{ id: string, username: string }[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const scrollRef = useHorizontalScroll();
    const [client, setClient] = useState<Client | null>(null);
    const [ordersLimit, setOrdersLimit] = useState(16);
    const [priceModalOrder, setPriceModalOrder] = useState<Order | null>(null);
    const [tempPrice, setTempPrice] = useState('');
    const [tempInvestor, setTempInvestor] = useState('');
    const [isApplyingFromStatus, setIsApplyingFromStatus] = useState(false);
    const [selectedOrderDetailOrder, setSelectedOrderDetailOrder] = useState<Order | null>(null);
    const detailsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedOrderDetailOrder && detailsRef.current) {
            detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedOrderDetailOrder]);

    // Load lots and client separately
    useEffect(() => {
        async function loadExtras() {
            const [allLots, clientData, allWarehouses, profileData] = await Promise.all([
                db.getAll('lots'),
                db.get('clients', id),
                db.getAll('warehouses'),
                supabase.from('profiles').select('id, username').eq('role', 'CONTRATISTA')
            ]);
            setLots(allLots);
            setClient(clientData || null);
            setWarehouses(allWarehouses || []);
            if (profileData.data) setContractors(profileData.data);
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
            hectares: lots.find(l => l.id === o.lotId)?.hectares || 0,
            contractorName: o.contractorName || o.applicatorName || contractors.find(c => c.id === o.applicatorId)?.username
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

        if (nextStatus === 'DONE' && (!order.servicePrice || order.servicePrice === 0)) {
            setPriceModalOrder(order);
            setTempPrice('');
            setTempInvestor(order.investorName || '');
            setIsApplyingFromStatus(true);
            return;
        }

        try {
            const auditData = nextStatus === 'DONE' ? {
                appliedBy: displayName || 'Sistema',
                appliedAt: new Date().toISOString()
            } : {
                appliedBy: undefined,
                appliedAt: undefined
            };

            await updateOrderStatus(orderId, nextStatus, displayName || 'Sistema', auditData, order.servicePrice);

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

    const handleConfirmPriceAndPartner = async () => {
        if (!priceModalOrder) return;

        const price = parseFloat(tempPrice);
        if (isNaN(price)) {
            alert('Por favor ingrese un precio válido');
            return;
        }

        try {
            if (isApplyingFromStatus) {
                const auditData = {
                    appliedBy: displayName || 'Sistema',
                    appliedAt: new Date().toISOString()
                };
                // Capture investor name in the update
                const orderWithInvestor = { ...priceModalOrder, investorName: tempInvestor };
                await db.put('orders', { ...orderWithInvestor, status: 'DONE', servicePrice: price, ...auditData, updatedAt: new Date().toISOString(), synced: false });
                // We also need to call updateOrderStatus to trigger any hooks if they exist, 
                // but updateOrderStatus in useOrders currently only takes status, user, audit, price.
                // I'll update the hook or just manually update if the hook is simple.
                // Let's check updateOrderStatus implementation.
            } else {
                await db.put('orders', { ...priceModalOrder, servicePrice: price, investorName: tempInvestor, updatedAt: new Date().toISOString(), synced: false });
            }
            setPriceModalOrder(null);
            setIsApplyingFromStatus(false);
        } catch (e) {
            alert('Error al guardar');
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

    const handleEditPrice = (orderId: string, currentPrice?: number) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;
        setPriceModalOrder(order);
        setTempPrice(currentPrice?.toString() || '');
        setTempInvestor(order.investorName || '');
        setIsApplyingFromStatus(false);
    };

    const formatAppliedAt = (dateStr?: string) => {
        if (!dateStr) return null;
        if (dateStr === '---' || dateStr.length < 5) return dateStr;

        // If it's ISO format (contains T)
        if (dateStr.includes('T')) {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return dateStr;

            const d = date.getDate().toString().padStart(2, '0');
            const mo = (date.getMonth() + 1).toString().padStart(2, '0');
            const y = date.getFullYear();
            const h = date.getHours().toString().padStart(2, '0');
            const min = date.getMinutes().toString().padStart(2, '0');

            return (
                <div>
                    <div>{`${d}-${mo}-${y}`}</div>
                    <div className="text-xs text-slate-400 font-normal">{`${h}:${min} hs`}</div>
                </div>
            );
        }

        // If it's YYYY-MM-DD
        if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = dateStr.split('-');
            return (
                <div>
                    <div>{`${d}-${m}-${y}`}</div>
                </div>
            );
        }

        return dateStr;
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
                    <div
                        ref={scrollRef}
                        className="overflow-x-auto"
                    >
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Nro de orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Emisión</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha Aplicación</th>
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
                                    <tr
                                        key={order.id}
                                        className={`hover:bg-slate-50 border-b border-slate-100 transition-colors group cursor-pointer ${selectedOrderDetailOrder?.id === order.id ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''}`}
                                        onClick={() => setSelectedOrderDetailOrder(order)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                            {order.orderNumber || '---'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                                            <div>{order.date}</div>
                                            <div className="text-xs text-slate-400 font-normal">{order.time || '--:--'}</div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                                            {formatAppliedAt(order.appliedAt) || <span className="text-slate-300 font-normal">---</span>}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => (!isReadOnly || role === 'CONTRATISTA') && handleToggleStatus(order.id)}
                                                className={`text-xs px-2 py-1 rounded-full font-bold transition-all ${(!isReadOnly || role === 'CONTRATISTA') ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'}
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
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditPrice(order.id, order.servicePrice);
                                            }}
                                        >
                                            {order.servicePrice && order.servicePrice > 0 ? (
                                                <div className="flex flex-col items-end">
                                                    <span className="text-slate-900 font-bold text-sm">
                                                        USD {(order.servicePrice * order.hectares).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm" onClick={e => e.stopPropagation()}>
                                            <div className="flex justify-end gap-2">
                                                <div className="relative group/tooltip">
                                                    <button
                                                        onClick={() => handleDownload(order)}
                                                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors"
                                                    >
                                                        pdf
                                                    </button>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                        descargar pdf
                                                    </div>
                                                </div>

                                                <div className="relative group/tooltip">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrderDetailOrder(order);
                                                        }}
                                                        className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-black transition-colors bg-white border ${order.facturaImageUrl ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-50' : 'border-red-500 text-red-500 hover:bg-red-50'}`}
                                                    >
                                                        F
                                                    </button>
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                        {order.facturaImageUrl ? 'Factura Adjunta' : 'Falta Factura'}
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
                    </div>
                )}
                {(orders.length > ordersLimit || ordersLimit > 16) && (
                    <div className="flex bg-slate-50 border-t border-slate-100 divide-x divide-slate-200">
                        {orders.length > ordersLimit && (
                            <button
                                onClick={() => setOrdersLimit(prev => prev + 10)}
                                className="flex-1 py-4 hover:bg-slate-100 transition-colors flex items-center justify-center active:bg-slate-200"
                            >
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">Cargar 10 más</span>
                            </button>
                        )}
                        {ordersLimit > 16 && (
                            <button
                                onClick={() => setOrdersLimit(prev => Math.max(16, prev - 10))}
                                className="flex-1 py-4 hover:bg-slate-100 transition-colors flex items-center justify-center active:bg-slate-200"
                            >
                                <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ver menos</span>
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
            {/* Price & Partner Selection Modal */}
            {priceModalOrder && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-slideUp">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Registrar Costo de Servicio (USD)</h3>
                            <button onClick={() => setPriceModalOrder(null)} className="text-slate-400 hover:text-slate-600">✕</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-4">
                                <p className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Orden {priceModalOrder.orderNumber}</p>
                                <p className="text-sm text-emerald-700">{priceModalOrder.type === 'SOWING' ? 'Siembra' : 'Pulverización'} en {lots.find(l => l.id === priceModalOrder.lotId)?.name || 'Lote'}</p>
                            </div>

                            <Input
                                label="Costo por Hectárea (USD/ha)"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={tempPrice}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTempPrice(e.target.value)}
                                autoFocus
                            />

                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Pagado por:</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={tempInvestor}
                                    onChange={e => setTempInvestor(e.target.value)}
                                >
                                    <option value="">Seleccione un socio...</option>
                                    {client?.partners?.map((p: any) => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                    {(!client?.partners || client.partners.length === 0) && client?.investors?.map((inv: any) => (
                                        <option key={inv.name} value={inv.name}>{inv.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <Button variant="outline" onClick={() => setPriceModalOrder(null)}>Cancelar</Button>
                                <Button onClick={handleConfirmPriceAndPartner}>Confirmar</Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail View (Inline) */}
            <div ref={detailsRef} className="transition-all duration-500 ease-in-out">
                {selectedOrderDetailOrder && (
                    <OrderDetailView
                        order={selectedOrderDetailOrder}
                        onClose={() => setSelectedOrderDetailOrder(null)}
                        createdBy={selectedOrderDetailOrder.createdBy}
                        warehouses={warehouses}
                    />
                )}
            </div>
        </div>
    );
}
