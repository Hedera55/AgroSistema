'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
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
    const [loading, setLoading] = useState(true);

    const [showEditInvestors, setShowEditInvestors] = useState(false);
    const [investors, setInvestors] = useState<{ name: string, percentage: number }[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        db.get('clients', id).then(c => {
            setClient(c || null);
            if (c?.investors) {
                setInvestors(c.investors);
            }
            setLoading(false);
        });
    }, [id]);

    const handleSaveInvestors = async () => {
        if (!client) return;

        const totalPercentage = investors.reduce((sum, i) => sum + i.percentage, 0);
        if (totalPercentage > 100.01) {
            alert('El porcentaje total no puede superar el 100%');
            return;
        }

        setIsSaving(true);
        try {
            const updatedClient = {
                ...client,
                investors,
                updatedAt: new Date().toISOString(),
                synced: false
            };
            await db.put('clients', updatedClient);
            setClient(updatedClient);
            setShowEditInvestors(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar inversores');
        } finally {
            setIsSaving(false);
        }
    };

    const addInvestor = () => {
        setInvestors([...investors, { name: '', percentage: 0 }]);
    };

    const updateInvestor = (idx: number, field: 'name' | 'percentage', value: string) => {
        const newInvestors = [...investors];
        if (field === 'percentage') {
            newInvestors[idx].percentage = parseFloat(value) || 0;
        } else {
            newInvestors[idx].name = value;
        }
        setInvestors(newInvestors);
    };

    const removeInvestor = (idx: number) => {
        setInvestors(investors.filter((_, i) => i !== idx));
    };

    const stats = useMemo(() => {
        let investedMovements = 0;
        let serviceCosts = 0;
        let sold = 0;

        movements.forEach((m: InventoryMovement) => {
            const product = products.find(p => p.id === m.productId);
            if (m.type === 'IN') {
                investedMovements += (m.quantity * (m.purchasePrice || product?.price || 0));
            } else if (m.type === 'SALE') {
                sold += (m.quantity * (m.salePrice || 0));
            }
        });

        orders.forEach((o: Order) => {
            if (o.servicePrice) {
                serviceCosts += (o.servicePrice * o.treatedArea);
            }
        });

        const totalInvested = investedMovements + serviceCosts;

        return {
            investedMovements,
            serviceCosts,
            totalInvested,
            sold,
            total: sold - totalInvested
        };
    }, [movements, products, orders]);

    const financialHistory = useMemo(() => {
        const history: { id: string, date: string, type: 'PURCHASE' | 'SALE' | 'SERVICE', description: string, amount: number }[] = [];

        movements.forEach(m => {
            const product = products.find(p => p.id === m.productId);
            if (m.type === 'IN') {
                history.push({
                    id: m.id,
                    date: m.date,
                    type: 'PURCHASE',
                    description: `Compra: ${product?.name || 'Insumo'} (${m.quantity} ${product?.unit || 'u.'})`,
                    amount: m.quantity * (m.purchasePrice || product?.price || 0)
                });
            } else if (m.type === 'SALE') {
                history.push({
                    id: m.id,
                    date: m.date,
                    type: 'SALE',
                    description: `Venta: ${product?.name || 'Insumo'} (${m.quantity} ${product?.unit || 'u.'})`,
                    amount: m.quantity * (m.salePrice || 0)
                });
            }
        });

        orders.forEach(o => {
            if (o.servicePrice && o.servicePrice > 0) {
                history.push({
                    id: o.id,
                    date: o.date,
                    type: 'SERVICE',
                    description: `Servicio: Orden Nro ${o.orderNumber || '---'} (${o.treatedArea} ha)`,
                    amount: o.servicePrice * o.treatedArea
                });
            }
        });

        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [movements, products, orders]);

    const investorBreakdown = useMemo(() => {
        if (!client?.investors) return [];
        return client.investors.map(inv => ({
            ...inv,
            shareValue: (stats.total * inv.percentage) / 100,
            shareInvestment: (stats.totalInvested * inv.percentage) / 100
        })).sort((a, b) => b.percentage - a.percentage);
    }, [client, stats]);

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
                                    -${stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-emerald-600 font-bold uppercase tracking-wider">Total Vendido (+)</td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-emerald-600">
                                    +${stats.sold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className={`${stats.total >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                            <td className="px-6 py-5 font-black text-slate-800 uppercase tracking-widest">Balance Final</td>
                            <td className="px-6 py-5 text-right">
                                <span className={`text-base font-black ${stats.total >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    ${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Financial History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Historial de Movimientos de Dinero</h3>
                </div>
                <div
                    className="overflow-x-auto overflow-y-auto max-h-[400px]"
                    onWheel={(e) => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            e.currentTarget.scrollLeft += e.deltaY;
                        }
                    }}
                >
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Monto</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {financialHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No hay movimientos registrados.</td>
                                </tr>
                            ) : (
                                financialHistory.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                            {item.date}
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
                                        <td className={`px-6 py-4 whitespace-nowrap text-right font-mono font-bold ${item.type === 'SALE' ? 'text-emerald-600' : 'text-red-500'
                                            }`}>
                                            {item.type === 'SALE' ? '+' : '-'}${item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
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
                            {showEditInvestors ? 'Cancelar' : '✏️ Gestionar Inversores'}
                        </button>
                    )}
                </div>

                {showEditInvestors ? (
                    <div className="p-6 space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configurar Participación</span>
                            <button
                                onClick={addInvestor}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                            >
                                + Agregar Inversor
                            </button>
                        </div>

                        {investors.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay inversores definidos.</p>
                        ) : (
                            <div className="space-y-3">
                                {investors.map((inv, idx) => (
                                    <div key={idx} className="flex gap-3 items-end">
                                        <div className="flex-[2]">
                                            <Input
                                                label={idx === 0 ? "Nombre" : ""}
                                                value={inv.name}
                                                onChange={e => updateInvestor(idx, 'name', e.target.value)}
                                                placeholder="ej. Inversor X"
                                                className="h-9 px-3 text-sm"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Input
                                                label={idx === 0 ? "% Part." : ""}
                                                type="number"
                                                value={inv.percentage.toString()}
                                                onChange={e => updateInvestor(idx, 'percentage', e.target.value)}
                                                className="h-9 px-3 text-sm font-mono"
                                            />
                                        </div>
                                        <button
                                            onClick={() => removeInvestor(idx)}
                                            className="h-9 w-9 flex items-center justify-center text-slate-300 hover:text-red-500 mb-0.5"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-4 border-t mt-4">
                            <div className="text-sm font-bold text-slate-500">
                                Total: <span className={investors.reduce((sum, i) => sum + i.percentage, 0) > 100.01 ? 'text-red-500' : 'text-emerald-600'}>{investors.reduce((sum, i) => sum + i.percentage, 0).toFixed(2)}%</span>
                            </div>
                            <Button
                                size="sm"
                                onClick={handleSaveInvestors}
                                isLoading={isSaving}
                            >
                                Guardar Cambios
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
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Parte de la inversión</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Parte del balance</th>
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
                                                -${inv.shareInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${inv.shareValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                ${inv.shareValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                                    ${stats.investedMovements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 tracking-wider">Servicios (Órdenes)</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-slate-700">
                                    ${stats.serviceCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inversión Total</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-black text-slate-900">
                                    ${stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
