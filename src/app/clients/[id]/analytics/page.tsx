
'use client';

import { use, useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { db } from '@/services/db';
import { Order, Campaign, InventoryMovement, TransportSheet, Client, Lot, Farm } from '@/types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line, LineChart, ReferenceLine, AreaChart, Area } from 'recharts';
import { calculateCampaignPartnerShares } from '@/utils/financial';
import { ObservationsSection } from '@/components/ObservationsSection';

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
    const [selectedCrop, setSelectedCrop] = useState<string>('');
    const searchParams = useSearchParams();
    const tabParam = searchParams.get('tab');
    const [activeTab, setActiveTab] = useState<'summary' | 'dates' | 'surface' | 'withdrawals' | 'cosechas' | 'evolucion' | 'socios'>(
        tabParam === 'summary' ? 'summary' :
            tabParam === 'evolucion' ? 'evolucion' :
                tabParam === 'socios' ? 'socios' :
                    tabParam === 'cosechas' ? 'cosechas' :
                        tabParam === 'withdrawals' ? 'withdrawals' :
                            tabParam === 'surface' ? 'surface' :
                                tabParam === 'dates' ? 'dates' : 'summary'
    );
    const [metric, setMetric] = useState<'planta' | 'campo'>('planta');
    const [loading, setLoading] = useState(true);
    const [isPinned, setIsPinned] = useState(true);
    const [distMetric, setDistMetric] = useState<'participacion' | 'retirado'>('participacion');
    const [selectedSocioDetail, setSelectedSocioDetail] = useState<string | null>(null);
    const [selectedSocioRetiroDetail, setSelectedSocioRetiroDetail] = useState<string | null>(null);

    // Horizontal scroll refs for tables
    const dailyTableScrollRef = useHorizontalScroll();
    const summaryScrollRef = useHorizontalScroll();
    const matrixScrollRef = useHorizontalScroll();
    const resumenSociosScrollRef = useHorizontalScroll();

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
            // Updated filter: Allow OUT movements (stock withdrawals) even if they lack transportSheets, and keep standard harvests with sheets
            const clientMovements = allMovements.filter((m: InventoryMovement) =>
                m.clientId === clientId && !m.deleted &&
                (m.type === 'OUT' || (m.transportSheets && m.transportSheets.length > 0))
            );
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

    const availableCrops = useMemo(() => {
        const crops = new Set<string>();
        movements.forEach(m => {
            if (m.type === 'HARVEST' && m.productName) {
                crops.add(m.productName);
            }
        });
        return Array.from(crops).sort();
    }, [movements]);

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
        // 1. Calculate contractual participation shares from campaign financials
        const campaignShares = calculateCampaignPartnerShares(movements, orders);
        const currentCampaignShares = selectedCampaignId ? (campaignShares[selectedCampaignId] || {}) : {};

        // 0. Pre-filter movements by selected campaign and crop, excluding deleted records
        const campaignMovements = movements.filter(m => 
            !m.deleted && 
            (selectedCampaignId ? m.campaignId === selectedCampaignId : true)
        );
        const filteredMovements = campaignMovements.filter(m => {
            if (!selectedCrop) return true;
            return m.productName === selectedCrop;
        });

        const partnerMap = new Map<string, { netoCampo: number; netoPlanta: number; viajes: number; humiditySum: number; humidityCount: number; lastDate: string; withdrawn: number }>();
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
            contributionWeightsCampo: Record<string, number>;
        }>();

        // Helper to get partner name correctly (stripping % or handle JSON)
        const getPartnerName = (name?: string) => {
            if (!name) return 'Sin Asignar';
            let pName = name;
            if (pName.startsWith('{')) {
                try {
                    const parsed = JSON.parse(pName);
                    if (parsed && parsed.name) pName = parsed.name;
                } catch (e) { }
            }
            return pName.split(' (')[0].trim();
        };

        // Helper to get lot display name
        const getLotDisplayName = (lotId: string) => {
            const lot = lots.find(l => l.id === lotId);
            if (!lot) return lotId;
            const farm = farms.find(f => f.id === lot.farmId);
            return `${lot.name} - ${lot.farmName || farm?.name || 'S/C'}`;
        };

        // Humidity tracking (across ALL sheets in campaign)
        let humiditySum = 0;
        let humidityCount = 0;

        const HUMIDITY_THRESHOLD = 14;
        const qualityStats = {
            minHum: Infinity,
            maxHum: -Infinity,
            sumHum: 0,
            countHum: 0,
            inRangeCount: 0,
            highCount: 0,
            noDataCount: 0,
            destinations: new Set<string>(),
            transportCompanies: new Set<string>(),
            validSheets: [] as { sheet: TransportSheet; parentLotId?: string; indexInMovement: number; parentDate: string; parentTime: string; harvestBatchId?: string }[],
            threshold: HUMIDITY_THRESHOLD
        };

        // Last activity tracking
        let lastStockWithdrawalDate = "";
        let lastStockWithdrawalPartner = "";

        // Track partner withdrawals (OUT + Partner Harvests)
        const partnerWithdrawals: Record<string, number> = {};
        const destinationTally: Record<string, number> = {};

        // 2. Initial pass on Movements (to capture accounting only)
        // 2. Initial pass on Movements (to capture accounting & legacy logistics)
        filteredMovements.forEach(m => {
            // Track stock withdrawals (Retiros from galpon/field)
            if ((m.type === 'OUT' || (m.type === 'HARVEST' && !m.warehouseId)) && (m.receiverName || m.investorName)) {
                const partnerName = getPartnerName(m.receiverName || m.investorName);
                partnerWithdrawals[partnerName] = (partnerWithdrawals[partnerName] || 0) + m.quantity;

                // Track withdrawal weight in Neto Campo (if possible, fallback to quantity)
                let netCampoInM = m.quantity;
                if (m.transportSheets && m.transportSheets.length > 0) {
                    netCampoInM = m.transportSheets.reduce((sum, s) => {
                        const nc = (s.grossWeight || 0) - (s.tareWeight || 0);
                        return sum + (nc > 0 ? nc : 0);
                    }, 0);
                }
                const existingCampo = (partnerWithdrawals as any)[partnerName + '_campo'] || 0;
                (partnerWithdrawals as any)[partnerName + '_campo'] = existingCampo + netCampoInM;

                const dateTime = m.date + (m.time ? 'T' + m.time : '');
                if (dateTime > lastStockWithdrawalDate) {
                    lastStockWithdrawalDate = dateTime;
                    lastStockWithdrawalPartner = partnerName;
                }
            }

            const eventId = m.harvestBatchId || m.id;
            
            // Ensure evolution entry exists
            if (!evolutionMap.has(eventId)) {
                evolutionMap.set(eventId, {
                    date: m.date,
                    time: m.time || '00:00',
                    eventId,
                    viajes: 0,
                    netoCampo: 0,
                    netoPlanta: 0,
                    partnerWeights: {},
                    partnerWeightsCampo: {},
                    contributionWeightsCampo: {}
                });
            }
        });

        // 3. Process LOGISTICS and WEIGHTS from Orders (Master List)
        // We use orders as the strict source of truth for trucks and harvest events.
        // Legacy data without Orders will NOT appear here until migrated (Edit & Save).
        const campaignOrders = orders.filter(o => 
            !o.deleted &&
            o.type === 'HARVEST' && 
            (selectedCampaignId ? o.campaignId === selectedCampaignId : true) &&
            (!selectedCrop || (lots.find(l => l.id === o.lotId)?.cropSpecies === selectedCrop))
        );

        campaignOrders.forEach(o => {
            const eventId = o.harvestBatchId || o.id;
            
            // Ensure evolution entry exists
            if (!evolutionMap.has(eventId)) {
                evolutionMap.set(eventId, {
                    date: o.date,
                    time: o.time || '00:00',
                    eventId,
                    viajes: 0,
                    netoCampo: 0,
                    netoPlanta: 0,
                    partnerWeights: {},
                    partnerWeightsCampo: {},
                    contributionWeightsCampo: {}
                });
            }
            const evo = evolutionMap.get(eventId)!;

            ((o as any).transportSheets || []).forEach((sheet: TransportSheet, sheetIdx: number) => {

                const mark = sheet.partnermark;
                const netoCampo = (sheet.grossWeight || 0) - (sheet.tareWeight || 0); // kg
                const netoPlanta = (sheet.grossWeightPlant || 0) - (sheet.tareWeightPlant || 0); // kg

                // Batch Totals (Global/Filtered)
                if (selectedPartner && mark !== selectedPartner) return;

                evo.viajes += 1;
                evo.netoCampo += (netoCampo > 0 ? netoCampo : 0);
                evo.netoPlanta += (netoPlanta > 0 ? netoPlanta : 0);

                // Humidity accumulation
                if (sheet.humidity != null && sheet.humidity > 0) {
                    humiditySum += sheet.humidity;
                    humidityCount += 1;
                }

                // Quality Stats accumulation - ONLY for Harvests (Field Intake)
                if (o.type === 'HARVEST') {
                    // Inclusion logic: use lotId from order
                    const lotLink = o.lotId;
                    
                    qualityStats.validSheets.push({ 
                        sheet, 
                        parentLotId: lotLink || sheet.lotId, 
                        indexInMovement: sheetIdx + 1, 
                        parentDate: o.date, 
                        parentTime: o.time || '00:00',
                        harvestBatchId: o.harvestBatchId || o.id
                    });
                    
                    if (sheet.humidity != null && sheet.humidity > 0) {
                        if (sheet.humidity < qualityStats.minHum) qualityStats.minHum = sheet.humidity;
                        if (sheet.humidity > qualityStats.maxHum) qualityStats.maxHum = sheet.humidity;
                        qualityStats.sumHum += sheet.humidity;
                        qualityStats.countHum++;

                        if (sheet.humidity <= HUMIDITY_THRESHOLD) qualityStats.inRangeCount++;
                        else qualityStats.highCount++;
                    } else {
                        qualityStats.noDataCount++;
                    }
                }

                if (sheet.destinationCompany) qualityStats.destinations.add(sheet.destinationCompany);
                if (sheet.transportCompany) qualityStats.transportCompanies.add(sheet.transportCompany);
                if (sheet.destinationCompany) destinationTally[sheet.destinationCompany] = (destinationTally[sheet.destinationCompany] || 0) + 1;

                // Identify Contribution Key (Socio or Galpones)
                const contribKey = mark && mark !== 'General' ? mark : 'Galpones';
                evo.contributionWeightsCampo[contribKey] = (evo.contributionWeightsCampo[contribKey] || 0) + (netoCampo > 0 ? netoCampo : 0);

                if (!mark || mark === 'General') return;

                // Summary Data (Partner Totals for existing summaries)
                const existing = partnerMap.get(mark) || { netoCampo: 0, netoPlanta: 0, viajes: 0, humiditySum: 0, humidityCount: 0, lastDate: "", withdrawn: 0 };
                const sheetDateTime = o.date + (o.time ? 'T' + o.time : '');

                partnerMap.set(mark, {
                    netoCampo: existing.netoCampo + (netoCampo > 0 ? netoCampo : 0),
                    netoPlanta: existing.netoPlanta + (netoPlanta > 0 ? netoPlanta : 0),
                    viajes: existing.viajes + 1,
                    humiditySum: existing.humiditySum + (sheet.humidity != null && sheet.humidity > 0 ? sheet.humidity : 0),
                    humidityCount: existing.humidityCount + (sheet.humidity != null && sheet.humidity > 0 ? 1 : 0),
                    lastDate: sheetDateTime > existing.lastDate ? sheetDateTime : existing.lastDate,
                    withdrawn: partnerWithdrawals[mark] || 0
                });

                // Original Evolution Data (for the older table)
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
                    partnerMap.set(p.name, { netoCampo: 0, netoPlanta: 0, viajes: 0, humiditySum: 0, humidityCount: 0, lastDate: "", withdrawn: partnerWithdrawals[p.name] || 0 });
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

        // Global Totals (Campaign-wide) for KPIs
        const totalCampoGlobal = Array.from(evolutionMap.values()).reduce((sum, e) => sum + e.netoCampo, 0);
        const totalPlantaGlobal = Array.from(evolutionMap.values()).reduce((sum, e) => sum + e.netoPlanta, 0);
        const totalViajesGlobal = Array.from(evolutionMap.values()).reduce((sum, e) => sum + e.viajes, 0);
        const avgWeightPerTrip = totalViajesGlobal > 0 ? totalCampoGlobal / totalViajesGlobal : 0;

        // Calculate GALPONES Row
        const partnerHumiditySum = Array.from(partnerMap.values()).reduce((sum, v) => sum + v.humiditySum, 0);
        const partnerHumidityCount = Array.from(partnerMap.values()).reduce((sum, v) => sum + v.humidityCount, 0);

        const allTrips: any[] = [];
        movements.forEach(m => {
            if (m.transportSheets) {
                m.transportSheets.forEach((sheet, idx) => {
                    const mark = sheet.partnermark && sheet.partnermark !== 'General' ? sheet.partnermark : 'Galpones';
                    const netoCampo = (sheet.grossWeight || 0) - (sheet.tareWeight || 0);
                    const netoPlanta = (sheet.grossWeightPlant || 0) - (sheet.tareWeightPlant || 0);

                    allTrips.push({
                        id: `${m.id}-${idx}`,
                        movementId: m.id,
                        fecha: m.date,
                        socio: mark,
                        campo: lots.find(l => l.id === sheet.lotId)?.name || 'Desconocido',
                        destino: sheet.destinationCompany || '---',
                        chofer: sheet.driverName || '---',
                        patente: sheet.truckPlate || '---',
                        netoCampo: netoCampo > 0 ? netoCampo : 0,
                        netoPlanta: netoPlanta > 0 ? netoPlanta : 0,
                        merma: (netoPlanta > 0 ? netoPlanta : 0) - (netoCampo > 0 ? netoCampo : 0),
                        humedad: sheet.humidity
                    });
                });
            }
        });

        const galponesNetoCampo = totalCampoGlobal - totalCampo;
        const galponesNetoPlanta = totalPlantaGlobal - totalPlanta;
        const galponesViajes = totalViajesGlobal - totalViajes;
        const galponesHumiditySum = humiditySum - partnerHumiditySum;
        const galponesHumidityCount = humidityCount - partnerHumidityCount;

        const rawRows = Array.from(partnerMap.entries()).map(([name, data]) => ({ name, ...data, isGalpones: false }));

        if (galponesViajes > 0 || galponesNetoCampo > 0) {
            rawRows.push({
                name: 'Galpones',
                netoCampo: galponesNetoCampo,
                netoPlanta: galponesNetoPlanta,
                viajes: galponesViajes,
                humiditySum: galponesHumiditySum > 0 ? galponesHumiditySum : 0,
                humidityCount: galponesHumidityCount > 0 ? galponesHumidityCount : 0,
                lastDate: '',
                isGalpones: true,
                withdrawn: 0
            });
        }

        // Summary Rows (Sorted)
        const rows = rawRows
            .map(data => {
                const merma = data.netoPlanta - data.netoCampo;
                const mermaPercent = data.netoCampo > 0 ? (merma / data.netoCampo) * 100 : 0;

                // Format date locally
                let formattedLastDate = '—';
                if (data.lastDate) {
                    const parts = data.lastDate.split('T')[0].split('-');
                    if (parts.length >= 3) {
                        formattedLastDate = `${parts[2]}/${parts[1]}`;
                    }
                }

                const sharePercentage = currentCampaignShares[data.name] || 0;
                const withdrawnPercentage = totalPlantaGlobal > 0 ? ((partnerWithdrawals[data.name] || 0) / totalPlantaGlobal) * 100 : 0;

                return {
                    ...data,
                    merma,
                    mermaPercent,
                    avgHumidity: data.humidityCount > 0 ? data.humiditySum / data.humidityCount : null,
                    formattedLastDate,
                    percentage: sharePercentage, // Contractual Share
                    withdrawnWeight: partnerWithdrawals[data.name] || 0,
                    withdrawnWeightCampo: (partnerWithdrawals as any)[data.name + '_campo'] || 0,
                    withdrawnPercentage // Portion of global total taken so far
                };
            })
            .sort((a, b) => {
                if (a.isGalpones) return 1;
                if (b.isGalpones) return -1;
                return b.netoPlanta - a.netoPlanta;
            });

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

        // Unique Contribution Names (Socios + Galpones)
        const allContribNamesSet = new Set<string>();
        chronologicalRows.forEach(row => {
            Object.keys(row.contributionWeightsCampo || {}).forEach(name => {
                if (name !== 'Galpones') allContribNamesSet.add(name);
            });
        });
        // Sort partners alphabetically, then always put Galpones last
        const contributionNames = [...Array.from(allContribNamesSet).sort(), 'Galpones'];

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
            totalCampo: totalCampoGlobal,
            totalPlanta: totalPlantaGlobal,
            totalViajes: totalViajesGlobal,
            avgWeightPerTrip,
            avgHumidity: humidityCount > 0 ? humiditySum / humidityCount : 0,
            humidityCount,
            allTrips,
            quality: (() => {
                const avgHum = qualityStats.countHum > 0 ? qualityStats.sumHum / qualityStats.countHum : 0;
                // Sort chronologically by parent movement date, then by sheet index within movement
                qualityStats.validSheets.sort((a, b) => {
                    const dateA = a.parentDate + 'T' + a.parentTime;
                    const dateB = b.parentDate + 'T' + b.parentTime;
                    if (dateA !== dateB) return dateA.localeCompare(dateB);
                    return a.indexInMovement - b.indexInMovement;
                });
                // Group and pre-calculate global indices per batch to resolve the "V1 V1" repetition
                // First, create a map of lot -> batch -> sheets[]
                const lotBatchMap = new Map<string, Map<string, any[]>>();
                qualityStats.validSheets.forEach(s => {
                    const lId = s.parentLotId || 'unknown';
                    const bId = s.harvestBatchId || 'unknown';
                    if (!lotBatchMap.has(lId)) lotBatchMap.set(lId, new Map());
                    const bMap = lotBatchMap.get(lId)!;
                    if (!bMap.has(bId)) bMap.set(bId, []);
                    bMap.get(bId)!.push(s);
                });

                // For each lot's batch, ensure sheets are sorted and assign global index
                const sheetToGlobalIndex = new Map<any, number>();
                lotBatchMap.forEach((batches) => {
                    batches.forEach((sheets) => {
                        // Sheets in here are already from validSheets which was sorted above
                        sheets.forEach((s, idx) => {
                            sheetToGlobalIndex.set(s, idx + 1);
                        });
                    });
                });

                // Identify lots with multiple batches for suffixing
                const lotHarvestsMap = new Map<string, string[]>(); // lotId -> ordered unique batchIds
                qualityStats.validSheets.forEach(s => {
                    if (!s.parentLotId) return;
                    if (!lotHarvestsMap.has(s.parentLotId)) lotHarvestsMap.set(s.parentLotId, []);
                    const batches = lotHarvestsMap.get(s.parentLotId)!;
                    const bId = s.harvestBatchId || 'unknown';
                    if (!batches.includes(bId)) batches.push(bId);
                });
                
                // Always take the last 6 sheets, regardless of humidity
                // Reverse so newest (highest number trip) is on the left
                const latest6 = qualityStats.validSheets.slice(-6).reverse();
                
                const rawChartData = latest6.map((entry) => {
                    const globalIdx = sheetToGlobalIndex.get(entry) || entry.indexInMovement;
                    const sheetNum = entry.sheet.dischargeNumber || String(globalIdx);
                    
                    const effectiveLotId = entry.parentLotId || entry.sheet.lotId;
                    const lotNameBase = effectiveLotId ? getLotDisplayName(effectiveLotId).split(' - ')[0] : 'S/C';
                    
                    // Add index suffix if this lot has >1 harvest event in the campaign
                    let suffix = '';
                    if (effectiveLotId && lotHarvestsMap.has(effectiveLotId)) {
                        const batches = lotHarvestsMap.get(effectiveLotId)!;
                        if (batches.length > 1) {
                            const bIdx = batches.indexOf(entry.harvestBatchId || 'unknown') + 1;
                            suffix = ` ${bIdx}`;
                        }
                    }
                    
                    const label = `V${sheetNum} ${lotNameBase}${suffix}`;
                    const hasHumidity = entry.sheet.humidity != null && entry.sheet.humidity > 0;
                    
                    return {
                        label,
                        humidity: hasHumidity ? entry.sheet.humidity : 1.5, // Small stub for no-data
                        hasData: hasHumidity,
                        fill: !hasHumidity ? '#cbd5e1' : (entry.sheet.humidity! <= HUMIDITY_THRESHOLD ? '#6ee7b7' : (entry.sheet.humidity! <= 15 ? '#fbd38d' : '#fca5a5'))
                    };
                });

                // Pad to 6 columns if needed
                const chartData = [...rawChartData];
                while (chartData.length < 6) {
                    chartData.push({
                        label: '',
                        humidity: 0,
                        hasData: false,
                        fill: 'transparent',
                        isPadding: true
                    } as any);
                }
                
                return {
                    minHum: qualityStats.minHum === Infinity ? 0 : qualityStats.minHum,
                    maxHum: qualityStats.maxHum === -Infinity ? 0 : qualityStats.maxHum,
                    avgHum,
                    inRangeCount: qualityStats.inRangeCount,
                    highCount: qualityStats.highCount,
                    noDataCount: qualityStats.noDataCount,
                    destinations: Array.from(qualityStats.destinations).join(' - ') || '-',
                    transportCompaniesCount: qualityStats.transportCompanies.size,
                    totalWithData: qualityStats.countHum,
                    chartData,
                    threshold: HUMIDITY_THRESHOLD
                };
            })(),
            matrix: {
                headers: matrixHeaders,
                rows: matrixRows,
                lotTotals,
                grandTotal: totalPlanta
            },
            mainDestination: (() => {
                const winner = Object.entries(destinationTally).sort((a, b) => b[1] - a[1])[0];
                return { name: winner ? winner[0] : '---', count: winner ? winner[1] : 0 };
            })(),
            evolution: {
                rows: evolutionRows.map(r => ({
                    ...r,
                    totalDia: Object.values(r.contributionWeightsCampo || {}).reduce((s: number, v: any) => s + (v || 0), 0)
                })),
                chartData: chronologicalRows,
                partners: allClientPartners,
                contributionNames,
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
                    },
                    lastActivity: (() => {
                        let finalDate = lastStockWithdrawalDate;
                        let finalPartner = lastStockWithdrawalPartner;

                        if (evolutionRows.length > 0) {
                            const latestHarvest = evolutionRows[0]; // Already newest first
                            const harvestDate = latestHarvest.date + (latestHarvest.time ? 'T' + latestHarvest.time : '');
                            if (harvestDate >= finalDate) {
                                finalDate = harvestDate;
                                const pWeights = latestHarvest.partnerWeightsCampo || {};
                                const topPartner = Object.entries(pWeights).sort(([, a], [, b]) => (b as number) - (a as number))[0]?.[0];
                                if (topPartner) finalPartner = topPartner;
                            }
                        }

                        return {
                            date: finalDate ? fmtDate(finalDate.split('T')[0]) : '—',
                            partner: finalPartner || '—'
                        };
                    })()
                }
            }
        };
    }, [movements, selectedCampaignId, selectedPartner, selectedCrop, client, lots, farms, orders]);

    // Campaign participation shares for Socios KPI
    const campaignShares = useMemo(() => {
        return calculateCampaignPartnerShares(movements, orders);
    }, [movements, orders]);

    if (loading) return <div className="p-8 text-center text-slate-500">Cargando gráficos...</div>;

    return (
        <div className={`space-y-6 w-full ${isPinned ? 'max-w-7xl mx-auto px-4 md:px-8' : ''}`}>
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
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${activeTab === 'summary' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Resumen general
                    </button>
                </div>
            </div>

            <div className="relative bg-white rounded-[32px] shadow-xl border border-slate-200 flex flex-col min-h-[500px]">
                <div className="p-8 pb-4 flex justify-between items-center">
                    {activeTab === 'summary' ? (
                        <h2 className="text-xl font-bold text-slate-900">Resumen General de Campaña</h2>
                    ) : activeTab === 'dates' ? (
                        <h2 className="text-xl font-bold text-slate-900">Cronología de Siembra</h2>
                    ) : activeTab === 'surface' ? (
                        <h2 className="text-xl font-bold text-slate-900">Distribución de Superficie</h2>
                    ) : (
                        <div /> // Spacer to keep Campaña selector on the right
                    )}

                    <div className="flex items-center gap-4">
                        {/* Partner Filter */}
                        {activeTab === 'summary' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Socio</span>
                                <select
                                    value={selectedPartner}
                                    onChange={(e) => setSelectedPartner(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-w-[140px]"
                                >
                                    <option value="">Todos</option>
                                    {(client?.partners || []).map((p: any) => (
                                        p.name ? <option key={p.name} value={p.name}>{p.name}</option> : null
                                    ))}
                                    <option value="Galpones">Galpones</option>
                                </select>
                            </div>
                        )}

                        {/* Crop Filter */}
                        {activeTab === 'summary' && (
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Cultivo</span>
                                <select
                                    value={selectedCrop}
                                    onChange={(e) => setSelectedCrop(e.target.value)}
                                    className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-w-[120px]"
                                >
                                    <option value="">Todos</option>
                                    {availableCrops.map(crop => (
                                        <option key={crop} value={crop}>{crop}</option>
                                    ))}
                                </select>
                            </div>
                        )}


                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Campaña</span>
                            <select
                                value={selectedCampaignId}
                                onChange={(e) => setSelectedCampaignId(e.target.value)}
                                className="bg-slate-50 border border-slate-200 rounded-full px-4 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all min-w-[120px]"
                            >
                                <option value="">Todas</option>
                                {campaigns.map((c: Campaign) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-8 pt-8">
                    {activeTab === 'summary' ? (
                        <div className="space-y-10 animate-fadeIn">
                            {/* Totales de Campaña */}
                            {(() => {
                                const kpis = [
                                    {
                                        title: `Neto ${metric === 'planta' ? 'Planta' : 'Campo'} Total`,
                                        value: ((metric === 'planta' ? withdrawalData.totalPlanta : withdrawalData.totalCampo) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                        sub: `${withdrawalData.totalViajes} viajes camión registrados`,
                                        isToggle: true
                                    },
                                    {
                                        title: "Merma Total",
                                        value: ((withdrawalData.totalPlanta - withdrawalData.totalCampo) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                                        sub: `${withdrawalData.totalCampo > 0 ? (((withdrawalData.totalPlanta - withdrawalData.totalCampo) / withdrawalData.totalCampo) * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}% sobre neto campo`
                                    },
                                    { title: "Total Bolsas", value: "0,00", sub: "sin registros aún" },
                                    { title: "Total General", value: "0,00", sub: "planta + bolsas combinado", highlight: true },
                                    {
                                        title: "Humedad Promedio",
                                        value: withdrawalData.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                                        sub: `${withdrawalData.humidityCount} viajes registrados con dato`,
                                        unit: "%"
                                    },
                                    {
                                        title: "Días de Cosecha",
                                        value: withdrawalData.evolution.kpis.spanDays.toString(),
                                        sub: `periodo: ${withdrawalData.evolution.kpis.dateRange}`,
                                        unit: "días"
                                    },
                                    {
                                        title: "Promedio Diario",
                                        value: (withdrawalData.totalCampo / (withdrawalData.evolution.kpis.spanDays || 1) / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                                        sub: `${(withdrawalData.totalViajes / (withdrawalData.evolution.kpis.spanDays || 1)).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} viajes por día`,
                                        unit: "tn/día"
                                    },
                                    {
                                        title: "Destino principal",
                                        value: withdrawalData.mainDestination.name,
                                        sub: `${withdrawalData.mainDestination.count} de ${withdrawalData.totalViajes} viajes`,
                                        unit: ""
                                    },
                                ];

                                const renderKpi = (kpi: any, idx: number) => kpi.isToggle ? (
                                    <button
                                        key={idx}
                                        onClick={() => setMetric(metric === 'planta' ? 'campo' : 'planta')}
                                        className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full text-left group hover:bg-blue-50/30 hover:border-blue-200"
                                    >
                                        <div className="space-y-0.5 mb-2">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight group-hover:text-blue-500 transition-colors">{kpi.title}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[28px] font-bold text-blue-600 leading-none">
                                                {kpi.value} <span className="text-sm font-normal text-slate-400">tn</span>
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-400">{kpi.sub}</p>
                                        </div>
                                    </button>
                                ) : (
                                    <div
                                        key={idx}
                                        className={`rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full ${kpi.highlight ? 'bg-blue-50/30 border border-blue-300 ring-1 ring-blue-500/20' : 'bg-slate-50/50 border border-slate-200/60 hover:border-slate-300'}`}
                                    >
                                        <div className="space-y-0.5 mb-2">
                                            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">{kpi.title}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className={`text-[28px] font-bold leading-none ${kpi.highlight ? 'text-blue-600' : 'text-slate-900'}`}>
                                                {kpi.value} <span className="text-sm font-normal text-slate-400 ml-0.5">{kpi.unit ?? 'tn'}</span>
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-400">{kpi.sub}</p>
                                        </div>
                                    </div>
                                );

                                return (
                                    <div className="space-y-6">
                                        <div className="flex flex-wrap items-stretch justify-between gap-y-6 gap-x-2 w-full px-2 lg:px-6 xl:px-10">
                                            {kpis.slice(0, 4).map(renderKpi)}
                                        </div>
                                        <div className="flex flex-wrap items-stretch justify-between gap-y-6 gap-x-2 w-full px-2 lg:px-6 xl:px-10">
                                            {kpis.slice(4, 8).map((kpi, idx) => renderKpi(kpi, idx + 4))}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Section: Participación Acumulada */}
                            <div className="pt-4">
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 md:p-8 shadow-sm">
                                    <div className="flex justify-between items-center mb-8 md:mb-10">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight">Participación acumulada — neto planta</h3>
                                    </div>

                                    <div className="space-y-8 md:space-y-10">
                                        {withdrawalData.rows
                                            .filter(row => !row.isGalpones)
                                            .map((row, idx) => {
                                                const percentage = withdrawalData.totalPlanta > 0
                                                    ? (row.netoPlanta / withdrawalData.totalPlanta) * 100
                                                    : 0;
                                                const color = CHART_COLORS[idx % CHART_COLORS.length];

                                                return (
                                                    <div key={row.name} className="space-y-3">
                                                        <div className="flex justify-between items-end">
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                                                                <span className="text-sm md:text-[15px] font-bold text-slate-700">{row.name}</span>
                                                            </div>
                                                            <div className="flex items-baseline gap-2">
                                                                <span className="text-xs md:text-sm font-bold text-slate-600">
                                                                    {(row.netoPlanta / 1000).toLocaleString('es-AR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} tn
                                                                </span>
                                                                <span className="text-xs md:text-sm font-bold text-slate-400">
                                                                    {percentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full transition-all duration-1000 ease-out"
                                                                style={{
                                                                    width: `${percentage}%`,
                                                                    backgroundColor: color
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                        {withdrawalData.rows.filter(row => !row.isGalpones).length === 0 && (
                                            <div className="text-center py-10 text-slate-400 italic text-sm">
                                                No hay socios registrados para este cliente.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Section: Distribución por Socio (Donut + Tabla Placeholder) */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
                                {/* Donut Chart Card */}
                                <button
                                    onClick={() => setDistMetric(distMetric === 'participacion' ? 'retirado' : 'participacion')}
                                    className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 md:p-8 shadow-sm text-left transition-all hover:border-emerald-300 hover:bg-emerald-50/5 group"
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight group-hover:text-emerald-600 transition-colors">Distribución por socio</h3>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{distMetric === 'participacion' ? 'participación' : 'retirado'}</span>
                                        </div>
                                    </div>
                                    <div className="h-[380px] w-full flex items-center justify-center relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={(() => {
                                                        const partners = withdrawalData.rows.filter(r => !r.isGalpones);
                                                        if (distMetric === 'participacion') {
                                                            return partners.map((r, idx) => ({
                                                                name: r.name,
                                                                value: r.percentage,
                                                                color: CHART_COLORS[idx % CHART_COLORS.length]
                                                            }));
                                                        } else {
                                                            const data = partners.map((r, idx) => ({
                                                                name: r.name,
                                                                value: (r.withdrawnWeightCampo / (withdrawalData.totalCampo || 1)) * 100,
                                                                color: CHART_COLORS[idx % CHART_COLORS.length]
                                                            }));
                                                            const totalWithdrawnPercent = data.reduce((sum, d) => sum + d.value, 0);
                                                            data.push({
                                                                name: 'Galpones',
                                                                value: Math.max(0, 100 - totalWithdrawnPercent),
                                                                color: '#cbd5e1' // Slate-300
                                                            });
                                                            return data;
                                                        }
                                                    })()}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={120}
                                                    outerRadius={165}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    stroke="none"
                                                >
                                                    {(() => {
                                                        const partners = withdrawalData.rows.filter(r => !r.isGalpones);
                                                        const data = distMetric === 'participacion' ? partners : [...partners, { name: 'Galpones' }];
                                                        return data.map((entry, index) => {
                                                            const name = (entry as any).name || entry.name;
                                                            const isDimmed = selectedPartner && selectedPartner !== name;
                                                            return (
                                                                <Cell
                                                                    key={`cell-${index}`}
                                                                    fill={distMetric === 'participacion' ? CHART_COLORS[index % CHART_COLORS.length] : (name === 'Galpones' ? '#cbd5e1' : CHART_COLORS[index % CHART_COLORS.length])}
                                                                    fillOpacity={isDimmed ? 0.2 : 1}
                                                                />
                                                            );
                                                        });
                                                    })()}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>

                                    {/* Custom Legend */}
                                    <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-3">
                                        {withdrawalData.rows.filter(r => !r.isGalpones).map((row, idx) => (
                                            <div key={row.name} className={`flex items-center gap-2.5 transition-opacity ${selectedPartner && selectedPartner !== row.name ? 'opacity-30' : 'opacity-100'}`}>
                                                <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }} />
                                                <span className="text-[13px] font-bold text-slate-600 whitespace-nowrap">{row.name}</span>
                                            </div>
                                        ))}
                                        {distMetric === 'retirado' && (
                                            <div className={`flex items-center gap-2.5 transition-opacity ${selectedPartner && selectedPartner !== 'Galpones' ? 'opacity-30' : 'opacity-100'}`}>
                                                <div className="w-4 h-4 rounded-sm bg-slate-300" />
                                                <span className="text-[13px] font-bold text-slate-600 whitespace-nowrap">Galpones</span>
                                            </div>
                                        )}
                                    </div>
                                </button>

                                {/* Partner Summary Table */}
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 lg:p-10 shadow-sm flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-colors">Tabla resumen por socio</h3>
                                    </div>
                                    <div className="flex-1 overflow-x-auto" ref={resumenSociosScrollRef}>
                                        <div className="min-w-[500px]">
                                            <table className="w-full text-left border-collapse">
                                                <thead>
                                                    <tr className="border-b border-slate-100">
                                                        <th className="py-4 px-2 text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Socio</th>
                                                        <th className="py-4 px-2 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Viajes</th>
                                                        <th className="py-4 px-2 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Neto campo</th>
                                                        <th className="py-4 px-2 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Neto planta</th>
                                                        <th className="py-4 px-2 text-right text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Merma</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50">
                                                    {withdrawalData.rows.filter(r => !r.isGalpones).map((row, idx) => (
                                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="py-4 px-2">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                                                                    <span className="text-[13px] font-bold text-slate-700 whitespace-nowrap truncate max-w-[120px]" title={row.name}>{row.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="py-4 px-2 text-center text-[13px] font-mono text-slate-600">{row.viajes}</td>
                                                            <td className="py-4 px-2 text-right text-[13px] font-mono text-slate-600">
                                                                {row.netoCampo.toLocaleString('es-AR')}
                                                            </td>
                                                            <td className="py-4 px-2 text-right text-[13px] font-mono font-medium text-slate-800">
                                                                {row.netoPlanta.toLocaleString('es-AR')}
                                                            </td>
                                                            <td className={`py-4 px-2 text-right text-[13px] font-mono font-bold ${row.mermaPercent < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                                {row.mermaPercent > 0 ? '+' : ''}{row.mermaPercent.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot className="border-t-2 border-slate-100">
                                                    <tr>
                                                        <td className="py-5 px-2 text-[12px] font-black text-slate-800 uppercase tracking-widest">Total</td>
                                                        <td className="py-5 px-2 text-center text-[13px] font-mono font-bold text-slate-800">{withdrawalData.totalViajes}</td>
                                                        <td className="py-5 px-2 text-right text-[13px] font-mono font-bold text-slate-800">
                                                            {withdrawalData.totalCampo.toLocaleString('es-AR')}
                                                        </td>
                                                        <td className="py-5 px-2 text-right text-[13px] font-mono font-bold text-emerald-700">
                                                            {withdrawalData.totalPlanta.toLocaleString('es-AR')}
                                                        </td>
                                                        <td className={`py-5 px-2 text-right text-[13px] font-mono font-black ${((withdrawalData.totalPlanta - withdrawalData.totalCampo) / (withdrawalData.totalCampo || 1)) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                            {withdrawalData.totalCampo > 0 ? (((withdrawalData.totalPlanta - withdrawalData.totalCampo) / withdrawalData.totalCampo) * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Additional Analytics Placeholders */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                                {/* Box 1: Acumulado diario */}
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 lg:p-10 shadow-sm flex flex-col h-[400px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-colors">Acumulado diario</h3>
                                        <span className="text-xs font-semibold text-slate-400">neto planta (tn)</span>
                                    </div>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={withdrawalData.evolution.chartData.map(d => ({ ...d, acumuladoTn: d.netoCampoAcumulado / 1000 }))} margin={{ top: 25, right: 10, left: 0, bottom: 5 }}>
                                                <defs>
                                                    <linearGradient id="areaGradientResumen" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#0C8A52" stopOpacity={0.25} />
                                                        <stop offset="95%" stopColor="#0C8A52" stopOpacity={0.02} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} tickFormatter={(val) => { const d = new Date(`${val}T12:00:00`); return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`; }} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toLocaleString('es-AR')} tn`} width={70} />
                                                <Area type="monotone" dataKey="acumuladoTn" stroke="#0C8A52" strokeWidth={2.5} fill="url(#areaGradientResumen)" dot={{ stroke: '#0C8A52', strokeWidth: 2, r: 3, fill: '#fff' }} label={{ position: 'top', fill: '#475569', fontSize: 11, fontWeight: 600, formatter: (val: any) => `${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tn` }} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Box 2: Merma por socio */}
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 lg:p-10 shadow-sm flex flex-col h-[400px]">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-colors">Merma por socio</h3>
                                    </div>
                                    <div className="flex-1">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={withdrawalData.rows.filter(r => !r.isGalpones).map((r, i) => ({ name: r.name, merma: Math.abs(r.merma) / 1000, color: CHART_COLORS[i % CHART_COLORS.length] }))} margin={{ top: 25, right: 10, left: 0, bottom: 30 }}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} angle={-25} textAnchor="end" interval={0} />
                                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(val) => `${val.toLocaleString('es-AR')} tn`} width={70} />
                                                <Bar dataKey="merma" name="Merma (tn)" radius={[6, 6, 0, 0]} barSize={36} label={{ position: 'top', fill: '#475569', fontSize: 12, fontWeight: 600, formatter: (val: any) => `${Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tn` }}>
                                                    {withdrawalData.rows.filter(r => !r.isGalpones).map((_, i) => (
                                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                {/* Box 3: Calidad — humedad por viaje */}
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 lg:p-10 shadow-sm flex flex-col h-[400px]">
                                    <div className="flex justify-between items-center mb-10">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-colors">Calidad — humedad por viaje</h3>
                                        <span className="bg-slate-100 text-slate-400 text-[10px] uppercase font-black px-2 py-1 rounded-md tracking-widest">referencia: ≤14% óptimo</span>
                                    </div>
                                    <div className="flex-1 w-full relative min-h-[220px]">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <ComposedChart data={withdrawalData.quality.chartData} margin={{ top: 25, right: 0, left: -20, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis 
                                                    dataKey="label" 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} 
                                                    dy={10}
                                                    angle={-25}
                                                    textAnchor="end"
                                                    height={60}
                                                    interval={0}
                                                />
                                                <YAxis 
                                                    axisLine={false} 
                                                    tickLine={false} 
                                                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                                                    tickFormatter={(val) => `${val}%`}
                                                    domain={[0, (dataMax: number) => Math.max(dataMax * 1.1, 18)]}
                                                    ticks={[0, 4, 8, 10, 12, 14, 16, 18]}
                                                />
                                                <Tooltip 
                                                    cursor={{ fill: 'transparent' }}
                                                    content={({ active, payload }) => {
                                                        if (active && payload && payload.length) {
                                                            const entry = payload[0].payload;
                                                            if (entry.isPadding) return null;
                                                            return (
                                                                <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] animate-in fade-in zoom-in duration-200">
                                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{entry.label}</p>
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.fill }}></div>
                                                                        <p className="text-base font-black text-slate-900">
                                                                            {entry.hasData ? `${entry.humidity}% ` : 's/d'}
                                                                            <span className="text-[10px] font-bold text-slate-400 uppercase ml-1">Humedad</span>
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    }}
                                                />
                                                <ReferenceLine y={withdrawalData.quality.threshold} stroke="#3b82f6" strokeDasharray="3 3" />
                                                <Bar 
                                                    dataKey="humidity" 
                                                    radius={[6, 6, 0, 0]} 
                                                    maxBarSize={32}
                                                    label={({ x, y, width, value, index }: any) => {
                                                        const entry = withdrawalData.quality.chartData[index];
                                                        if (entry?.isPadding) return null;
                                                        if (!entry?.hasData) {
                                                            return <text x={x + width / 2} y={y - 8} textAnchor="middle" fill="#cbd5e1" fontSize={10} fontWeight={800} fontStyle="italic">s/d</text>;
                                                        }
                                                        return null;
                                                    }}
                                                >
                                                    {withdrawalData.quality.chartData.map((entry: any, index: number) => (
                                                        <Cell key={index} fill={entry.fill} />
                                                    ))}
                                                </Bar>
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <div className="mt-4 flex items-center justify-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 bg-[#fca5a5] rounded-sm"></div>
                                            <span className="text-xs font-bold text-slate-500">Humedad (%)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 border-b-2 border-dashed border-blue-500"></div>
                                            <span className="text-xs font-medium text-slate-400">Límite óptimo ({withdrawalData.quality.threshold}%)</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Box 4: Estadísticas de calidad */}
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 lg:p-10 shadow-sm flex flex-col h-[400px]">
                                    <div className="flex justify-between items-center mb-8">
                                        <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight transition-colors">Estadísticas de calidad</h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-0 text-[13px]">
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Humedad mínima registrada</span>
                                            <span className="font-mono font-bold text-slate-800">{withdrawalData.quality.minHum > 0 ? `${withdrawalData.quality.minHum.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Humedad máxima registrada</span>
                                            <span className="font-mono font-bold text-red-500">{withdrawalData.quality.maxHum > 0 ? `${withdrawalData.quality.maxHum.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Humedad promedio</span>
                                            <span className="font-mono font-bold text-slate-800">{withdrawalData.quality.avgHum > 0 ? `${withdrawalData.quality.avgHum.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Viajes dentro de rango (≤{withdrawalData.quality.threshold}%)</span>
                                            <span className="font-mono font-bold text-emerald-600">{withdrawalData.quality.inRangeCount} de {withdrawalData.quality.totalWithData}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Viajes con humedad alta (&gt;{withdrawalData.quality.threshold}%)</span>
                                            <span className="font-mono font-bold text-red-500">{withdrawalData.quality.highCount} de {withdrawalData.quality.totalWithData}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500">Viajes sin dato de calidad</span>
                                            <span className="font-mono font-bold text-slate-800">{withdrawalData.quality.noDataCount}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                            <span className="font-bold text-slate-500 min-w-[120px]">Destinos alcanzados</span>
                                            <span className="font-bold text-slate-800 text-right truncate pl-4" title={withdrawalData.quality.destinations}>{withdrawalData.quality.destinations}</span>
                                        </div>
                                        <div className="flex justify-between items-center py-3">
                                            <span className="font-bold text-slate-500">Transportistas distintos</span>
                                            <span className="font-mono font-black text-slate-800">{withdrawalData.quality.transportCompaniesCount}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Observaciones */}
                            <hr className="border-slate-200 mt-12 mb-8" />
                            <div className="mt-4">
                                <div className="bg-white border border-slate-200 rounded-[24px] md:rounded-[28px] p-6 md:p-8 shadow-sm">
                                    <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight mb-6">Observaciones de campaña</h3>
                                    <ObservationsSection clientId={clientId} campaignId={selectedCampaignId} />
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'evolucion' ? (
                        <div className="space-y-8 animate-fadeIn">
                            {/* 5 Square-ish Boxes */}
                            <div className="flex flex-wrap items-stretch justify-between gap-y-6 gap-x-2 w-full px-2 lg:px-6 xl:px-10">
                                {/* Box 1: Días con actividad */}
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
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
                                    className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full text-left group hover:bg-blue-50/30 hover:border-blue-200"
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
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
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
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Ritmo último día</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-amber-600 leading-none">
                                            {(withdrawalData.evolution.kpis.lastDay.weight).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-normal">tn</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.evolution.kpis.lastDay.viajes} viajes
                                        </p>
                                    </div>
                                </div>

                                {/* Box 5: Promedio por viaje */}
                                <div className="bg-indigo-50/20 border border-indigo-100 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-tight">Promedio por viaje</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-indigo-700 leading-none">
                                            {(withdrawalData.avgWeightPerTrip / 1000).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-normal">tn</span>
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            Promedio campaña
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Partner Cumulative Chart */}
                            <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-800 mb-8">Acumulado por socio diario</h3>
                                <div className="h-[400px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={withdrawalData.evolution.partnerCumulativeChartData} margin={{ top: 20, right: 120, left: 20, bottom: 20 }}>
                                            <CartesianGrid yAxisId="left" strokeDasharray="4 6" vertical={false} stroke="#94a3b8" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={{ stroke: '#cbd5e1' }}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                width={100}
                                                label={{ value: 'acumulado (tn)', angle: -90, position: 'insideLeft', offset: 20, fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                                                axisLine={{ stroke: '#cbd5e1' }}
                                                tickLine={false}
                                                tick={{ fill: '#64748b', fontSize: 12 }}
                                            />
                                            <Tooltip
                                                isAnimationActive={false}
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
                                    <ComposedChart data={withdrawalData.evolution.chartData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                                        <CartesianGrid yAxisId="left" strokeDasharray="4 6" vertical={false} stroke="#94a3b8" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                            axisLine={{ stroke: '#cbd5e1' }}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            width={100}
                                            axisLine={{ stroke: '#cbd5e1' }}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            width={100}
                                            axisLine={{ stroke: '#cbd5e1' }}
                                            tickLine={false}
                                            tick={{ fill: '#0C8A52', fontSize: 12, fontWeight: 'bold' }}
                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                        />
                                        <Tooltip
                                            isAnimationActive={false}
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value: any, name: any) => [(value ?? 0).toLocaleString('es-AR'), name]}
                                            labelFormatter={(label) => new Date(`${label}T12:00:00`).toLocaleDateString('es-AR')}
                                        />
                                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                        <Bar yAxisId="left" dataKey="netoCampo" name="Neto Campo Diario (kg)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                        <Line yAxisId="right" type="monotone" dataKey="netoCampoAcumulado" name="Acumulado (kg)" stroke="#0C8A52" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                                {/* Tabla diaria */}
                                <div ref={dailyTableScrollRef} className="overflow-x-auto rounded-lg border border-gray-400 mt-8 bg-white">
                                    <table className="min-w-full border-collapse">
                                        <thead>
                                            <tr>
                                                <th
                                                    colSpan={6 + (withdrawalData.evolution.contributionNames?.length || 0)}
                                                    className="px-6 py-2 text-left text-lg font-bold border-b border-[#0C8A52]"
                                                    style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif', border: '2px solid #0C8A52', borderBottom: '1px solid #0C8A52' }}
                                                >
                                                    Tabla diaria
                                                </th>
                                            </tr>
                                            <tr style={{ backgroundColor: '#0C8A52' }}>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 sticky left-0 z-10 whitespace-nowrap" style={{ backgroundColor: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Fecha</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Planta</th>
                                                {(withdrawalData.evolution.contributionNames || []).map(name => (
                                                    <th key={name} className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 min-w-[120px] whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {name}
                                                    </th>
                                                ))}
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 bg-[#0A7445] whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Total Día</th>
                                                <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 bg-[#0A7445] whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Kg Campo Acum.</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {withdrawalData.evolution.rows.map((row, idx) => (
                                                <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1' }}>
                                                    <td className="px-6 py-3 text-sm font-bold text-gray-800 whitespace-nowrap border border-gray-300 sticky left-0 z-10" style={{ backgroundColor: idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {new Date(`${row.date}T12:00:00`).toLocaleDateString('es-AR')}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-center border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{row.viajes}</td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{row.netoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                                    <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>{row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                                    {(withdrawalData.evolution.contributionNames || []).map(name => (
                                                        <td key={name} className="px-6 py-3 text-sm font-mono text-gray-700 text-right border border-gray-300 font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {(row.contributionWeightsCampo?.[name] || 0) > 0
                                                                ? (row.contributionWeightsCampo[name] || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                                                                : '—'}
                                                        </td>
                                                    ))}
                                                    <td className="px-6 py-3 text-sm font-mono font-bold text-emerald-900 text-right border border-gray-300" style={{ backgroundColor: idx % 2 === 0 ? '#C8E1D4' : '#A9D1BD', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {(row.totalDia || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                    <td className="px-6 py-3 text-sm font-mono font-black text-[#0C8A52] text-right border border-gray-300" style={{ backgroundColor: idx % 2 === 0 ? '#B8D7C6' : '#8EBC9F', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                        {row.netoCampoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : activeTab === 'socios' ? (
                        <div className="space-y-8 animate-fadeIn">
                            {/* 5 KPI Boxes */}
                            <div className="flex flex-wrap items-stretch justify-between gap-y-6 gap-x-2 w-full px-2 lg:px-6 xl:px-10">
                                {/* Box 1: Socios activos */}
                                {(() => {
                                    const shares = selectedCampaignId ? (campaignShares[selectedCampaignId] || {}) : {};
                                    const activeFromViajes = new Set(withdrawalData.rows.filter(r => r.viajes > 0 && !r.isGalpones).map(r => r.name));
                                    const activeFromShares = new Set(Object.entries(shares).filter(([, v]) => v > 0).map(([k]) => k));
                                    const allActive = new Set([...activeFromViajes, ...activeFromShares]);
                                    const totalRegistered = (client?.partners || []).length;
                                    return (
                                        <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                            <div className="space-y-0.5">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Socios activos</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[28px] font-bold text-slate-900 leading-none">{allActive.size}</p>
                                                <p className="text-[11px] font-medium text-slate-400">de {totalRegistered} registrados</p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Box 2: Acumulado total */}
                                <button
                                    onClick={() => setMetric(metric === 'planta' ? 'campo' : 'planta')}
                                    className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full text-left group hover:bg-blue-50/30 hover:border-blue-200"
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

                                {/* Box 3: Merma total */}
                                {(() => {
                                    const mermaPercent = withdrawalData.totalCampo > 0
                                        ? ((withdrawalData.totalPlanta - withdrawalData.totalCampo) / withdrawalData.totalCampo) * 100
                                        : 0;
                                    const mermaTn = (withdrawalData.totalPlanta - withdrawalData.totalCampo) / 1000;
                                    return (
                                        <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                            <div className="space-y-0.5">
                                                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Merma total</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[28px] font-bold text-amber-600 leading-none">
                                                    {mermaPercent !== 0 ? mermaPercent.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-400">
                                                    {mermaTn.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} tn merma
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Box 4: Humedad promedio */}
                                <div className="bg-slate-50/50 border border-slate-200/60 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Humedad promedio</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-blue-600 leading-none">
                                            {withdrawalData.avgHumidity > 0
                                                ? withdrawalData.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
                                                : '—'}%
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400">
                                            {withdrawalData.humidityCount} viajes con dato
                                        </p>
                                    </div>
                                </div>

                                {/* Box 5: Último movimiento */}
                                <div className="bg-indigo-50/20 border border-indigo-100 rounded-[14px] py-4 px-5 flex flex-col justify-between min-h-[110px] transition-all max-w-[180px] w-full">
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-bold text-indigo-500 uppercase tracking-tight">Último movimiento</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[28px] font-bold text-indigo-700 leading-none">
                                            {withdrawalData.evolution.kpis.lastActivity.date}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400 truncate" title={withdrawalData.evolution.kpis.lastActivity.partner}>
                                            {withdrawalData.evolution.kpis.lastActivity.partner}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Main "Detalle por socio - cosecha" Table */}
                            {withdrawalData.rows.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[400px]">
                                    <span className="text-5xl mb-4">👥</span>
                                    <p className="font-medium">No hay retiros con marca de socio registrados para esta campaña.</p>
                                </div>
                            ) : (
                                <div className="p-8 space-y-16 animate-fadeInUp">
                                    <div className="rounded-xl border-2 border-gray-400 overflow-hidden shadow-sm">
                                        <div ref={summaryScrollRef} className="overflow-x-auto pb-2">
                                            <table className="min-w-full border-separate border-spacing-0">
                                                <thead>
                                                    <tr>
                                                        <th colSpan={9} className="px-6 py-2 text-left text-lg font-bold border-b border-[#0C8A52]" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            Detalle por socio - cosecha
                                                        </th>
                                                    </tr>
                                                    <tr style={{ backgroundColor: '#0C8A52' }}>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 sticky left-0 z-10 whitespace-nowrap" style={{ backgroundColor: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>Socio</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Neto campo acumulado</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Neto planta acumulado</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Merma (kg)</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Merma %</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Viajes</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 min-w-[120px] whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>% Retiro</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Hum. prom.</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Último retiro</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {withdrawalData.rows.map((row, idx) => (
                                                        <tr
                                                            key={idx}
                                                            onClick={() => setSelectedSocioDetail(selectedSocioDetail === row.name ? null : row.name)}
                                                            className="cursor-pointer transition-all hover:brightness-95"
                                                            style={{ backgroundColor: row.isGalpones ? '#f1f5f9' : (idx % 2 === 0 ? '#EBF5F0' : '#D7EBE1') }}
                                                        >
                                                            <td className={`px-6 py-3 text-sm font-bold border-r border-b border-gray-300 sticky left-0 z-10 whitespace-nowrap ${row.isGalpones ? 'text-slate-400' : 'text-gray-800'}`} style={{ backgroundColor: row.isGalpones ? '#f8fafc' : (idx % 2 === 0 ? (selectedSocioDetail === row.name ? '#C6F6D5' : '#EBF5F0') : (selectedSocioDetail === row.name ? '#B2F5EA' : '#D7EBE1')), fontFamily: 'Helvetica, Arial, sans-serif', borderLeft: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>{row.name}</td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border-r border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.netoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border-r border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border-r border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.merma.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td className="px-6 py-3 text-[14px] font-mono text-right border-r border-b border-gray-300 whitespace-nowrap font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                <span className={row.mermaPercent >= -5 ? 'text-emerald-600' : row.mermaPercent >= -12 ? 'text-amber-600' : 'text-red-500'}>
                                                                    {row.mermaPercent > 0 ? '+' : ''}{row.mermaPercent.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 text-center border-r border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.viajes}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 border-r border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                <div className="flex items-center gap-3 min-w-[120px]">
                                                                    {!row.isGalpones ? (
                                                                        <>
                                                                            <div className="w-14 h-1.5 bg-slate-200/50 rounded-full overflow-hidden flex-shrink-0">
                                                                                <div
                                                                                    className="h-full bg-emerald-500 transition-all duration-500"
                                                                                    style={{ width: `${Math.min(100, (row.withdrawnPercentage / (row.percentage || 1)) * 100)}%` }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                                <span className="text-[12px] font-black text-slate-700">
                                                                                    {row.withdrawnPercentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                                </span>
                                                                                <span className="text-[10px] font-bold text-slate-400">/</span>
                                                                                <span className="text-[10px] font-black text-slate-400">
                                                                                    {row.percentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center w-full">
                                                                            <span className="text-xs font-bold text-slate-300">—</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3 text-[12px] font-mono text-center border-r border-b border-gray-300 whitespace-nowrap font-bold" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.avgHumidity != null ? (
                                                                    <div className={`inline-flex items-center justify-center px-2 py-0.5 rounded shadow-sm ${row.avgHumidity <= 14 ? 'bg-emerald-500 text-white border border-emerald-600' :
                                                                            row.avgHumidity <= 15 ? 'bg-amber-500 text-white border border-amber-600' :
                                                                                'bg-red-500 text-white border border-red-600'
                                                                        }`}>
                                                                        {row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-400">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-slate-600 text-center border-b border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioDetail === row.name ? 'rgba(16, 185, 129, 0.05)' : '', borderTop: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderBottom: selectedSocioDetail === row.name ? '3px solid #10b981' : '', borderRight: selectedSocioDetail === row.name ? '3px solid #10b981' : '' }}>
                                                                {row.formattedLastDate}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr className="bg-slate-50 border-t-2 border-[#0C8A52]">
                                                        <td className="px-6 py-3 text-sm font-black uppercase tracking-wider border-r border-b border-slate-300 sticky left-0 z-10 whitespace-nowrap" style={{ color: '#0C8A52', backgroundColor: '#f8fafc', fontFamily: 'Helvetica, Arial, sans-serif' }}>Total</td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-right border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.totalCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-right border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.totalPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-right border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {(withdrawalData.totalPlanta - withdrawalData.totalCampo).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-right border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.totalCampo > 0 ? (((withdrawalData.totalPlanta - withdrawalData.totalCampo) / withdrawalData.totalCampo) * 100).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-center border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.totalViajes}
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-center border-r border-b border-slate-300 text-gray-400" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            —
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-center border-r border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.avgHumidity > 0 ? withdrawalData.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '0'}%
                                                        </td>
                                                        <td className="px-6 py-3 text-sm font-mono font-black text-center border-b border-slate-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            {withdrawalData.evolution.kpis.lastActivity.date}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>


                                    {/* Second Table: Detalles por socio - Retiros galpón (Simplified 5-Column Layout) */}

                                    <div className="rounded-xl border-2 border-gray-400 overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto pb-2">
                                            <table className="min-w-full border-separate border-spacing-0">
                                                <thead>
                                                    <tr>
                                                        <th colSpan={5} className="px-6 py-2 text-left text-lg font-bold border-b border-blue-600" style={{ color: '#2563eb', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                            Detalles por socio - Retiros galpón
                                                        </th>
                                                    </tr>
                                                    <tr className="bg-blue-600">
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 sticky left-0 z-10 whitespace-nowrap" style={{ backgroundColor: '#2563eb', fontFamily: 'Helvetica, Arial, sans-serif' }}>Socio</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Cantidad retirada</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 min-w-[120px] whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>% Retiro</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-r border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Humedad promedio</th>
                                                        <th className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border-b border-white/10 whitespace-nowrap" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>Último retiro</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {withdrawalData.rows.map((row, idx) => (
                                                        <tr
                                                            key={idx}
                                                            onClick={() => setSelectedSocioRetiroDetail(selectedSocioRetiroDetail === row.name ? null : row.name)}
                                                            className="cursor-pointer transition-all hover:brightness-95 border-b border-gray-400"
                                                            style={{ backgroundColor: row.isGalpones ? '#f8fafc' : (idx % 2 === 0 ? '#f0f9ff' : '#e0f2fe') }}
                                                        >
                                                            <td className={`px-6 py-3 text-sm font-bold border-r border-b border-gray-300 sticky left-0 z-10 whitespace-nowrap ${row.isGalpones ? 'text-slate-400' : 'text-gray-800'}`} style={{ backgroundColor: row.isGalpones ? '#f8fafc' : (idx % 2 === 0 ? (selectedSocioRetiroDetail === row.name ? '#DBEAFE' : '#f0f9ff') : (selectedSocioRetiroDetail === row.name ? '#BFDBFE' : '#e0f2fe')), fontFamily: 'Helvetica, Arial, sans-serif', borderLeft: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderTop: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderBottom: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '' }}>{row.name}</td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right border-r border-b border-gray-300" style={{ backgroundColor: selectedSocioRetiroDetail === row.name ? 'rgba(59, 130, 246, 0.05)' : '', borderTop: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderBottom: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '' }}>
                                                                {row.withdrawnWeight.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-gray-700 border-r border-b border-gray-300" style={{ backgroundColor: selectedSocioRetiroDetail === row.name ? 'rgba(59, 130, 246, 0.05)' : '', borderTop: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderBottom: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '' }}>
                                                                <div className="flex items-center gap-3 min-w-[120px]">
                                                                    {!row.isGalpones ? (
                                                                        <>
                                                                            <div className="w-14 h-1.5 bg-slate-200/50 rounded-full overflow-hidden flex-shrink-0">
                                                                                <div
                                                                                    className="h-full bg-blue-500 transition-all duration-500"
                                                                                    style={{ width: `${Math.min(100, (row.withdrawnPercentage / (row.percentage || 1)) * 100)}%` }}
                                                                                />
                                                                            </div>
                                                                            <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                                <span className="text-[12px] font-black text-slate-700">
                                                                                    {row.withdrawnPercentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                                </span>
                                                                                <span className="text-[10px] font-bold text-slate-400">/</span>
                                                                                <span className="text-[10px] font-black text-slate-400">
                                                                                    {row.percentage.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                                </span>
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className="flex items-center justify-center w-full">
                                                                            <span className="text-xs font-bold text-slate-300">—</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-center border-r border-b border-gray-300 text-slate-600" style={{ backgroundColor: selectedSocioRetiroDetail === row.name ? 'rgba(59, 130, 246, 0.05)' : '', borderTop: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderBottom: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '' }}>
                                                                {row.avgHumidity != null ? (
                                                                    <span className="font-bold text-slate-600">{row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1 })}%</span>
                                                                ) : (
                                                                    <span className="text-gray-400">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-6 py-3 text-sm font-mono text-center border-b border-gray-300 text-slate-600" style={{ fontFamily: 'Helvetica, Arial, sans-serif', backgroundColor: selectedSocioRetiroDetail === row.name ? 'rgba(59, 130, 246, 0.05)' : '', borderTop: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderBottom: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '', borderRight: selectedSocioRetiroDetail === row.name ? '3px solid #3b82f6' : '' }}>
                                                                {row.formattedLastDate}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    {/* Detail View (Integrated Movement Details Style) */}
                                    {(() => {
                                        const row = selectedSocioDetail ? withdrawalData.rows.find(r => r.name === selectedSocioDetail) : null;
                                        if (!row) return null;

                                        return (
                                            <div className="space-y-6 animate-fadeInUp mt-12 border-t-2 border-slate-100 pt-8" id="socio-detail-view">
                                                {/* Container Card */}
                                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                                    {/* Section 1: Header (Laucarseed Style - Grey Background + Shadow) */}
                                                    <div className="px-6 py-4 flex items-center justify-between bg-slate-50 border-b border-slate-200">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{row.name}</h3>

                                                            <div className="flex items-center gap-8 ml-auto mr-8">
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[13px] font-bold text-slate-800">{(row.netoPlanta / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tn planta</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[13px] font-bold text-slate-800">{row.viajes} viajes</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className={`text-[13px] font-bold ${row.mermaPercent >= -5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                        {row.mermaPercent > 0 ? '+' : ''}{row.mermaPercent.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                                                                    </span>
                                                                    <span className="text-[13px] font-medium text-slate-400">merma</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className={`text-[13px] font-bold ${row.avgHumidity != null && row.avgHumidity <= 14.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                        {row.avgHumidity != null ? row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}%
                                                                    </span>
                                                                    <span className="text-[13px] font-medium text-slate-400">hum. prom.</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedSocioDetail(null)}
                                                            className="transition-colors text-slate-400 hover:text-red-500 p-1"
                                                        >
                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
                                                            </svg>
                                                        </button>
                                                    </div>

                                                    {/* Section 2: Middle (Trip Table) - Added Header Shadow, No Border */}
                                                    <div className="overflow-hidden">
                                                        <div className="overflow-x-auto bg-white border-b border-slate-50" style={{ maxHeight: '400px' }}>
                                                            <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                                                <thead className="bg-[#0C8A52] sticky top-0 z-20 shadow-sm">
                                                                    <tr>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">N°</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Fecha</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Campo</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Destino</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Chofer</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Pat. Chasis</th>
                                                                        <th className="px-4 py-3 text-right text-[9px] font-black text-white uppercase tracking-widest border-0">Neto Campo (kg)</th>
                                                                        <th className="px-4 py-3 text-right text-[9px] font-black text-white uppercase tracking-widest border-0">Neto Planta (kg)</th>
                                                                        <th className="px-4 py-3 text-right text-[9px] font-black text-white uppercase tracking-widest border-0">Merma</th>
                                                                        <th className="px-4 py-3 text-center text-[9px] font-black text-white uppercase tracking-widest border-0">Hum.</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {withdrawalData.allTrips
                                                                        .filter(t => t.socio === row.name)
                                                                        .map((trip, tIdx) => (
                                                                            <tr key={trip.id} className="hover:bg-slate-50/80 transition-colors">
                                                                                <td className="px-4 py-3 text-[11px] font-black text-slate-300">{tIdx + 1}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">{trip.fecha ? trip.fecha.split('-').reverse().slice(0, 2).join('/') : '---'}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-900">{trip.campo}</td>
                                                                                <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{trip.destino}</td>
                                                                                <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{trip.chofer}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-400 uppercase">{trip.patente}</td>
                                                                                <td className="px-4 py-3 text-right font-mono font-black text-slate-600">
                                                                                    {trip.netoCampo.toLocaleString('es-AR')}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-mono font-black text-emerald-700">
                                                                                    {trip.netoPlanta.toLocaleString('es-AR')}
                                                                                </td>
                                                                                <td className={`px-4 py-3 text-right font-mono font-bold ${trip.merma < 0 ? 'text-amber-600' : 'text-emerald-500'}`}>
                                                                                    {trip.merma > 0 ? '+' : ''}{trip.merma.toLocaleString('es-AR')}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    {trip.humedad != null ? (
                                                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${trip.humedad >= 14 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                                            {trip.humedad.toLocaleString('es-AR', { minimumFractionDigits: 1 })}%
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-slate-300">—</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Section 3: Footer (KPI Boxes - Minimalist Style) */}
                                                    <div className="bg-slate-50/10 p-6 border-t border-slate-100">
                                                        <div className="flex flex-wrap justify-center gap-14">
                                                            {/* Box 1: Neto Campo */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Neto campo</p>
                                                                <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                    <span className="text-xl font-bold text-slate-800">
                                                                        {(row.netoCampo / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400">tn</span>
                                                                </div>
                                                            </div>

                                                            {/* Box 2: Neto Planta */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Neto planta</p>
                                                                <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                    <span className="text-xl font-bold text-slate-800">
                                                                        {(row.netoPlanta / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400">tn</span>
                                                                </div>
                                                            </div>

                                                            {/* Box 3: Diferencia */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Merma</p>
                                                                <div className={`flex items-baseline gap-1.5 font-bold whitespace-nowrap ${row.merma < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                                    <span className="text-xl">
                                                                        {row.merma > 0 ? '+' : ''}{(row.merma / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tn
                                                                    </span>
                                                                    <span className="text-[10px] font-bold opacity-80">({row.mermaPercent > 0 ? '+' : ''}{row.mermaPercent.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%)</span>
                                                                </div>
                                                            </div>

                                                            {/* Box 4: Humedad */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Humedad promedio</p>
                                                                <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                    <span className="text-xl font-bold text-slate-800">
                                                                        {row.avgHumidity != null ? row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400">%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Detail View for Retiros Galpón */}
                                    {(() => {
                                        const row = selectedSocioRetiroDetail ? withdrawalData.rows.find(r => r.name === selectedSocioRetiroDetail) : null;
                                        if (!row) return null;

                                        return (
                                            <div className="space-y-6 animate-fadeInUp mt-12 border-t-2 border-slate-100 pt-8" id="socio-retiro-detail-view">
                                                {/* Container Card */}
                                                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                                    {/* Section 1: Header (Matching Blue Theme) */}
                                                    <div className="px-6 py-4 flex items-center justify-between bg-blue-50 border-b border-blue-100">
                                                        <div className="flex items-center gap-4 flex-1">
                                                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{row.name}</h3>

                                                            <div className="flex items-center gap-8 ml-auto mr-8">
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[13px] font-bold text-slate-800">{(row.withdrawnWeight / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} tn retirada</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className="text-[13px] font-bold text-slate-800">{row.viajes} viajes</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                                                    <span className={`text-[13px] font-bold ${row.avgHumidity != null && row.avgHumidity <= 14.5 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                                                        {row.avgHumidity != null ? row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}%
                                                                    </span>
                                                                    <span className="text-[13px] font-medium text-slate-400">hum. prom.</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                onClick={() => setSelectedSocioRetiroDetail(null)}
                                                                className="transition-colors text-slate-400 hover:text-red-500 p-1"
                                                                title="Cerrar detalle"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                                    <line x1="18" y1="18" x2="6" y2="6"></line>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Section 2: Middle (Trip Table) - Blue Header Shadow */}
                                                    <div className="overflow-hidden">
                                                        <div className="overflow-x-auto bg-white border-b border-slate-100" style={{ maxHeight: '400px' }}>
                                                            <table className="min-w-full divide-y divide-slate-100 border-separate border-spacing-0">
                                                                <thead className="bg-[#2563eb] sticky top-0 z-20 shadow-[0_4px_12px_-4px_rgba(0,0,0,0.25)]">
                                                                    <tr>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">N°</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Fecha</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Origen</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Destino</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Chofer</th>
                                                                        <th className="px-4 py-3 text-left text-[9px] font-black text-white uppercase tracking-widest border-0">Patente</th>
                                                                        <th className="px-4 py-3 text-right text-[9px] font-black text-white uppercase tracking-widest border-0">Cantidad (kg)</th>
                                                                        <th className="px-4 py-3 text-center text-[9px] font-black text-white uppercase tracking-widest border-0">Hum.</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-slate-50">
                                                                    {withdrawalData.allTrips
                                                                        .filter(t => t.socio === row.name)
                                                                        .map((trip, tIdx) => (
                                                                            <tr key={trip.id} className="hover:bg-blue-50/30 transition-colors">
                                                                                <td className="px-4 py-3 text-[11px] font-black text-slate-300">{tIdx + 1}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-600 whitespace-nowrap">{trip.fecha ? trip.fecha.split('-').reverse().slice(0, 2).join('/') : '---'}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-bold text-slate-900">{trip.campo}</td>
                                                                                <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{trip.destino}</td>
                                                                                <td className="px-4 py-3 text-[10px] font-black text-slate-500 uppercase tracking-tighter">{trip.chofer}</td>
                                                                                <td className="px-4 py-3 text-[11px] font-mono font-bold text-slate-400 uppercase">{trip.patente}</td>
                                                                                <td className="px-4 py-3 text-right font-mono font-black text-slate-600">
                                                                                    {trip.netoPlanta.toLocaleString('es-AR')}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-center">
                                                                                    {trip.humedad != null ? (
                                                                                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${trip.humedad >= 14 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                                                                                            {trip.humedad.toLocaleString('es-AR', { minimumFractionDigits: 1 })}%
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-slate-300">—</span>
                                                                                    )}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    {withdrawalData.allTrips.filter(t => t.socio === row.name).length === 0 && (
                                                                        <tr>
                                                                            <td colSpan={8} className="px-4 py-12 text-center text-sm italic text-slate-400 font-medium">
                                                                                No hay movimientos de retiro registrados específicamente para {row.name}
                                                                            </td>
                                                                        </tr>
                                                                    )}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    {/* Section 3: Footer (Simplified KPI Boxes for Retiros) */}
                                                    <div className="bg-slate-50/10 p-6 border-t border-slate-100">
                                                        <div className="flex flex-wrap justify-start gap-14">
                                                            {/* Box 1: Cantidad Retirada Acumulada */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Cantidad retirada</p>
                                                                <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                    <span className="text-xl font-bold text-slate-800">
                                                                        {(row.withdrawnWeight / 1000).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400">tn</span>
                                                                </div>
                                                            </div>

                                                            {/* Box 2: Humedad Promedio */}
                                                            <div className="bg-white border border-slate-200/60 rounded-xl py-1.5 px-5 flex flex-col justify-between min-h-[56px] w-[175px]">
                                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Humedad promedio</p>
                                                                <div className="flex items-baseline gap-1 whitespace-nowrap">
                                                                    <span className="text-xl font-bold text-slate-800">
                                                                        {row.avgHumidity != null ? row.avgHumidity.toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '—'}
                                                                    </span>
                                                                    <span className="text-[11px] font-bold text-slate-400">%</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
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
                                <div ref={summaryScrollRef} className="overflow-x-auto rounded-lg border border-gray-400">
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
                                            {withdrawalData.rows.filter(r => r.name !== 'GALPONES').map((row, idx) => (
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
                                                        {(withdrawalData.totalPlanta > 0 ? (row.netoPlanta / withdrawalData.totalPlanta) * 100 : 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
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

                                <div ref={matrixScrollRef} className="overflow-x-auto rounded-lg border border-gray-400">
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
                                            {withdrawalData.matrix.rows.filter(r => r.partnerName !== 'GALPONES').map((mRow, idx) => (
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
                                {(() => {
                                    // Custom calculation for "Partner-only" evolution to match old version
                                    let partnerAcc = 0;
                                    const partnersToInclude = (withdrawalData.evolution.partners || []).filter(p => p !== 'GALPONES');
                                    const partnerEvolutionRows = [...(withdrawalData.evolution.chartData || [])].map(evo => {
                                        const pWeight = partnersToInclude.reduce((sum, p) => sum + (evo.partnerWeightsCampo?.[p] || 0), 0);
                                        partnerAcc += pWeight;
                                        return {
                                            ...evo,
                                            partnerNetoCampo: pWeight,
                                            partnerNetoCampoAcumulado: partnerAcc
                                        };
                                    });

                                    return (
                                        <div className="space-y-8">
                                            <h3 className="text-xl font-bold text-slate-800 border-b-2 border-emerald-500 pb-2 inline-block">Evolución Diaria</h3>

                                            <div className="bg-white p-6 rounded-xl border border-slate-200">
                                                <ResponsiveContainer width="100%" height={400}>
                                                    <ComposedChart data={partnerEvolutionRows} margin={{ top: 20, right: 40, left: 20, bottom: 20 }}>
                                                        <CartesianGrid yAxisId="left" strokeDasharray="4 6" vertical={false} stroke="#94a3b8" />
                                                        <XAxis
                                                            dataKey="date"
                                                            tickFormatter={(date) => new Date(`${date}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                            axisLine={{ stroke: '#cbd5e1' }}
                                                            tickLine={false}
                                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                                            dy={10}
                                                        />
                                                        <YAxis
                                                            yAxisId="left"
                                                            axisLine={{ stroke: '#cbd5e1' }}
                                                            tickLine={false}
                                                            tick={{ fill: '#64748b', fontSize: 12 }}
                                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                                        />
                                                        <YAxis
                                                            yAxisId="right"
                                                            orientation="right"
                                                            axisLine={{ stroke: '#cbd5e1' }}
                                                            tickLine={false}
                                                            tick={{ fill: '#0C8A52', fontSize: 12, fontWeight: 'bold' }}
                                                            tickFormatter={(val) => val.toLocaleString('es-AR')}
                                                        />
                                                        <Tooltip
                                                            isAnimationActive={false}
                                                            cursor={{ fill: '#f8fafc' }}
                                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                            formatter={(value: any, name: any) => [(value ?? 0).toLocaleString('es-AR'), name]}
                                                            labelFormatter={(label) => new Date(`${label}T12:00:00`).toLocaleDateString('es-AR')}
                                                        />
                                                        <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                                                        <Bar yAxisId="left" dataKey="partnerNetoCampo" name="Neto Campo Diario (kg)" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                                                        <Line yAxisId="right" type="monotone" dataKey="partnerNetoCampoAcumulado" name="Acumulado (kg)" stroke="#0C8A52" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </div>

                                            <div className="overflow-x-auto rounded-lg border border-gray-400 mt-6">
                                                <table className="min-w-full border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th
                                                                colSpan={5 + partnersToInclude.length}
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
                                                            {partnersToInclude.map(partner => (
                                                                <th key={partner} className="px-6 py-3 text-center text-[11px] font-bold text-white uppercase tracking-wider border border-gray-400 min-w-[120px]" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                                    {partner}
                                                                </th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...partnerEvolutionRows].reverse().map((row, idx) => (
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
                                                                    {row.partnerNetoCampo.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                </td>
                                                                <td className="px-6 py-3 text-sm font-mono text-gray-700 text-right whitespace-nowrap border border-gray-300" style={{ fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                                    {row.netoPlanta.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                </td>
                                                                <td className="px-6 py-3 text-sm font-mono font-black text-right whitespace-nowrap border border-gray-300" style={{ color: '#0C8A52', fontFamily: 'Helvetica, Arial, sans-serif' }}>
                                                                    {row.partnerNetoCampoAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                                </td>
                                                                {partnersToInclude.map(partner => (
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
                                    );
                                })()}
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
                                    <CartesianGrid strokeDasharray="4 6" vertical={false} stroke="#94a3b8" />
                                    <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                    <YAxis axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                                    <Tooltip
                                        isAnimationActive={false}
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
                                        isAnimationActive={false}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                </PieChart>
                            )}
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pin Width Toggle - Professional SVG Toggle in corner vertex */}
                <button
                    onClick={() => setIsPinned(!isPinned)}
                    className={`absolute bottom-4 right-4 z-50 transition-all hover:scale-110 active:scale-95 outline-none select-none ${isPinned ? 'text-emerald-500 drop-shadow-[0_0_3px_rgba(16,185,129,0.4)] opacity-100' : 'text-slate-400 opacity-40 hover:opacity-100'
                        }`}
                >
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill={isPinned ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <line x1="12" y1="17" x2="12" y2="22"></line>
                        <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
                    </svg>
                </button>
            </div>
        </div>
    );
}
