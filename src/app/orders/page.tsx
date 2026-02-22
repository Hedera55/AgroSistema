'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Button } from '@/components/ui/Button';
import { Order, Farm, Lot, Client } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { useAuth } from '@/hooks/useAuth';
import { useAllOrders } from '@/hooks/useAllOrders';
import { OrderDetailView } from '@/components/OrderDetailView';

export default function GlobalOrdersPage() {
    const { role, profile, displayName } = useAuth();

    // Data Hooks
    const { orders: rawOrders, loading: ordersLoading, refreshOrders } = useAllOrders();

    // Local state for context data
    const [clients, setClients] = useState<Client[]>([]);
    const [farms, setFarms] = useState<Farm[]>([]);
    const [lots, setLots] = useState<Lot[]>([]);
    const [warehouses, setWarehouses] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const scrollRef = useHorizontalScroll();
    const [ordersLimit, setOrdersLimit] = useState(16);
    const [selectedOrderDetailOrder, setSelectedOrderDetailOrder] = useState<Order | null>(null);
    const [statusPopupOrder, setStatusPopupOrder] = useState<Order | null>(null);
    const [statusPopupDate, setStatusPopupDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const detailsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (selectedOrderDetailOrder && detailsRef.current) {
            detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [selectedOrderDetailOrder]);

    const { generateOrderPDF, generateRemitoPDF, generateInsumosPDF } = usePDF();

    useEffect(() => {
        async function loadContext() {
            try {
                const [allClients, allFarms, allLots, allWarehouses, allCampaigns] = await Promise.all([
                    db.getAll('clients'),
                    db.getAll('farms'),
                    db.getAll('lots'),
                    db.getAll('warehouses'),
                    db.getAll('campaigns')
                ]);
                setClients(allClients);
                setFarms(allFarms);
                setLots(allLots);
                setWarehouses(allWarehouses);
                setCampaigns(allCampaigns);
            } catch (error) {
                console.error('Error loading global context:', error);
            } finally {
                setDataLoading(false);
            }
        }
        loadContext();
    }, []);

    const loading = ordersLoading || dataLoading;

    const orders = useMemo(() => {
        if (loading) return [];
        return rawOrders.map(o => {
            const client = clients.find(c => c.id === o.clientId);
            const farm = farms.find(f => f.id === o.farmId);
            const lot = lots.find(l => l.id === o.lotId);
            return {
                ...o,
                clientName: client?.name || 'Unknown Company',
                farmName: farm?.name || 'Unknown Farm',
                lotName: lot?.name || 'Unknown Lot',
                hectares: lot?.hectares || o.treatedArea || 0
            };
        });
    }, [rawOrders, clients, farms, lots, loading]);

    const handleDownload = async (order: Order & { clientName: string; farmName: string; lotName: string }) => {
        const client = clients.find(c => c.id === order.clientId);
        if (client) {
            await generateOrderPDF(order, client);
        }
    };

    const handleToggleStatus = async (orderId: string) => {
        const order = orders.find(o => o.id === orderId);
        if (!order) return;

        const nextStatus = order.status === 'DONE' ? 'PENDING' : 'DONE';

        if (nextStatus === 'DONE') {
            setStatusPopupOrder(order as any);
            setStatusPopupDate(new Date().toISOString().split('T')[0]);
            return;
        }

        try {
            const updatedOrder = {
                ...order,
                clientId: order.clientId, // Explicitly preserve
                status: nextStatus as any,
                appliedBy: undefined,
                appliedAt: undefined,
                updatedAt: new Date().toISOString(),
                updatedBy: displayName,
                synced: false
            };
            await db.put('orders', updatedOrder);
            await refreshOrders();
        } catch (e) {
            alert('Error al actualizar el estado');
        }
    };

    const handleConfirmStatus = async () => {
        if (!statusPopupOrder) return;

        try {
            const auditData = {
                appliedBy: displayName || 'Sistema',
                appliedAt: new Date(statusPopupDate + 'T12:00:00Z').toISOString()
            };

            await db.put('orders', {
                ...statusPopupOrder,
                clientId: statusPopupOrder.clientId, // Explicitly preserve
                status: 'DONE',
                ...auditData,
                updatedAt: new Date().toISOString(),
                updatedBy: displayName,
                synced: false
            });

            // Update lot if it's a sowing order
            if (statusPopupOrder.type === 'SOWING' && statusPopupOrder.lotId) {
                const lot = lots.find(l => l.id === statusPopupOrder.lotId);
                if (lot) {
                    const seedItem = statusPopupOrder.items?.find(i => i.productType === 'SEED');
                    const sowedCrop = seedItem?.productName || 'Desconocido';
                    await db.put('lots', {
                        ...lot,
                        cropSpecies: sowedCrop,
                        status: 'SOWED',
                        updatedAt: new Date().toISOString(),
                        synced: false
                    });
                }
            }

            setStatusPopupOrder(null);
            await refreshOrders();
        } catch (e) {
            alert('Error al actualizar el estado');
        }
    };

    const isExpired = (dateStr: string) => {
        const [year, month, day] = dateStr.split('-').map(Number);
        const orderDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return orderDate < today;
    };

    const formatAppliedAt = (dateStr?: string) => {
        if (!dateStr) return null;
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
        return dateStr;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mis Órdenes</h1>
                    <p className="text-slate-500 mt-1">Órdenes asignadas de todos los clientes.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando órdenes...</div>
                ) : orders.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-4xl mb-2">📄</div>
                        <h3 className="text-lg font-medium text-slate-900">No hay órdenes asignadas</h3>
                        <p className="text-slate-500">Aún no tiene órdenes de aplicación o siembra asignadas.</p>
                    </div>
                ) : (
                    <div ref={scrollRef} className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Nro</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Fecha Emisión</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Aplicada</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Ubicación</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Estado</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {orders.slice(0, ordersLimit).map(order => (
                                    <tr
                                        key={order.id}
                                        className={`hover:bg-slate-50 border-b border-slate-100 transition-colors group cursor-pointer ${selectedOrderDetailOrder?.id === order.id ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''}`}
                                        onClick={() => setSelectedOrderDetailOrder(order as any)}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                            {order.orderNumber || '---'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                                            {order.clientName}
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
                                                onClick={() => handleToggleStatus(order.id)}
                                                className={`text-xs px-2 py-1 rounded-full font-bold transition-all hover:scale-105 active:scale-95 cursor-pointer
                                         ${order.status === 'DONE' ? 'bg-green-100 text-green-800' :
                                                        (order.status === 'PENDING' && isExpired(order.date)) ? 'bg-red-100 text-red-800' :
                                                            order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                                                'bg-gray-100 text-gray-800'}`}
                                            >
                                                {order.status === 'DONE' ? (order.type === 'HARVEST' ? 'COSECHADA' : 'APLICADA') :
                                                    (order.status === 'PENDING' && isExpired(order.date)) ? 'FECHA PASADA' :
                                                        order.status === 'PENDING' ? 'PENDIENTE' :
                                                            order.status === 'CONFIRMED' ? 'PLANIFICADA' :
                                                                order.status}
                                            </button>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-right text-sm" onClick={e => e.stopPropagation()}>
                                            <div className="grid grid-cols-3 gap-1 w-fit ml-auto">
                                                <button
                                                    onClick={() => handleDownload(order as any)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                    title="Orden de Carga"
                                                >
                                                    O
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        const client = clients.find(c => c.id === order.clientId);
                                                        if (client) generateRemitoPDF(order as any, client);
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200"
                                                    title="Remito"
                                                >
                                                    R
                                                </button>
                                                <button
                                                    onClick={() => setSelectedOrderDetailOrder(order as any)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-400 hover:text-emerald-600"
                                                    title="Detalles"
                                                >
                                                    i
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Status Change Date Modal */}
            {statusPopupOrder && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full border border-slate-100 flex flex-col gap-6">
                        <div className="space-y-2">
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Confirmar Aplicación</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Seleccione la fecha real en la que se realizó la labor para la orden <span className="text-emerald-600 font-bold">#{statusPopupOrder.orderNumber}</span>.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de Aplicación</label>
                            <input
                                type="date"
                                className="block w-full rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm shadow-sm"
                                value={statusPopupDate}
                                onChange={e => setStatusPopupDate(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setStatusPopupOrder(null)} className="flex-1">Cancelar</Button>
                            <Button onClick={handleConfirmStatus} className="flex-1 shadow-lg shadow-emerald-200">Confirmar Aplicación</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail View */}
            <div ref={detailsRef}>
                {selectedOrderDetailOrder && (
                    <OrderDetailView
                        order={selectedOrderDetailOrder as any}
                        client={clients.find(c => c.id === selectedOrderDetailOrder.clientId)!}
                        onClose={() => setSelectedOrderDetailOrder(null)}
                        warehouses={warehouses.filter(w => w.clientId === selectedOrderDetailOrder.clientId)}
                        createdBy={displayName}
                        lots={lots.filter(l => farms.find(f => f.id === l.farmId)?.clientId === selectedOrderDetailOrder.clientId)}
                        campaigns={campaigns.filter(c => c.clientId === selectedOrderDetailOrder.clientId)}
                    />
                )}
            </div>
        </div>
    );
}
