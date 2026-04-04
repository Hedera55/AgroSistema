'use client';

import React, { use, useEffect, useState, useMemo, useRef } from 'react';
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
import { useCampaigns } from '@/hooks/useCampaigns';
import { supabase } from '@/lib/supabase';
import { OrderDetailView } from '@/components/OrderDetailView';
import { OrderWizard } from './components/OrderWizard';


export default function OrdersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();

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

    // Data Hooks
    const { orders: rawOrders, loading: ordersLoading, updateOrderStatus, deleteOrder } = useOrders(id);
    const { farms, loading: farmsLoading } = useFarms(id);
    const { campaigns, loading: campaignsLoading } = useCampaigns(id);

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
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const detailsRef = useRef<HTMLDivElement>(null);
    const wizardRef = useRef<HTMLDivElement>(null);
    const [isCreatingOrder, setIsCreatingOrder] = useState(false);
    const [editingOrderId, setEditingOrderId] = useState<string | null>(null);


    // Simplified: No automatic scrolling to details

    useEffect(() => {
        if ((isCreatingOrder || editingOrderId) && wizardRef.current) {
            wizardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, [isCreatingOrder, editingOrderId]);


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

    const loading = ordersLoading || farmsLoading || campaignsLoading || dataLoading;

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
        return filtered.map(o => {
            const farm = farms.find(f => f.id === o.farmId);
            const lot = lots.find(l => l.id === o.lotId);
            const totalHectares = o.lotIds?.reduce((acc, lid) => {
                const l = lots.find(lot => lot.id === lid);
                return acc + (l?.hectares || 0);
            }, 0) || lot?.hectares || 0;

            return {
                ...o,
                farmName: farm?.name || 'Unknown Farm',
                lotName: o.lotIds?.map(lid => lots.find(l => l.id === lid)?.name).join(', ') || lot?.name || 'Unknown Lot',
                totalHectares: totalHectares,
                contractorName: o.contractorName || o.applicatorName || contractors.find(c => c.id === o.applicatorId)?.username,
                campaignName: campaigns.find(c => c.id === o.campaignId)?.name
            };
        }); // The hook already sorts by date
    }, [rawOrders, farms, lots, loading, role, profile]);

    const selectedOrderDetailOrder = useMemo(() => {
        if (!selectedOrderId) return null;
        return orders.find(o => o.id === selectedOrderId) || null;
    }, [orders, selectedOrderId]);

    const { generateOrderPDF, generateRemitoPDF, generateInsumosPDF } = usePDF();
    const [statusPopupOrder, setStatusPopupOrder] = useState<Order | null>(null);
    const [statusPopupDate, setStatusPopupDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [dateSegments, setDateSegments] = useState({ day: '', month: '', year: '' });

    const dayRef = useRef<HTMLInputElement>(null);
    const monthRef = useRef<HTMLInputElement>(null);
    const yearRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (statusPopupOrder && statusPopupDate) {
            const [y, m, d] = statusPopupDate.split('-');
            setDateSegments({ day: d, month: m, year: y });
        }
    }, [statusPopupOrder, statusPopupDate]);

    const handleSegmentChange = (segment: 'day' | 'month' | 'year', value: string) => {
        const cleanValue = value.replace(/\D/g, '');
        let nextSegments = { ...dateSegments, [segment]: cleanValue };

        if (segment === 'day' && cleanValue.length === 2) {
            monthRef.current?.focus();
        } else if (segment === 'month' && cleanValue.length === 2) {
            yearRef.current?.focus();
        }

        setDateSegments(nextSegments);

        // Update the main date state if all segments have values
        if (nextSegments.day.length === 2 && nextSegments.month.length === 2 && nextSegments.year.length === 4) {
            setStatusPopupDate(`${nextSegments.year}-${nextSegments.month}-${nextSegments.day}`);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, segment: 'day' | 'month' | 'year') => {
        if (e.key === 'Backspace' && !dateSegments[segment]) {
            if (segment === 'month') dayRef.current?.focus();
            if (segment === 'year') monthRef.current?.focus();
        }
    };

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const handleDownload = async (order: Order & { farmName: string; lotName: string }) => {
        if (client) {
            await generateOrderPDF(order, client, lots);
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

        if (nextStatus === 'DONE') {
            setStatusPopupOrder(order);
            setStatusPopupDate(new Date().toISOString().split('T')[0]);
            return;
        }

        try {
            const auditData = {
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
                        cropSpecies: '',
                        yield: 0,
                        observedYield: 0,
                        updatedAt: new Date().toISOString()
                    });
                    setLots(prev => prev.map(l => l.id === lot.id ? { ...l, status: 'EMPTY', cropSpecies: '', yield: 0, observedYield: 0 } : l));
                }
            }
        } catch (e) {
            alert('Error al actualizar el estado');
        }
    };

    const handleConfirmStatus = async () => {
        if (!statusPopupOrder) return;

        // Force validation of segments
        const { day, month, year } = dateSegments;
        if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
            alert('Por favor ingrese una fecha válida (DD/MM/AAAA)');
            return;
        }

        const finalDate = `${year}-${month}-${day}`;

        try {
            const auditData = {
                appliedBy: displayName || 'Sistema',
                appliedAt: new Date(finalDate + 'T12:00:00Z').toISOString()
            };

            await updateOrderStatus(statusPopupOrder.id, 'DONE', displayName || 'Sistema', auditData, statusPopupOrder.servicePrice || 0);
            setStatusPopupOrder(null);
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
                    appliedAt: new Date(statusPopupDate + 'T12:00:00Z').toISOString()
                };
                const orderWithInvestor = { ...priceModalOrder, investorName: tempInvestor };
                await db.put('orders', { ...orderWithInvestor, clientId: id, status: 'DONE', servicePrice: price, ...auditData, updatedAt: new Date().toISOString(), synced: false });
                setIsApplyingFromStatus(false);
            } else {
                await db.put('orders', { ...priceModalOrder, clientId: id, servicePrice: price, investorName: tempInvestor, updatedAt: new Date().toISOString(), synced: false });
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

            return (
                <div>{`${d}-${mo}-${y}`}</div>
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
                    <Button onClick={() => {
                        setEditingOrderId(null);
                        setIsCreatingOrder(true);
                    }}>
                        + Nueva Orden
                    </Button>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Nro de orden</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Fecha Emisión</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold text-emerald-600">Fecha Efectiva</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Ubicación</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Tipo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Insumos</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Estado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Fecha Planeada</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap font-bold">Costo de labor</th>
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
                                                {(() => {
                                                    if (!order.items || order.items.length === 0) return '---';
                                                    if (order.items.length === 1) return <span>{order.items[0].productName}</span>;
                                                    
                                                    // Check if all items refer to the same product (by productId)
                                                    const firstId = order.items[0].productId;
                                                    const allSame = order.items.every(i => i.productId === firstId);
                                                    
                                                    if (allSame) {
                                                        return <span>{order.items[0].productName}</span>;
                                                    }
                                                    
                                                    return <span>MÚLTIPLES</span>;
                                                })()}
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
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {order.isDateRange ? (
                                                    `${order.applicationStart?.split('-').reverse().join('/')} al ${order.applicationEnd?.split('-').reverse().join('/')}`
                                                ) : (
                                                    order.applicationDate?.split('-').reverse().join('/') || '---'
                                                )}
                                            </td>
                                            <td
                                                className="px-6 py-4 whitespace-nowrap text-center font-mono cursor-pointer hover:bg-slate-100 transition-colors"
                                                onClick={(e) => { e.stopPropagation(); setPriceModalOrder(order); setTempPrice(order.servicePrice?.toString() || ''); setTempInvestor(order.investorName || ''); }}
                                            >
                                                <div className="flex flex-col items-center">
                                                    <span className="text-slate-900 font-bold text-sm">
                                                        {(order.servicePrice !== undefined) ? `USD ${(order.servicePrice * order.treatedArea).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '---'}
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
                                            <td className="px-6 py-4 whitespace-nowrap text-left text-sm text-slate-600">
                                                {order.createdBy || '---'}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap text-right text-sm" onClick={e => e.stopPropagation()}>
                                                <div className="grid grid-cols-3 gap-1 w-fit ml-auto">
                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={() => client && generateInsumosPDF(order, client)}
                                                            className="w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200"
                                                        >
                                                            N
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            Necesidad de Insumos
                                                        </div>
                                                    </div>

                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (order.remitoImageUrl) {
                                                                    window.open(order.remitoImageUrl, '_blank');
                                                                } else if (client && !isReadOnly) {
                                                                    generateRemitoPDF(order, client);
                                                                }
                                                            }}
                                                            className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors bg-white border ${order.remitoImageUrl ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-50' : 'border-red-300 text-red-300 ' + (!isReadOnly ? 'hover:border-red-400' : 'opacity-50 cursor-default')}`}
                                                        >
                                                            R
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            {order.remitoImageUrl ? 'Ver Remito' : (isReadOnly ? 'Sin remito cargado' : 'Cargar Remito')}
                                                        </div>
                                                    </div>

                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={() => handleDownload(order)}
                                                            className="w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors bg-slate-100 text-slate-500 hover:bg-slate-200"
                                                        >
                                                            O
                                                        </button>
                                                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            Orden de Trabajo
                                                        </div>
                                                    </div>

                                                    <div className="relative group/tooltip">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (order.facturaImageUrl) {
                                                                    window.open(order.facturaImageUrl, '_blank');
                                                                } else if (!isReadOnly) {
                                                                    setSelectedOrderId(prev => prev === order.id ? null : order.id);
                                                                }
                                                            }}
                                                            className={`w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black transition-colors bg-white border ${order.facturaImageUrl ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-50' : 'border-red-300 text-red-300 ' + (!isReadOnly ? 'hover:border-red-400' : 'opacity-50 cursor-default')}`}
                                                        >
                                                            F
                                                        </button>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                            {order.facturaImageUrl ? 'Ver Factura' : (isReadOnly ? 'Sin factura cargada' : 'Cargar Factura')}
                                                        </div>
                                                    </div>

                                                    {!isReadOnly && role !== 'CONTRATISTA' && (
                                                        <>
                                                            <div className="relative group/tooltip">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setIsCreatingOrder(false);
                                                                        setEditingOrderId(order.id);
                                                                    }}
                                                                    className="w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                                                >
                                                                    ✎
                                                                </button>
                                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                                    Editar
                                                                </div>
                                                            </div>

                                                            <div className="relative group/tooltip">
                                                                <button
                                                                    onClick={() => handleDeleteOrder(order.id)}
                                                                    className="w-6 h-6 flex items-center justify-center rounded-md text-xs transition-colors bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-700"
                                                                >
                                                                    ✕
                                                                </button>
                                                                <div className="absolute bottom-full right-0 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded shadow-lg border border-slate-100 whitespace-nowrap pointer-events-none animate-fadeIn z-10">
                                                                    Eliminar
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {selectedOrderId === order.id && (
                                            <>
                                                {/* Insumos Breakdown */}
                                                {order.items && order.items.length > 1 && (
                                                    <tr className="bg-emerald-50/40 text-[11px] border-b border-emerald-100/50">
                                                        <td colSpan={5} className="py-2 bg-emerald-50/40"></td>
                                                        <td colSpan={7} className="px-6 py-4 bg-emerald-50/40">
                                                            <div className="flex flex-col gap-1.5 border-l-2 border-emerald-500/40 pl-4">
                                                                <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Desglose de Insumos</div>
                                                                {order.items.map((item, i) => (
                                                                    <div key={i} className={`flex justify-between items-center min-w-[200px] ${item.isVirtualDéficit ? 'text-orange-500' : 'text-slate-700'}`}>
                                                                        <span className="font-bold">
                                                                            {item.isVirtualDéficit 
                                                                                ? `Déficit de ${item.productName.replace(/^Déficit de\s+/i, '')}` 
                                                                                : item.productName}
                                                                        </span>
                                                                        <span className={`font-mono font-bold ml-6 lowercase ${item.isVirtualDéficit ? 'text-orange-500' : 'text-emerald-600'}`}>
                                                                            {item.multiplier ? `${item.multiplier} x ` : ''}
                                                                            {item.isVirtualDéficit ? '' : (item.presentationLabel || 'A granel')}
                                                                            {!item.isVirtualDéficit && item.presentationContent ? ` (${item.presentationContent}${item.unit})` : ''}
                                                                            {item.isVirtualDéficit ? '' : ' = '}
                                                                            {item.totalQuantity.toLocaleString()} {item.unit}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                                {/* Payors Breakdown */}
                                                {order.investors && order.investors.length > 1 && (
                                                    <tr className="bg-emerald-50/40 text-[11px] border-b border-emerald-100/50">
                                                        <td colSpan={9} className="py-2 bg-emerald-50/40"></td>
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
            {statusPopupOrder && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100 flex flex-col gap-4">
                        <div className="space-y-1">
                            <h3 className="text-lg font-black text-slate-800 tracking-tight">Confirmar {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</h3>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Seleccione la fecha real en la que se realizó la {statusPopupOrder.type === 'SOWING' ? 'siembra' : 'aplicación'} para la orden <span className="text-emerald-600 font-bold">#{statusPopupOrder.orderNumber}</span>.
                            </p>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha de {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</label>
                            <div className="flex items-center w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-sm shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                                <div className="flex items-center gap-0.5">
                                    <input
                                        ref={dayRef}
                                        type="text"
                                        placeholder="DD"
                                        maxLength={2}
                                        className="w-6 bg-transparent border-none p-0 text-left focus:ring-0 text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                                        value={dateSegments.day}
                                        onChange={(e) => handleSegmentChange('day', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, 'day')}
                                    />
                                    <span className="text-slate-300">/</span>
                                    <input
                                        ref={monthRef}
                                        type="text"
                                        placeholder="MM"
                                        maxLength={2}
                                        className="w-6 bg-transparent border-none p-0 text-center focus:ring-0 text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                                        value={dateSegments.month}
                                        onChange={(e) => handleSegmentChange('month', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, 'month')}
                                    />
                                    <span className="text-slate-300">/</span>
                                    <input
                                        ref={yearRef}
                                        type="text"
                                        placeholder="AAAA"
                                        maxLength={4}
                                        className="w-10 bg-transparent border-none p-0 text-center focus:ring-0 text-sm font-semibold text-slate-700 placeholder:text-slate-300"
                                        value={dateSegments.year}
                                        onChange={(e) => handleSegmentChange('year', e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(e, 'year')}
                                    />
                                </div>
                                <div className="ml-auto text-slate-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                            <Button variant="outline" onClick={() => setStatusPopupOrder(null)} className="flex-1 text-slate-700 border-slate-300 hover:bg-slate-50 rounded-lg py-1.5 text-sm font-medium">Cancelar</Button>
                            <Button onClick={handleConfirmStatus} className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-200/50 rounded-lg py-1.5 text-sm font-medium whitespace-nowrap">Confirmar {statusPopupOrder.type === 'SOWING' ? 'Siembra' : 'Aplicación'}</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Price & Partner Selection Modal */}
            {priceModalOrder && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-slideUp">
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Registrar Costo de Labor (USD)</h3>
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
                {selectedOrderDetailOrder && client && (
                    <OrderDetailView
                        order={selectedOrderDetailOrder as any}
                        client={client}
                        onClose={() => setSelectedOrderId(null)}
                        onEdit={(orderId) => {
                            setSelectedOrderId(null);
                            setEditingOrderId(orderId);
                            setIsCreatingOrder(false);
                        }}
                        isReadOnly={isReadOnly}
                        warehouses={warehouses}
                        createdBy={displayName || 'Sistema'}
                        lots={lots}
                        campaigns={campaigns}
                    />
                )}
            </div>

            {/* Inline Order Wizard */}
            <div ref={wizardRef} className="scroll-mt-24 pt-4 pb-20">
                {(isCreatingOrder || editingOrderId) && (
                    <OrderWizard
                        clientId={id}
                        editId={editingOrderId}
                        onClose={() => {
                            setIsCreatingOrder(false);
                            setEditingOrderId(null);
                        }}
                        onOrderCreated={() => {
                            // The useOrders hook should handle the update since it listens to DB changes
                            // but we can add manual triggers if needed.
                        }}
                    />
                )}
            </div>
        </div>

    );
}
