'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Order, Campaign, ProductType } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#10b981', '#fbbf24', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [orders, setOrders] = useState<Order[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'dates' | 'surface'>('dates');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            const [allOrders, allCampaigns] = await Promise.all([
                db.getAll('orders'),
                db.getAll('campaigns')
            ]);

            const clientOrders = allOrders.filter((o: Order) => o.clientId === clientId && !o.deleted);
            const clientCampaigns = allCampaigns.filter((c: Campaign) => c.clientId === clientId && !c.deleted);

            setOrders(clientOrders);
            setCampaigns(clientCampaigns);

            // Default to most recent campaign
            if (clientCampaigns.length > 0) {
                const latest = clientCampaigns.sort((a: Campaign, b: Campaign) => (b.createdAt || '').localeCompare(a.createdAt || ''))[0];
                setSelectedCampaignId(latest.id);
            }
            setLoading(false);
        };
        loadInitialData();
    }, [clientId]);

    const sowingOrders = useMemo(() => {
        return orders.filter((o: Order) => o.type === 'SOWING' && (selectedCampaignId ? o.campaignId === selectedCampaignId : true));
    }, [orders, selectedCampaignId]);

    const barData = useMemo(() => {
        const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        const monthsMap: Record<string, any> = {};

        sowingOrders.forEach((order: Order) => {
            const date = new Date(order.date);
            const monthIdx = date.getMonth();
            const monthKey = monthNames[monthIdx];

            if (!monthsMap[monthKey]) {
                monthsMap[monthKey] = { name: monthKey };
            }

            order.items.forEach((item: any) => {
                if (item.productType === 'SEED') {
                    const crop = item.productName;
                    monthsMap[monthKey][crop] = (monthsMap[monthKey][crop] || 0) + order.treatedArea;
                }
            });
        });

        // Order by common agricultural calendar (Jul to Jun)
        const order = ["Jul", "Ago", "Sep", "Oct", "Nov", "Dic", "Ene", "Feb", "Mar", "Abr", "May", "Jun"];
        return order.map(m => monthsMap[m] || { name: m });
    }, [sowingOrders]);

    const pieData = useMemo(() => {
        const cropsMap: Record<string, number> = {};
        sowingOrders.forEach((order: Order) => {
            order.items.forEach((item: any) => {
                if (item.productType === 'SEED') {
                    cropsMap[item.productName] = (cropsMap[item.productName] || 0) + order.treatedArea;
                }
            });
        });

        return Object.entries(cropsMap).map(([name, value]) => ({ name, value }));
    }, [sowingOrders]);

    const uniqueCrops = useMemo(() => {
        const crops = new Set<string>();
        barData.forEach((month: any) => {
            Object.keys(month).forEach((key: string) => {
                if (key !== 'name') crops.add(key);
            });
        });
        return Array.from(crops);
    }, [barData]);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando gráficos...</div>;

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/clients/${clientId}`} className="text-slate-400 hover:text-emerald-600 transition-colors">
                        <span className="text-2xl">←</span>
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Gráficos informativos</h1>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
                    <button
                        onClick={() => setActiveTab('dates')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'dates' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Fechas de siembra
                    </button>
                    <button
                        onClick={() => setActiveTab('surface')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'surface' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Hectáreas por cultivo
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 pb-4 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900">
                        {activeTab === 'dates' ? 'Cronología de Siembra' : 'Distribución de Superficie'}
                    </h2>

                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Campaña</span>
                        <select
                            value={selectedCampaignId}
                            onChange={(e) => setSelectedCampaignId(e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        >
                            <option value="">Todas las campañas</option>
                            {campaigns.map((c: Campaign) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 p-8 pt-4">
                    {sowingOrders.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <span className="text-5xl mb-4">📊</span>
                            <p className="font-medium">No hay datos de siembra para esta campaña</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={400}>
                            {activeTab === 'dates' ? (
                                <BarChart data={barData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="top" align="right" iconType="circle" />
                                    {uniqueCrops.map((crop: string, idx: number) => (
                                        <Bar
                                            key={crop}
                                            dataKey={crop}
                                            fill={CHART_COLORS[idx % CHART_COLORS.length]}
                                            radius={[4, 4, 0, 0]}
                                            barSize={30}
                                        />
                                    ))}
                                </BarChart>
                            ) : (
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={80}
                                        outerRadius={140}
                                        paddingAngle={5}
                                        dataKey="value"
                                        label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {pieData.map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
}
