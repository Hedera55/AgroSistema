'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Client, InventoryMovement } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useInventory, useClientMovements } from '@/hooks/useInventory';

export default function InvestorsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { } = useAuth(); // Keeping hook if needed for auth splash, but empty deconstruction
    const [client, setClient] = useState<Client | null>(null);
    const { movements, loading: movementsLoading } = useClientMovements(id);
    const { products, loading: productsLoading } = useInventory();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        db.get('clients', id).then(c => {
            setClient(c || null);
            setLoading(false);
        });
    }, [id]);

    const stats = useMemo(() => {
        let invested = 0;
        let sold = 0;

        movements.forEach((m: InventoryMovement) => {
            const product = products.find(p => p.id === m.productId);
            if (m.type === 'IN') {
                invested += (m.quantity * (product?.price || 0));
            } else if (m.type === 'SALE') {
                sold += (m.quantity * (m.salePrice || 0));
            }
        });

        return {
            invested,
            sold,
            total: sold - invested
        };
    }, [movements, products]);

    const investorBreakdown = useMemo(() => {
        if (!client?.investors) return [];
        return client.investors.map(inv => ({
            ...inv,
            shareValue: (stats.total * inv.percentage) / 100
        })).sort((a, b) => b.percentage - a.percentage);
    }, [client, stats]);

    if (loading || movementsLoading || productsLoading) {
        return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;
    }

    if (!client) return <div className="p-8 text-center text-red-500">Empresa no encontrada</div>;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Estado de Inversores</h1>
                    <p className="text-slate-500">Resumen de inversión y ventas para para <strong>{client.name}</strong></p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Resumen Financiero</h3>
                </div>
                <table className="min-w-full">
                    <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-xl">📉</span>
                                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Monto Invertido</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-xl font-black text-slate-700">
                                    ${stats.invested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-xl">📈</span>
                                <span className="text-sm font-bold text-emerald-600 uppercase tracking-wider">Monto Vendido</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-xl font-black text-emerald-600">
                                    ${stats.sold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className={`hover:bg-slate-50 transition-colors ${stats.total >= 0 ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Total (Balance)</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className={`text-xl font-black ${stats.total >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    ${stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Investors Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Desglose por Socio</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Inversor</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Participación</th>
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
                                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${inv.shareValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                            ${inv.shareValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
