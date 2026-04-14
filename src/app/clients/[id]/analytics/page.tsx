
'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/services/db';
import { Order, Campaign, InventoryMovement, TransportSheet, Client, Lot, Farm } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, LineChart } from 'recharts';

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
    const [selectedPartner, setSelectedPartner] = useState<string>('');
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'dates' | 'surface' | 'withdrawals' | 'cosechas' | 'evolucion' | 'socios'>(
        tabParam === 'evolucion' ? 'evolucion' :
        tabParam === 'socios' ? 'socios' :
        tabParam === 'cosechas' ? 'cosechas' : 
        tabParam === 'withdrawals' ? 'withdrawals' : 
        tabParam === 'surface' ? 'surface' : 'dates'
    );
    const [metric, setMetric] = useState<'planta' | 'campo'>('planta');
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

        const evolutionMap = new Map<string, {
            date: string;
            time: string;
            eventId: string;
            viajes: number;
            netoCampo: number;
            netoPlanta: number;
            partnerWeights: Record<string, number>;
            partnerWeightsCampo: Record<string, number>;
        }>();

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
            const eventId = m.harvestBatchId || m.id;

            if (!evolutionMap.has(eventId)) {
                evolutionMap.set(eventId, {
                    date: m.date,
                    time: m.time || '00:00',
                    eventId,
                    viajes: 0,
                    netoCampo: 0,
                    netoPlanta: 0,
                    partnerWeights: {},
                    partnerWeightsCampo: {}
                });
            }
            const evo = evolutionMap.get(eventId)!;

            (m.transportSheets || []).forEach((sheet: TransportSheet) => {
                const mark = sheet.partnermark;
                if (!mark || mark === 'General') return;

                if (selectedPartner && mark !== selectedPartner) return;

                const netoCampo = (sheet.grossWeight || 0) - (sheet.tareWeight || 0); // kg
                const netoPlanta = (sheet.grossWeightPlant || 0) - (sheet.tareWeightPlant || 0); // kg

                // Summary Data (Partner Totals)
                const existing = partnerMap.get(mark) || { netoCampo: 0, netoPlanta: 0, viajes: 0 };
                partnerMap.set(mark, {
                    netoCampo: existing.netoCampo + (netoCampo > 0 ? netoCampo : 0),
                    netoPlanta: existing.netoPlanta + (netoPlanta > 0 ? netoPlanta : 0),
                    viajes: existing.viajes + 1
                });

                // Evolution Data
                evo.viajes += 1;
                evo.netoCampo += (netoCampo > 0 ? netoCampo : 0);
                evo.netoPlanta += (netoPlanta > 0 ? netoPlanta : 0);
                evo.partnerWeights[mark] = (evo.partnerWeights[mark] || 0) + (netoPlanta > 0 ? netoPlanta : 0);
                evo.partnerWeightsCampo[mark] = (evo.partnerWeightsCampo[mark] || 0) + (netoCampo > 0 ? netoCampo : 0);

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
                if (!selectedPartner || p.name === selectedPartner) {
                    partnerMap.set(p.name, { netoCampo: 0, netoPlanta: 0, viajes: 0 });
                }
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

        // Calculate Evolution Rows
        const evoArray = Array.from(evolutionMap.values()).filter(e => e.viajes > 0);
        // Sort oldest to newest
        evoArray.sort((a, b) => {
            const dateA = a.date + 'T' + a.time;
            const dateB = b.date + 'T' + b.time;
            return dateA.localeCompare(dateB);
        });

        let currentAccumulatedCampo = 0;
        const evolutionRows = evoArray.map(evo => {
            currentAccumulatedCampo += evo.netoCampo;
            return {
                ...evo,
                netoCampoAcumulado: currentAccumulatedCampo
            };
        });

        // Reverse to newest on top for the table, but keep chronological for graph
        const chronologicalRows = [...evolutionRows];
        evolutionRows.reverse();

        let allClientPartners = (client?.partners || []).map(p => p.name).filter(Boolean) as string[];
        if (selectedPartner) {
            allClientPartners = [selectedPartner];
        }

        // KPI Calculations
        const fmtDate = (dStr: string) => {
            if (!dStr) return '';
            const parts = dStr.split('-');
            if (parts.length < 3) return dStr;
            return `${parts[2]}/${parts[1]}`;
        };

        let spanDays = 0;
        let dateRange = 'Sin actividad';
        if (chronologicalRows.length > 0) {
            const first = chronologicalRows[0].date;
            const last = chronologicalRows[chronologicalRows.length - 1].date;
            const d1 = new Date(first + 'T12:00:00'); // Use noon to avoid TZ issues
            const d2 = new Date(last + 'T12:00:00');
            spanDays = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            dateRange = `${fmtDate(first)} → ${fmtDate(last)}`;
        }

        const dailyMap = new Map<string, { netoCampo: number; netoPlanta: number; viajes: number }>();
        chronologicalRows.forEach(row => {
            const current = dailyMap.get(row.date) || { netoCampo: 0, netoPlanta: 0, viajes: 0 };
            dailyMap.set(row.date, {
                netoCampo: current.netoCampo + row.netoCampo,
                netoPlanta: current.netoPlanta + row.netoPlanta,
                viajes: current.viajes + row.viajes
            });
        });
        const dailyStats = Array.from(dailyMap.entries()).map(([date, stats]) => ({ date, ...stats }));
        
        let bestDay = { weight: 0, date: '', viajes: 0 };
        dailyStats.forEach(stat => {
            if (stat.netoCampo > bestDay.weight) {
                bestDay = { weight: stat.netoCampo, date: stat.date, viajes: stat.viajes };
            }
        });

        const latestActivity = dailyStats.length > 0 ? dailyStats[dailyStats.length - 1] : { netoCampo: 0, date: '', viajes: 0 };

        // Partner Cumulative Data (Neto Campo)
        const partnerRunTotals: Record<string, number> = {};
        allClientPartners.forEach(p => partnerRunTotals[p] = 0);

        const partnerCumulativeChartData = chronologicalRows.map(evo => {
            const dataPoint: any = { date: fmtDate(evo.date) };
            allClientPartners.forEach(p => {
                const dayWeight = evo.partnerWeightsCampo?.[p] || 0;
                partnerRunTotals[p] += dayWeight;
                dataPoint[p] = Number((partnerRunTotals[p] / 1000).toFixed(2)); // tn
            });
            return dataPoint;
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
            },
            evolution: {
                rows: evolutionRows,
                chartData: chronologicalRows,
                partners: allClientPartners,
                partnerCumulativeChartData,
                kpis: {
                    spanDays,
                    dateRange,
                    bestDay: {
                        weight: bestDay.weight / 1000,
                        date: fmtDate(bestDay.date),
                        viajes: bestDay.viajes
                    },
                    lastDay: {
                        weight: latestActivity.netoCampo / 1000,
                        date: fmtDate(latestActivity.date),
                        viajes: latestActivity.viajes
                    }
                }
            }
        };
    }, [movements, selectedCampaignId, selectedPartner, client, lots, farms]);

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
                    <button
                        onClick={() => setActiveTab('cosechas')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'cosechas' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Cosechas
                    </button>
                    <button
                        onClick={() => setActiveTab('evolucion')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'evolucion' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Evolución diaria
                    </button>
                    <button
                        onClick={() => setActiveTab('socios')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'socios' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Socios
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[32px] shadow-xl border border-slate-200 overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 pb-4 flex justify-between items-center">
                    {activeTab === 'dates' ? (
                        <h2 className="text-xl font-bold text-slate-900">Cronología de Siembra</h2>
                    ) : activeTab === 'surface' ? (
                        <h2 className="text-xl font-bold text-slate-900">Distribución de Superficie</h2>
                    ) : (
                        <div /> // Spacer to keep Campaña selector on the right
                    )}

                    <div className="flex items-center gap-3">
                        {activeTab === 'withdrawals' && (
                            <>
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Socio</span>
                                <select
                                    value={selectedPartner}
                                    onChange={(e) => setSelectedPartner(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                >
                                    <option value="">Todos los socios</option>
                                    {(client?.partners || []).map((p: any) => (
                                        p.name ? <option key={p.name} value={p.name}>{p.name}</option> : null
                                    ))}
                                </select>
                                <div className="border-r border-slate-200 h-6 mx-1" />
                            </>
                        )}
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
                    {activeTab === 'evolucion' ? (
                        <div className="space-y-8 animate-fadeIn">
                            {/* 4 Square-ish Boxes */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                {/* Box 1: Días con actividad */}
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[22px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Días con actividad</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-slate-900 leading-none">
                                            {withdrawalData.evolution.kpis.spanDays || 0}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.evolution.kpis.dateRange}
                                        </p>
                                    </div>
                                </div>

                                {/* Box 2: Acumulado (Interactivo) */}
                                <button 
                                    onClick={() => setMetric(metric === 'planta' ? 'campo' : 'planta')}
                                    className="bg-slate-50/50 border border-slate-200/60 rounded-[22px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full text-left group hover:bg-blue-50/30 hover:border-blue-200"
                                >
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">
                                            Acumulado {metric}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-blue-600 leading-none">
                                            {(metric === 'planta' ? withdrawalData.totalPlanta : withdrawalData.totalCampo) / 1000 > 0 
                                                ? ((metric === 'planta' ? withdrawalData.totalPlanta : withdrawalData.totalCampo) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                                : '0'} <span className="text-sm font-normal">tn</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.totalViajes} viajes
                                        </p>
                                    </div>
                                </button>

                                {/* Box 3: Mejor día */}
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[22px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Mejor día</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-emerald-700 leading-none">
                                            {withdrawalData.evolution.kpis.bestDay.weight > 0
                                                ? withdrawalData.evolution.kpis.bestDay.weight.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                                : '0'} <span className="text-sm font-normal">tn</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.evolution.kpis.bestDay.date || '—'} · {withdrawalData.evolution.kpis.bestDay.viajes} viajes
                                        </p>
                                    </div>
                                </div>

                                {/* Box 4: Última cosecha */}
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[22px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Ritmo último día</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-amber-700 leading-none">
                                            {withdrawalData.evolution.kpis.lastDay.weight > 0
                                                ? withdrawalData.evolution.kpis.lastDay.weight.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                                : '0'} <span className="text-sm font-normal">tn</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.evolution.kpis.lastDay.date || '—'} · {withdrawalData.evolution.kpis.lastDay.viajes} viajes
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Partner Cumulative Chart */}
                            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-8">Acumulado por socio diario</h3>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={withdrawalData.evolution.partnerCumulativeChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis 
                                                dataKey="date" 
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }} 
                                                dy={10}
                                            />
                                            <YAxis 
                                                label={{ value: 'acumulado (tn)', angle: -90, position: 'insideLeft', offset: 15, fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                                axisLine={false} 
                                                tickLine={false} 
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                            />
                                            <Tooltip 
                                                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                formatter={(value: any) => [`${(value ?? 0).toLocaleString('es-AR')} tn`, '']}
                                            />
                                            <Legend 
                                                verticalAlign="bottom" 
                                                height={36} 
                                                iconType="rect" 
                                                formatter={(value) => <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">{value}</span>}
                                                wrapperStyle={{ paddingTop: '30px' }}
                                            />
                                            {(withdrawalData.evolution.partners || []).map((partner, index) => {
                                                const colors = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#f43f5e', '#06b6d4'];
                                                return (
                                                    <Line 
                                                        key={partner}
                                                        type="monotone" 
                                                        dataKey={partner} 
                                                        stroke={colors[index % colors.length]} 
                                                        strokeWidth={3}
                                                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                                        activeDot={{ r: 6, strokeWidth: 0 }}
                                                        connectNulls
                                                    />
                                                );
                                            })}
                                        </LineChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Evolución Diaria: Daily Bar + Accumulation Line Chart */}
                            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-8">Evolución diaria de kg acumulados</h3>
                                <ResponsiveContainer width="100%" height={400}>
                                    <ComposedChart data={withdrawalData.evolution.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#0C8A52', fontSize: 12, fontWeight: 'bold' }}
                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                        />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: any, name: any) => [(value ?? 0).toLocaleString('es-AR'), name]}
                                            labelFormatter={(label) => new Date(`${label}T12:00:00`).toLocaleDateString('es-AR')}
                                        />
                                        <Legend verticalAlign="top" align="right" iconType="circle" />
                                        <Bar yAxisId="left" dataKey="netoCampo" name="Neto Campo Diario (kg)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                        <Line yAxisId="right" type="monotone" dataKey="netoCampoAcumulado" name="Acumulado (kg)" stroke="#0C8A52" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>

                                {/* Evolución Diaria Table */}
                                <div className="overflow-x-auto rounded-lg border border-gray-400 mt-8">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th
                                                    colSpan={5 + withdrawalData.evolution.partners.length}
                                                    className="px-6 py-2 text-left text-lg font-bold border-b border-[#0C8A52]"
                                                    style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif', border: '2px solid #0C8A52', borderBottom: '1px solid #0C8A52' }}
                                                >
                                                    Evolución Diaria de Kg Acumulados
                                                </th>
                                            </tr>
                                            <tr style={{ backgroundColor: '#0C8A52' }}>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 sticky left-0 z-10" style={{ backgroundColor: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Fecha</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Planta</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo Acumulado</th>
                                                {withdrawalData.evolution.partners.map(partner => (
                                                    <th key={partner} className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 min-w-[120px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {partner}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawalData.evolution.rows.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}
                                                >
                                                    <td className="px-6 py-3 text-sm font-bold text-gray-800 whitespace-nowrap border border-gray-300 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {new Date(`${row.date}T12:00:00`).toLocaleDateString('es-AR')}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-center whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.viajes}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono font-black text-right whitespace-nowrap border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoCampoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    {withdrawalData.evolution.partners.map(partner => (
                                                        <td key={partner} className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {(row.partnerWeights[partner] || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'socios' ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                            <span className="text-5xl mb-4">👥</span>
                            <p className="font-medium text-lg text-slate-900">Socios</p>
                            <p className="text-sm">Próximamente: Detalle de participación por integrante.</p>
                        </div>
                    ) : activeTab === 'cosechas' ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                            <span className="text-5xl mb-4">🌾</span>
                            <p className="font-medium">No hay datos de cosechas para mostrar</p>
                        </div>
                    ) : activeTab === 'withdrawals' ? (
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
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Neto Planta Acumulado (kg)</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>% Neto Planta Acumulado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawalData.rows.map((row, idx) => (
                                                <tr
                                                    key={idx}
                                                    style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}
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
                                                    Neto planta acumulado (kg)
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

                                {/* Evolution Table: Evolución Diaria de Kg Acumulados */}
                                <div className="space-y-8">
                                    <h3 className="text-xl font-bold text-slate-800 border-b-2 border-emerald-500 pb-2 inline-block">Evolución Diaria</h3>

                                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                                        <ResponsiveContainer width="100%" height={400}>
                                            <ComposedChart data={withdrawalData.evolution.chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                    dy={10}
                                                />
                                                <YAxis
                                                    yAxisId="left"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#64748b', fontSize: 12 }}
                                                    tickFormatter={(val) => val.toLocaleString('es-AR')}
                                                />
                                                <YAxis
                                                    yAxisId="right"
                                                    orientation="right"
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fill: '#0C8A52', fontSize: 12, fontWeight: 'bold' }}
                                                    tickFormatter={(val) => val.toLocaleString('es-AR')}
                                                />
                                                <Tooltip
                                                    cursor={{ fill: '#f8fafc' }}
                                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value: any, name: any) => [(value ?? 0).toLocaleString('es-AR'), name]}
                                                    labelFormatter={(label) => new Date(`${label}T12:00:00`).toLocaleDateString('es-AR')}
                                                />
                                                <Legend verticalAlign="top" align="right" iconType="circle" />
                                                <Bar yAxisId="left" dataKey="netoCampo" name="Neto Campo Diario (kg)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                                <Line yAxisId="right" type="monotone" dataKey="netoCampoAcumulado" name="Acumulado (kg)" stroke="#0C8A52" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="overflow-x-auto rounded-lg border border-gray-400 mt-6">
                                        <table className="min-w-full border-collapse">
                                            <thead>
                                                <tr>
                                                    <th
                                                        colSpan={5 + withdrawalData.evolution.partners.length}
                                                        className="px-6 py-2 text-left text-lg font-bold border-b border-[#0C8A52]"
                                                        style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif', border: '2px solid #0C8A52', borderBottom: '1px solid #0C8A52' }}
                                                    >
                                                        Evolución Diaria de Kg Acumulados
                                                    </th>
                                                </tr>
                                                <tr style={{ backgroundColor: '#0C8A52' }}>
                                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 sticky left-0 z-10" style={{ backgroundColor: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Fecha</th>
                                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo</th>
                                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Planta</th>
                                                    <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo Acumulado</th>
                                                    {withdrawalData.evolution.partners.map(partner => (
                                                        <th key={partner} className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 min-w-[120px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {partner}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {withdrawalData.evolution.rows.map((row, idx) => (
                                                    <tr
                                                        key={idx}
                                                        style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}
                                                    >
                                                        <td className="px-6 py-3 text-sm font-bold text-gray-800 whitespace-nowrap border border-gray-300 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {new Date(`${row.date}T12:00:00`).toLocaleDateString('es-AR')}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono text-gray-700 text-center whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {row.viajes}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {row.netoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-right whitespace-nowrap border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {row.netoCampoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        {withdrawalData.evolution.partners.map(partner => (
                                                            <td key={partner} className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                                {(row.partnerWeights[partner] || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
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
