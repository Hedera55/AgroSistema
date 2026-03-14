'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Button } from '@/components/ui/Button';
import { Order, Farm, Lot, Client } from '@/types';
import { usePDF } from '@/hooks/usePDF';
import { useAuth } from '@/hooks/useAuth';
import { useAllOrders } from '@/hooks/useAllOrders';
import { OrderDetailView } from '@/components/OrderDetailView';
import { useSearchParams } from 'next/navigation';

export default function GlobalOrdersPage() {
    const { role, profile, displayName } = useAuth();
    const searchParams = useSearchParams();

    const formatDate = (dateStr?: string) => {
        if (!dateStr || typeof dateStr !== 'string') return dateStr || '---';
        if (dateStr.includes('-')) {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length === 3) {
                if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`;
                return dateStr;
            }
        }
        return dateStr;
    };
    const clientIdFilter = searchParams.get('clientId');

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
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [statusPopupOrder, setStatusPopupOrder] = useState<Order | null>(null);
    const [statusPopupDate, setStatusPopupDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const detailsRef = useRef<HTMLDivElement>(null);

    // Simplified: No automatic scrolling to details

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
        let filtered = rawOrders;
        if (clientIdFilter) {
            filtered = rawOrders.filter(o => o.clientId === clientIdFilter);
        }

        return filtered.map(o => {
            const client = clients.find(c => c.id === o.clientId);
            const farm = farms.find(f => f.id === o.farmId);
            const lot = lots.find(l => l.id === o.lotId);
            const totalHectares = o.lotIds?.reduce((acc, lid) => {
                const l = lots.find(lot => lot.id === lid);
                return acc + (l?.hectares || 0);
            }, 0) || lot?.hectares || 0;

            return {
                ...o,
                clientName: client?.name || 'Unknown Company',
                farmName: farm?.name || 'Unknown Farm',
                lotName: o.lotIds?.map(lid => lots.find(l => l.id === lid)?.name).join(', ') || lot?.name || 'Unknown Lot',
                totalHectares: totalHectares
            };
        });
    }, [rawOrders, clients, farms, lots, loading, clientIdFilter]);

    const selectedOrderDetailOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return orders.find(o => o.id === selectedOrderId) || null;
    }, [orders, selectedOrderId]);

    const handleDownload = async (order: Order & { clientName: string; farmName: string; lotName: string }) => {
        const client = clients.find(c => c.id === order.clientId);
        if (client) {
            await generateOrderPDF(order, client, lots);
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
            return (
                <div>{`${d}-${mo}-${y}`}</div>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Nro</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Cliente</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Emisión</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold text-emerald-600">Efectiva</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Ubicación</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Insumos</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Planeada</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Costo Labor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Pagado por</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Autor</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase font-bold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {orders.slice(0, ordersLimit).map(order => (
                                    <React.Fragment key={order.id}>
                                        <tr
                                            className={`hover:bg-slate-50 border-b border-slate-100 transition-colors group cursor-pointer ${selectedOrderId === order.id ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''}`}
                                            onClick={() => setSelectedOrderId(prev => prev === order.id ? null : order.id)}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                                {order.orderNumber || '---'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-emerald-600">
                                                {order.clientName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-medium">
                                                <div>{formatDate(order.date)}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-600 font-bold">
                                                {formatDate(order.appliedAt) || <span className="text-slate-300 font-normal">---</span>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                <div className="font-medium text-slate-800">
                                                    {order.lotName} (
                                                    {order.treatedArea && order.treatedArea < (order as any).totalHectares 
                                                        ? `${order.treatedArea}/${(order as any).totalHectares}` 
                                                        : order.treatedArea || (order as any).totalHectares} ha)
                                                </div>
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {order.items && order.items.length > 1 ? (
                                                    <span>MÚLTIPLES</span>
                                                ) : order.items && order.items.length === 1 ? (
                                                    <span>{order.items[0].productName}</span>
                                                ) : '---'}
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {order.isDateRange 
                                                    ? `${formatDate(order.applicationStart)} - ${formatDate(order.applicationEnd)}`
                                                    : formatDate(order.applicationDate) || '---'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center font-mono">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-slate-900 font-bold text-sm">
                                                        USD {((order.servicePrice || 0) * (order.treatedArea || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-bold uppercase tracking-tight text-[10px]">
                                                {order.investorName && !(order.investors && order.investors.length > 1) ? order.investorName : (order.investors && order.investors.length > 1 ? (
                                                    <span>MÚLTIPLES</span>
                                                ) : order.investors && order.investors.length === 1 ? (
                                                    <span>{order.investors[0].name}</span>
                                                ) : '---')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {order.createdBy || '---'}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm" onClick={e => e.stopPropagation()}>
                                                <div className="grid grid-cols-3 gap-1 w-fit ml-auto">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedOrderId(prev => prev === order.id ? null : order.id);
                                                        }}
                                                        className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center p-0"
                                                        title="Detalles"
                                                    >
                                                        i
                                                    </button>
                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={() => generateInsumosPDF(order as any, clients.find(c => c.id === order.clientId)!)}
                                                            className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center p-0"
                                                        >
                                                            N
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            Necesidad de Insumos
                                                        </div>
                                                    </div>
                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={() => handleDownload(order as any)}
                                                            className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center p-0"
                                                        >
                                                            O
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            Orden de Trabajo
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                        {selectedOrderId === order.id && (
                                            <>
                                                {/* Insumos Breakdown */}
                                                {order.items && order.items.length > 1 && (
                                                    <tr className="bg-emerald-50/40 text-[11px] border-b border-emerald-100/50">
                                                        <td colSpan={6} className="py-2 bg-emerald-50/40"></td>
                                                        <td colSpan={7} className="px-6 py-4 bg-emerald-50/40">
                                                            <div className="flex flex-col gap-1.5 border-l-2 border-emerald-500/40 pl-4">
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Desglose de Insumos</div>
                                                                {order.items.map((item, i) => (
                                                                    <div key={i} className="flex justify-between items-center text-slate-700 min-w-[200px]">
                                                                        <span className="font-bold">{item.productName}</span>
                                                                        <span className="font-mono text-emerald-600 font-bold ml-6 lowercase">{item.dosage} {item.unit}/ha</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Payors Breakdown */}
                                                {order.investors && order.investors.length > 1 && (
                                                    <tr className="bg-emerald-50/40 text-[11px] border-b border-emerald-100/50">
                                                        <td colSpan={10} className="py-2 bg-emerald-50/40"></td>
                                                        <td colSpan={3} className="px-6 py-4 bg-emerald-50/40">
                                                            <div className="flex flex-col gap-1.5 border-l-2 border-emerald-500/40 pl-4 max-w-[180px]">
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Desglose de Pago</div>
                                                                {order.investors.map((inv, i) => (
                                                                    <div key={i} className="flex justify-between items-center text-slate-700">
                                                                        <span className="font-bold">{inv.name}</span>
                                                                        <span className="font-mono text-emerald-600 font-bold ml-6">{inv.percentage}%</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </>
                                        )}
                                    </React.Fragment>
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
                            <h3 className="text-xl font-black text-slate-800 tracking-tight">Confirmar {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</h3>
                            <p className="text-sm text-slate-500 font-medium leading-relaxed">
                                Seleccione la fecha real en la que se realizó la {statusPopupOrder.type === 'SOWING' ? 'siembra' : 'aplicación'} para la orden <span className="text-emerald-600 font-bold">#{statusPopupOrder.orderNumber}</span>.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</label>
                            <input
                                type="date"
                                className="block w-full rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm shadow-sm"
                                value={statusPopupDate}
                                onChange={e => setStatusPopupDate(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="outline" onClick={() => setStatusPopupOrder(null)} className="flex-1">Cancelar</Button>
                            <Button onClick={handleConfirmStatus} className="flex-1 shadow-lg shadow-emerald-200">Confirmar {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Order Detail View */}
            <div ref={detailsRef}>
                {selectedOrderDetailOrder && (
                    <OrderDetailView
                        order={selectedOrderDetailOrder as any}
                        client={clients.find(c => c.id === (selectedOrderDetailOrder as any).clientId)!}
                        onClose={() => setSelectedOrderId(null)}
                        onEdit={(orderId, clientId) => {
                            window.location.href = `/clients/${clientId}/orders/new?editId=${orderId}`;
                        }}
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
