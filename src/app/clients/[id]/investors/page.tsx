'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Client, InventoryMovement, Order, Product } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useInventory, useClientMovements } from '@/hooks/useInventory';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/uuid';

export default function ContaduriaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { isMaster } = useAuth();
    const [client, setClient] = useState<Client | null>(null);
    const { movements, loading: movementsLoading } = useClientMovements(id);
    const { products, loading: productsLoading } = useInventory();
    const { orders, loading: ordersLoading } = useOrders(id);
    const scrollRef = useHorizontalScroll();
    const [loading, setLoading] = useState(true);

    const [showEditInvestors, setShowEditInvestors] = useState(false);
    const [partners, setPartners] = useState<{ name: string; cuit?: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [historyLimit, setHistoryLimit] = useState(10);
    const [editingPartnerIdx, setEditingPartnerIdx] = useState<number | null>(null);
    const [backupPartner, setBackupPartner] = useState<{ name: string; cuit?: string } | null>(null);

    useEffect(() => {
        db.get('clients', id).then(c => {
            setClient(c || null);
            if (c?.partners && c.partners.length > 0) {
                // Migration: handle string[] if encountered
                const migrated = c.partners.map((p: any) =>
                    typeof p === 'string' ? { name: p, cuit: '' } : p
                );
                setPartners(migrated);
            } else if (c?.investors && c.investors.length > 0) {
                // Automatic migration: extract names from old investors
                setPartners(c.investors.map((i: any) => ({ name: i.name, cuit: '' })));
            }
            setLoading(false);
        });
    }, [id]);

    const handleSaveInvestors = async () => {
        if (!client) return;

        setIsSaving(true);
        try {
            const updatedClient = {
                ...client,
                partners,
                updatedAt: new Date().toISOString(),
                synced: false
            };
            await db.put('clients', updatedClient);
            setClient(updatedClient);
            setShowEditInvestors(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar socios');
        } finally {
            setIsSaving(false);
        }
    };

    const addPartner = () => {
        const newPartner = { name: '', cuit: '' };
        setPartners([...partners, newPartner]);
        setEditingPartnerIdx(partners.length);
        setBackupPartner(newPartner);
    };

    const updatePartner = (idx: number, field: 'name' | 'cuit', value: string) => {
        const newPartners = [...partners];
        newPartners[idx] = { ...newPartners[idx], [field]: value };
        setPartners(newPartners);
    };

    const removePartner = (idx: number) => {
        const name = partners[idx].name || 'este socio';
        if (window.confirm(`¿Está seguro que desea eliminar a ${name}?`)) {
            setPartners(partners.filter((_, i) => i !== idx));
        }
    };

    const cancelEdit = (idx: number) => {
        if (backupPartner) {
            if (!backupPartner.name && !backupPartner.cuit) {
                // If it was a newly added partner (empty), remove it
                setPartners(partners.filter((_, i) => i !== idx));
            } else {
                const newPartners = [...partners];
                newPartners[idx] = backupPartner;
                setPartners(newPartners);
            }
        }
        setEditingPartnerIdx(null);
        setBackupPartner(null);
    };

    const stats = useMemo(() => {
        let investedMovements = 0;
        let serviceCosts = 0;
        let sold = 0;
        const perPartner: Record<string, number> = {};

        movements.forEach((m: InventoryMovement) => {
            const product = products.find(p => p.id === m.productId);
            const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');

            if (m.type === 'IN' && !isTransfer) {
                const purchasePrice = (m.purchasePrice !== undefined && m.purchasePrice !== null) ? m.purchasePrice : (product?.price || 0);
                const amount = m.quantity * purchasePrice;
                investedMovements += amount;

                const pName = m.investorName || 'Sin Asignar';
                perPartner[pName] = (perPartner[pName] || 0) + amount;
            } else if (m.type === 'SALE') {
                sold += (m.quantity * (m.salePrice || 0));
            }
        });

        orders.forEach((o: Order) => {
            if (o.servicePrice) {
                const amount = (o.servicePrice * o.treatedArea);
                serviceCosts += amount;

                const pName = o.investorName || 'Sin Asignar';
                perPartner[pName] = (perPartner[pName] || 0) + amount;
            }
        });

        const totalInvested = investedMovements + serviceCosts;

        return {
            investedMovements,
            serviceCosts,
            totalInvested,
            sold,
            total: sold - totalInvested,
            perPartner
        };
    }, [movements, products, orders]);

    const financialHistory = useMemo(() => {
        const history: {
            id: string,
            date: string,
            type: 'PURCHASE' | 'SALE' | 'SERVICE',
            description: string,
            amount: number,
            detail?: string
        }[] = [];

        movements.forEach(m => {
            const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
            if (isTransfer) return;

            const movementDate = m.date.includes('T') ? m.date : `${m.date}T${m.time || '00:00'}:00`;

            if (m.type === 'IN') {
                if (m.items && m.items.length > 0) {
                    const totalAmount = m.items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0);
                    const desc = m.items.length > 1 ? 'Varios' : m.items[0].productName;
                    history.push({
                        id: m.id,
                        date: movementDate,
                        type: 'PURCHASE',
                        description: `Compra: ${desc}`,
                        amount: totalAmount,
                        detail: m.items.map((i: any) => `${i.productName}: ${i.quantity} x USD ${i.price}`).join(', ')
                    });
                } else {
                    const product = products.find(p => p.id === m.productId);
                    const purchasePrice = (m.purchasePrice !== undefined && m.purchasePrice !== null) ? m.purchasePrice : (product?.price || 0);
                    history.push({
                        id: m.id,
                        date: movementDate,
                        type: 'PURCHASE',
                        description: `Compra: ${product?.name || 'Insumo'}`,
                        amount: m.quantity * purchasePrice,
                        detail: `${m.quantity} ${product?.unit || 'u.'} @ USD ${purchasePrice.toLocaleString()} / ${product?.unit || 'u.'}`
                    });
                }
            } else if (m.type === 'SALE') {
                const product = products.find(p => p.id === m.productId);
                const salePrice = m.salePrice || 0;
                history.push({
                    id: m.id,
                    date: movementDate,
                    type: 'SALE',
                    description: `Venta: ${product?.name || 'Insumo'}`,
                    amount: m.quantity * salePrice,
                    detail: `${m.quantity} ${product?.unit || 'u.'} @ USD ${salePrice.toLocaleString()} / ${product?.unit || 'u.'}`
                });
            }
        });

        orders.forEach(o => {
            if (o.servicePrice && o.servicePrice > 0) {
                const orderDate = o.date.includes('T') ? o.date : `${o.date}T${o.time || '00:00'}:00`;
                history.push({
                    id: o.id,
                    date: orderDate,
                    type: 'SERVICE',
                    description: o.type === 'HARVEST' ? 'Servicio de cosecha' :
                        (o.type === 'SOWING' ? 'Siembra' : 'Pulverización') +
                        `: Orden No ${o.orderNumber || '---'} (${o.treatedArea} ha)`,
                    amount: o.servicePrice * o.treatedArea,
                    detail: `${o.treatedArea} ha @ USD ${o.servicePrice.toLocaleString()} / ha`
                });
            }
        });

        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [movements, products, orders]);

    const investorBreakdown = useMemo(() => {
        const partnersMap = stats.perPartner;
        const totalInvested = stats.totalInvested || 1;

        return Object.entries(partnersMap).map(([name, amount]) => {
            const percentage = (amount / totalInvested) * 100;
            return {
                name,
                percentage,
                shareValue: (stats.total * percentage) / 100,
                shareInvestment: amount
            };
        }).sort((a, b) => b.shareInvestment - a.shareInvestment);
    }, [stats]);

    if (loading || movementsLoading || productsLoading || ordersLoading) {
        return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;
    }

    if (!client) return <div className="p-8 text-center text-red-500">Empresa no encontrada</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Contaduría</h1>
                    <p className="text-slate-500">Resumen de inversión y ventas para <strong>{client.name}</strong></p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Balance Final</h3>
                </div>
                <table className="min-w-full">
                    <tbody className="divide-y divide-slate-200 text-sm">
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-bold uppercase tracking-wider">Total Invertido (-)</td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-red-500">
                                    -USD {stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-emerald-600 font-bold uppercase tracking-wider">Total Vendido (+)</td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-emerald-600">
                                    +USD {stats.sold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className={`${stats.total >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                            <td className="px-6 py-5 font-black text-slate-800 uppercase tracking-widest">Balance Final</td>
                            <td className="px-6 py-5 text-right">
                                <span className={`text-base font-black ${stats.total >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    USD {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Financial History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Historial de Movimientos</h3>
                </div>
                <div
                    className="overflow-x-auto"
                    ref={scrollRef}
                >
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {financialHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No hay movimientos financieros registrados.</td>
                                </tr>
                            ) : (
                                financialHistory.slice(0, historyLimit).map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                            <div className="flex flex-col">
                                                <span>{item.date.split('T')[0]}</span>
                                                <span className="text-[10px] text-slate-400 font-normal uppercase tracking-tighter">
                                                    {new Date(item.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase().replace(' am', ' a.m.').replace(' pm', ' p.m.')}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${item.type === 'SALE' ? 'bg-emerald-100 text-emerald-700' :
                                                item.type === 'PURCHASE' ? 'bg-orange-100 text-orange-700' :
                                                    'bg-blue-100 text-blue-700'
                                                }`}>
                                                {item.type === 'SALE' ? 'Ingreso' : 'Egreso'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                            {item.description}
                                        </td>
                                        <td
                                            title={item.detail}
                                            className={`px-6 py-4 whitespace-nowrap text-right font-mono font-bold ${item.type === 'SALE' ? 'text-emerald-600' : 'text-red-500'
                                                }`}>
                                            {item.type === 'SALE' ? '+' : '-'}USD {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {(financialHistory.length > historyLimit || historyLimit > 10) && (
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center flex justify-center gap-4">
                        {financialHistory.length > historyLimit && (
                            <button
                                onClick={() => setHistoryLimit(prev => prev + 10)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                            >
                                Cargar 10 más
                            </button>
                        )}
                        {historyLimit > 10 && (
                            <button
                                onClick={() => setHistoryLimit(prev => Math.max(10, prev - 10))}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                            >
                                Cargar 10 menos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Investors Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Desglose por Inversor</h3>
                    {isMaster && (
                        <button
                            onClick={() => setShowEditInvestors(!showEditInvestors)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                        >
                            {showEditInvestors ? 'Cerrar' : '✏️ Gestionar Inversores'}
                        </button>
                    )}
                </div>

                {showEditInvestors ? (
                    <div className="p-6 space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Listado de Socios / Inversores</span>
                            <button
                                onClick={addPartner}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                            >
                                + Agregar Socio
                            </button>
                        </div>

                        {partners.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay socios definidos.</p>
                        ) : (
                            <div className="space-y-2">
                                {partners.map((p, idx) => (
                                    <div key={idx} className="group flex gap-2 items-start">
                                        {editingPartnerIdx === idx ? (
                                            <>
                                                <div className="flex-1 space-y-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre</label>
                                                        <Input
                                                            value={p.name}
                                                            onChange={e => updatePartner(idx, 'name', e.target.value)}
                                                            placeholder="Nombre del socio"
                                                            className="h-10 px-3 text-sm focus:ring-emerald-500 border-emerald-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">CUIT</label>
                                                        <Input
                                                            value={p.cuit || ''}
                                                            onChange={e => updatePartner(idx, 'cuit', e.target.value)}
                                                            placeholder="CUIT (e.g. 20-12345678-9)"
                                                            className="h-10 px-3 text-sm focus:ring-emerald-500 border-slate-200"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 pt-5">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPartnerIdx(null);
                                                            setBackupPartner(null);
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                        title="Confirmar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => cancelEdit(idx)}
                                                        className="h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors"
                                                        title="Cancelar edición"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-h-10 px-4 py-2 flex flex-col justify-center bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm transition-all group-hover:border-slate-300">
                                                    <div className="font-bold">{p.name || <span className="text-slate-400 italic font-normal">Socio sin nombre</span>}</div>
                                                    {p.cuit && <div className="text-[10px] text-slate-400 font-mono">CUIT: {p.cuit}</div>}
                                                </div>
                                                <div className="flex gap-1 h-10 items-center">
                                                    <button
                                                        onClick={() => {
                                                            setBackupPartner(partners[idx]);
                                                            setEditingPartnerIdx(idx);
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                                                        title="Editar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => removePartner(idx)}
                                                        className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end items-center pt-4 border-t mt-4">
                            <Button
                                size="sm"
                                onClick={handleSaveInvestors}
                                isLoading={isSaving}
                            >
                                Guardar Lista de Socios
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Inversor</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Participación</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Participación en la inversión</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Participación saldo de la empresa</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {investorBreakdown.length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-8 text-center text-slate-400 italic">No hay inversores registrados para esta empresa.</td>
                                    </tr>
                                ) : (
                                    investorBreakdown.map((inv, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900">
                                                {inv.name}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-600">
                                                {inv.percentage.toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-red-600">
                                                -USD {inv.shareInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${inv.shareValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                USD {inv.shareValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Investment Breakdown at the bottom */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Desglose de inversiones</h3>
                </div>
                <table className="min-w-full">
                    <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 tracking-wider">Compras Insumos</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-slate-700">
                                    USD {stats.investedMovements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 tracking-wider">Servicios (Órdenes)</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-slate-700">
                                    USD {stats.serviceCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inversión Total</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-black text-slate-900">
                                    USD {stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="flex justify-center pt-4">
                <Link
                    href={`/clients/${id}/investors/details`}
                    className="group flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
                >
                    <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-700 uppercase tracking-widest">Más detalle</span>
                    <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
            </div>
        </div>
    );
}
