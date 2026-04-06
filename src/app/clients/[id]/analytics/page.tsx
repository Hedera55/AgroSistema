'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/services/db';
import { Order, Campaign, InventoryMovement, TransportSheet, Client, Lot, Farm } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const CHART_COLORS = ['#10b981', '#fbbf24', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function AnalyticsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [orders, setOrders] = useState<Order[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [lots, setLots] = useState<Lot[]>([]);
    const [farms, setFarms] = useState<Farm[]>([]);
    const [client, setClient] = useState<Client | null>(null);
    const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'dates' | 'surface' | 'withdrawals'>(
        tabParam === 'withdrawals' ? 'withdrawals' : tabParam === 'surface' ? 'surface' : 'dates'
    );
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadInitialData = async () => {
            const [allOrders, allCampaigns, allMovements, allClients, allLots, allFarms] = await Promise.all([
                db.getAll('orders'),
                db.getAll('campaigns'),
                db.getAll('movements'),
                db.getAll('clients'),
                db.getAll('lots'),
                db.getAll('farms')
            ]);

            const clientOrders = allOrders.filter((o: Order) => o.clientId === clientId && !o.deleted);
            const clientCampaigns = allCampaigns.filter((c: Campaign) => c.clientId === clientId && !c.deleted);
            const clientMovements = allMovements.filter((m: InventoryMovement) => m.clientId === clientId && !m.deleted && m.transportSheets && m.transportSheets.length > 0);
            const foundClient = allClients.find((c: Client) => c.id === clientId);

            setOrders(clientOrders);
            setCampaigns(clientCampaigns);
            setMovements(clientMovements);
            setLots(allLots);
            setFarms(allFarms);
            setClient(foundClient || null);

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

    // Withdrawal aggregation by partnermark
    const withdrawalData = useMemo(() => {
        const partnerMap = new Map<string, { netoCampo: number; netoPlanta: number; viajes: number }>();
        const matrixMap = new Map<string, Map<string, number>>(); // [partnerName][lotId] -> kg
        const activeLotIds = new Set<string>();
        
        // Helper to get lot display name
        const getLotDisplayName = (lotId: string) => {
            const lot = lots.find(l => l.id === lotId);
            if (!lot) return lotId;
            const farm = farms.find(f => f.id === lot.farmId);
            return `${lot.name} - ${lot.farmName || farm?.name || 'S/C'}`;
        };

        const filteredMovements = movements.filter(m => 
            selectedCampaignId ? m.campaignId === selectedCampaignId : true
        );
        
        filteredMovements.forEach(m => {
            (m.transportSheets || []).forEach((sheet: TransportSheet) => {
                const mark = sheet.partnermark;
                if (!mark || mark === 'General') return;

                const netoCampo = (sheet.grossWeight || 0) - (sheet.tareWeight || 0); // kg
                const netoPlanta = (sheet.grossWeightPlant || 0) - (sheet.tareWeightPlant || 0); // kg

                // Summary Data (Partner Totals)
                const existing = partnerMap.get(mark) || { netoCampo: 0, netoPlanta: 0, viajes: 0 };
                partnerMap.set(mark, {
                    netoCampo: existing.netoCampo + (netoCampo > 0 ? netoCampo : 0),
                    netoPlanta: existing.netoPlanta + (netoPlanta > 0 ? netoPlanta : 0),
                    viajes: existing.viajes + 1
                });

                // Matrix Data (Partner x Lot)
                if (sheet.lotId) {
                    activeLotIds.add(sheet.lotId);
                    const partnerLots = matrixMap.get(mark) || new Map<string, number>();
                    const currentLotWeight = partnerLots.get(sheet.lotId) || 0;
                    partnerLots.set(sheet.lotId, currentLotWeight + (netoPlanta > 0 ? netoPlanta : 0));
                    matrixMap.set(mark, partnerLots);
                }
            });
        });

        // Ensure all client partners are present in summary (with 0 values if needed)
        const partnerNamesInMovements = new Set<string>(partnerMap.keys());
        (client?.partners || []).forEach(p => {
            if (p.name && !partnerNamesInMovements.has(p.name)) {
                partnerMap.set(p.name, { netoCampo: 0, netoPlanta: 0, viajes: 0 });
            }
        });

        // Calculate Grand Totals
        let totalCampo = 0;
        let totalPlanta = 0;
        let totalViajes = 0;
        partnerMap.forEach(v => {
            totalCampo += v.netoCampo;
            totalPlanta += v.netoPlanta;
            totalViajes += v.viajes;
        });

        // Summary Rows (Sorted)
        const rows = Array.from(partnerMap.entries())
            .map(([name, data]) => ({
                name,
                ...data,
                percentage: totalPlanta > 0 ? (data.netoPlanta / totalPlanta) * 100 : 0
            }))
            .sort((a, b) => b.netoPlanta - a.netoPlanta);

        // Matrix Header & Rows
        const sortedLotIds = Array.from(activeLotIds).sort((a, b) => getLotDisplayName(a).localeCompare(getLotDisplayName(b)));
        const matrixHeaders = sortedLotIds.map(id => ({ id, label: getLotDisplayName(id) }));
        
        const matrixRows = rows.map(row => {
            const partnerLots = matrixMap.get(row.name) || new Map<string, number>();
            const lotValues: Record<string, number> = {};
            sortedLotIds.forEach(lotId => {
                lotValues[lotId] = partnerLots.get(lotId) || 0;
            });
            return {
                partnerName: row.name,
                lotValues,
                total: row.netoPlanta
            };
        });

        // Vertical totals (per Lot)
        const lotTotals: Record<string, number> = {};
        sortedLotIds.forEach(lotId => {
            lotTotals[lotId] = matrixRows.reduce((sum, row) => sum + (row.lotValues[lotId] || 0), 0);
        });

        return { 
            rows, 
            totalCampo, 
            totalPlanta, 
            totalViajes,
            matrix: {
                headers: matrixHeaders,
                rows: matrixRows,
                lotTotals,
                grandTotal: totalPlanta
            }
        };
    }, [movements, selectedCampaignId, client, lots, farms]);

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
                    <button
                        onClick={() => setActiveTab('withdrawals')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'withdrawals' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Retiros por socio
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 pb-4 flex justify-between items-center">
                    {activeTab !== 'withdrawals' ? (
                        <h2 className="text-xl font-bold text-slate-900">
                            {activeTab === 'dates' ? 'Cronología de Siembra' : 'Distribución de Superficie'}
                        </h2>
                    ) : (
                        <div /> // Spacer to keep Campaña selector on the right
                    )}

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
                    {activeTab === 'withdrawals' ? (
                        withdrawalData.rows.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                                <span className="text-5xl mb-4">📊</span>
                                <p className="font-medium">No hay retiros con marca de socio registrados</p>
                            </div>
                        ) : (
                            <div className="space-y-12">
                                <div className="overflow-x-auto rounded-lg border border-gray-400">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th colSpan={5} className="px-6 py-2 text-left text-lg font-bold border-2 border-[#0C8A52]" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    Camiones — Pesaje por Socio
                                                </th>
                                            </tr>
                                            <tr style={{ backgroundColor: '#0C8A52' }}>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Socio</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Neto Campo (kg)</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Neto Planta (kg)</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>% Neto Planta</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawalData.rows.map((row, idx) => (
                                                <tr 
                                                    key={idx} 
                                                    style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}
                                                    className="hover:brightness-95 transition-all"
                                                >
                                                    <td className="px-6 py-3 text-sm font-bold text-gray-800 whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{row.name}</td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.viajes}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.percentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-white" style={{ borderTop: '2px solid #0C8A52' }}>
                                                <td className="px-6 py-3 text-sm font-black uppercase tracking-wider border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Total</td>
                                                <td className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    {withdrawalData.totalCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    {withdrawalData.totalPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                                <td className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    {withdrawalData.totalViajes}
                                                </td>
                                                <td className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    100,0%
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>

                                {/* Matrix Table: Neto planta by Partner and Lot */}
                                <div className="overflow-x-auto rounded-lg border border-gray-400">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th 
                                                    colSpan={withdrawalData.matrix.headers.length + 2} 
                                                    className="px-6 py-2 text-left text-lg font-bold border-b border-[#0C8A52]" 
                                                    style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif', border: '2px solid #0C8A52', borderBottom: '1px solid #0C8A52' }}
                                                >
                                                    Neto planta (kg)
                                                </th>
                                            </tr>
                                            <tr style={{ backgroundColor: '#0C8A52' }}>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 sticky left-0 z-10" style={{ backgroundColor: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Socio</th>
                                                {withdrawalData.matrix.headers.map(header => (
                                                    <th key={header.id} className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 min-w-[150px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {header.label}
                                                    </th>
                                                ))}
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawalData.matrix.rows.map((mRow, idx) => (
                                                <tr 
                                                    key={idx} 
                                                    style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}
                                                    className="hover:brightness-95 transition-all"
                                                >
                                                    <td className="px-6 py-3 text-sm font-bold text-gray-800 whitespace-nowrap border border-gray-300 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {mRow.partnerName}
                                                    </td>
                                                    {withdrawalData.matrix.headers.map(header => (
                                                        <td key={header.id} className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {mRow.lotValues[header.id]?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-3 text-sm font-mono font-black text-right whitespace-nowrap border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {mRow.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-white" style={{ borderTop: '2px solid #0C8A52' }}>
                                                <td className="px-6 py-3 text-sm font-black uppercase tracking-wider border border-gray-300 sticky left-0 z-10" style={{ backgroundColor: 'white', color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Total</td>
                                                {withdrawalData.matrix.headers.map(header => (
                                                    <td key={header.id} className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {withdrawalData.matrix.lotTotals[header.id]?.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0'}
                                                    </td>
                                                ))}
                                                <td className="px-6 py-3 text-sm font-mono font-black text-right border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                    {withdrawalData.matrix.grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>

                        )
                    ) : sowingOrders.length === 0 ? (
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
