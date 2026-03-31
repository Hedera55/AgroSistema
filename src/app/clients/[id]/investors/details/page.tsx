'use client';

import React, { use, useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Client, InventoryMovement, Order, Product, Lot } from '@/types';
import { useInventory, useClientMovements } from '@/hooks/useInventory';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { useOrders } from '@/hooks/useOrders';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function FinancialDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [client, setClient] = useState<Client | null>(null);
    const [lots, setLots] = useState<Lot[]>([]);
    const [farms, setFarms] = useState<any[]>([]);
    const { movements, loading: movementsLoading } = useClientMovements(id);
    const { products, loading: productsLoading } = useInventory();
    const { orders, loading: ordersLoading } = useOrders(id);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterLote, setFilterLote] = useState('');
    const [filterCrop, setFilterCrop] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterSeller, setFilterSeller] = useState('');
    const [filterPartner, setFilterPartner] = useState('');
    const [reportType, setReportType] = useState<'LOTS' | 'COMPANY'>('LOTS');
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const scrollRef = useHorizontalScroll();


    // User-provided reference prices for crops with no sales
    const [referencePrices, setReferencePrices] = useState<Record<string, number>>({});

    useEffect(() => {
        Promise.all([
            db.get('clients', id),
            db.getAll('farms'),
            db.getAll('lots')
        ]).then(([c, allFarms, allLots]) => {
            setClient(c || null);
            const clientFarms = allFarms.filter((f: any) => f.clientId === id);
            setFarms(clientFarms);
            const farmIds = new Set(clientFarms.map((f: any) => f.id));
            setLots(allLots.filter((l: Lot) => farmIds.has(l.farmId)));
            setLoading(false);
        });
    }, [id]);

    // Calculate Purchase PPP (Precio Promedio Ponderado)
    const pppPurchaseMap = useMemo(() => {
        const map: Record<string, number> = {};
        const productPurchases: Record<string, { totalQty: number, totalCost: number }> = {};
        const sortedMovements = [...movements].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const updateStat = (key: string, qty: number, val: number) => {
            if (!productPurchases[key]) productPurchases[key] = { totalQty: 0, totalCost: 0 };
            productPurchases[key].totalQty += qty;
            productPurchases[key].totalCost += val;
            map[key] = productPurchases[key].totalCost / productPurchases[key].totalQty;
        };

        sortedMovements.forEach(m => {
            if (m.type === 'IN') {
                if (m.items && m.items.length > 0) {
                    m.items.forEach((item: any) => {
                        // 1. Specific ID
                        const cost = item.quantity * (item.price || 0);
                        updateStat(item.productId, item.quantity, cost);
                        // 2. Generic Name (for fallback)
                        if (item.productName) {
                            updateStat(item.productName.toLowerCase().trim(), item.quantity, cost);
                        }
                    });
                } else {
                    // 1. Specific ID
                    const cost = m.quantity * (m.purchasePrice || 0);
                    updateStat(m.productId, m.quantity, cost);
                    // 2. Generic Name (for fallback)
                    if (m.productName) {
                        updateStat(m.productName.toLowerCase().trim(), m.quantity, cost);
                    }
                }
            }
        });

        return map;
    }, [movements, products]);

    // Calculate Average Sale Price per Crop
    const avgSalePriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        const productSales: Record<string, { totalQty: number, totalCost: number }> = {};

        const processSale = (key: string, qty: number, price: number) => {
            if (!key) return;
            if (!productSales[key]) productSales[key] = { totalQty: 0, totalCost: 0 };
            productSales[key].totalQty += qty;
            productSales[key].totalCost += (qty * price);
            map[key] = productSales[key].totalCost / productSales[key].totalQty;
        };

        movements.forEach(m => {
            if (m.type === 'SALE') {
                // 1. By Product ID
                if (m.productId) processSale(m.productId, m.quantity, m.salePrice || 0);

                // 2. By Crop/Name
                const nameKey = (m.crop || m.productName || 'Varios').toLowerCase().trim();
                processSale(nameKey, m.quantity, m.salePrice || 0);
            }
        });

        return map;
    }, [movements, products]);

    const formatLedgerDate = (dateStr: string, timeStr?: string) => {
        if (!dateStr) return { date: '-', time: '-' };

        let day = '-', month = '-', year = '-';
        let formattedTime = '-';

        // ALWAYS extract date via string splitting (timezone-safe)
        const datePart = dateStr.split('T')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parts[0]; month = parts[1]; day = parts[2];
            } else {
                // DD-MM-YYYY
                day = parts[0]; month = parts[1]; year = parts[2];
            }
        }

        // Extract time from ISO string if no explicit timeStr
        if (!timeStr && dateStr.includes('T')) {
            const tPart = dateStr.split('T')[1];
            const match = tPart?.match(/(\d+):(\d+)/);
            if (match) {
                // Use Date object ONLY for time (UTC→local conversion is correct for time)
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    const h = dateObj.getHours();
                    const m = String(dateObj.getMinutes()).padStart(2, '0');
                    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
                    const displayHours = h % 12 || 12;
                    formattedTime = `${displayHours}:${m} ${ampm}`;
                }
            }
        }

        if (timeStr) {
            const timePart = timeStr.split(' ')[0];
            const [h, m] = timePart.split(':');
            if (h && m) {
                const hours = parseInt(h);
                const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
                const displayHours = hours % 12 || 12;
                formattedTime = `${displayHours}:${m.split(' ')[0]} ${ampm}`;
            }
        }

        return {
            date: day !== '-' ? `${day}-${month}-${year}` : dateStr,
            time: formattedTime
        };
    };

    const requestReferencePrice = (crop: string) => {
        if (referencePrices[crop] !== undefined) return;

        const price = window.prompt(`No hay ventas de ${crop} para este año. Ingrese precio de referencia (USD/Unidad):`);
        if (price !== null) {
            const numPrice = parseFloat(price);
            if (!isNaN(numPrice)) {
                setReferencePrices(prev => ({ ...prev, [crop]: numPrice }));
            }
        }
    };

    const parseInvestors = (investors: any[], name?: string) => {
        if (investors && investors.length > 0) return investors;
        if (!name) return [];

        let pName = name;
        if (pName.startsWith('{')) {
            try {
                const parsed = JSON.parse(pName);
                if (parsed && parsed.name) pName = parsed.name;
            } catch (e) { }
        }
        return [{ name: pName, percentage: 100 }];
    };

    const ledgerData = useMemo(() => {
        const data: any[] = [];

        if (reportType === 'COMPANY') {
            // Movements (Cash Flow)
            movements.forEach(m => {
                const product = products.find(p => p.id === m.productId);
                const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
                if (isTransfer) return;

                // Support both legacy (IN/OUT) and new types (PURCHASE/SALE/SERVICE)
                if (m.type === 'IN' || m.type === 'PURCHASE') {
                    let amount = 0;
                    let concept = '';
                    let detail = '';

                    if (m.items && m.items.length > 0) {
                        amount = m.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 0)), 0);
                        concept = 'Compra de insumos (Consolidada)';
                        detail = `Inversión: ${m.items.length} productos`;
                    } else {
                        const price = m.purchasePrice || 0;
                        amount = m.quantity * price;
                        concept = `Compra: ${product?.name || 'Insumo'}`;
                        detail = `Inversión: ${m.quantity} ${product?.unit || 'u.'} @ USD ${price.toLocaleString()}`;
                    }

                    if (amount > 0) {
                        data.push({
                            id: m.id,
                            rawDate: m.date,
                            date: formatLedgerDate(m.date, m.time),
                            concept,
                            category: product?.type || 'OTROS',
                            lote: '-',
                            crop: '-',
                            seller: m.sellerName || 'Directo',
                            amount,
                            detail,
                            investors: parseInvestors(m.investors || [], m.investorName),
                            items: m.items || []
                        });
                    }
                } else if (m.type === 'SERVICE') {
                    const amount = m.amount || (m.quantity * (m.purchasePrice || 0));
                    if (amount > 0) {
                        data.push({
                            id: m.id,
                            rawDate: m.date,
                            date: formatLedgerDate(m.date, m.time),
                            concept: 'Pago de Servicio',
                            category: 'SERVICIOS',
                            lote: '-',
                            crop: '-',
                            seller: m.sellerName || m.contractorName || '-',
                            amount,
                            detail: m.notes || 'Pago de servicio ad-hoc',
                            investors: parseInvestors(m.investors || [], m.investorName),
                            items: m.items || []
                        });
                    }
                } else if (m.type === 'SALE') {
                    const amount = m.quantity * (m.salePrice || 0);
                    if (amount > 0) {
                        const lot = lots.find(l => l.id === m.lotId);
                        data.push({
                            id: m.id,
                            rawDate: m.date,
                            date: formatLedgerDate(m.date, m.time),
                            concept: `Venta: ${product?.name || 'Grano'}`,
                            category: 'INGRESO',
                            lote: lot?.name || '-',
                            crop: m.crop || '-',
                            seller: m.sellerName || '-',
                            amount: -amount, // Income is negative in an expense-oriented view (reduces net cost)
                            detail: `Ingreso por venta: ${m.quantity} ${product?.unit || 'u.'} @ USD ${(m.salePrice || 0).toLocaleString()}`,
                            investors: parseInvestors(m.investors || [], m.investorName),
                            items: m.items || []
                        });
                    }
                }
            });

            // Service costs for the whole company
            orders.forEach(o => {
                const lot = lots.find(l => l.id === o.lotId);

                // Enhanced Crop Resolution for Harvests types
                // If lot is cleared (no cropSpecies), try to retrieve it from the order notes
                let cropDisplay = lot?.cropSpecies || '-';
                if (o.type === 'HARVEST' && cropDisplay === '-' && o.notes?.startsWith('Cosecha de ')) {
                    const match = o.notes.match(/Cosecha de (.+) en /);
                    if (match && match[1]) {
                        cropDisplay = match[1];
                    }
                }

                if (o.servicePrice && o.servicePrice > 0) {
                    data.push({
                        id: `${o.id}-labor-company`,
                        rawDate: o.appliedAt || o.date,
                        date: formatLedgerDate(o.appliedAt || o.date, o.time),
                        // Use the specific note for Harvests if available (e.g. "Cosecha de Soja en Lote 1")
                        concept: `Servicio: ${o.type === 'HARVEST' ? (o.notes || 'Cosecha') : (o.type === 'SOWING' ? 'Siembra' : 'Pulverización')}`,
                        category: 'LABOR',
                        lote: lot?.name || '-',
                        crop: cropDisplay,
                        seller: o.applicatorName || '-',
                        amount: o.servicePrice * o.treatedArea,
                        detail: `Orden #${o.orderNumber}. ${o.treatedArea} ha @ USD ${o.servicePrice.toLocaleString()}/ha`,
                        investors: parseInvestors([], o.investorName),
                        items: []
                    });
                }
            });

        } else {
            // Consumption (Applied Costs)
            orders.forEach(o => {
                if (o.status !== 'DONE') return;
                const lot = lots.find(l => l.id === o.lotId);

                // 1. Labor Cost
                if (o.servicePrice && o.servicePrice > 0) {
                    data.push({
                        id: `${o.id}-labor-lot`,
                        rawDate: o.appliedAt || o.date,
                        date: formatLedgerDate(o.appliedAt || o.date, o.time),
                        concept: `Labor: ${o.type === 'HARVEST' ? 'Cosecha' : (o.type === 'SOWING' ? 'Siembra' : 'Pulverización')}`,
                        category: 'LABOR',
                        lote: lot?.name || 'Varios',
                        crop: lot?.cropSpecies || '-',
                        seller: o.applicatorName || '-',
                        amount: o.servicePrice * o.treatedArea,
                        detail: `Orden #${o.orderNumber} - ${o.treatedArea} ha @ USD ${o.servicePrice.toLocaleString()}/ha`,
                        investors: parseInvestors([], o.investorName),
                        items: []
                    });
                }

                // 2. Product Costs (PPP Value)
                o.items.forEach((item, idx) => {
                    const product = products.find(p => p.id === item.productId);
                    const pppPrice = pppPurchaseMap[item.productId] || 0;
                    const conceptPrefix = product?.type === 'SEED' ? 'Insumo (siembra)' : 'Insumo';

                    data.push({
                        id: `${o.id}-item-${idx}`,
                        rawDate: o.appliedAt || o.date,
                        date: formatLedgerDate(o.appliedAt || o.date, o.time),
                        concept: `${conceptPrefix}: ${product?.name || item.productName}`,
                        category: product?.type || 'OTROS',
                        lote: lot?.name || 'Varios',
                        crop: lot?.cropSpecies || '-',
                        seller: '-',
                        amount: item.totalQuantity * pppPrice,
                        detail: `Orden #${o.orderNumber} - ${item.totalQuantity.toFixed(2)} ${item.unit} @ PPP USD ${pppPrice.toLocaleString()}`,
                        investors: parseInvestors([], o.investorName),
                        items: []
                    });
                });
            });

            // Production Result (Harvests valued at Average Sale Price)
            movements.forEach(m => {
                if (m.type === 'HARVEST') {
                    const product = products.find(p => p.id === m.productId);
                    const lot = lots.find(l => l.id === m.lotId);

                    // Normalize names for lookup
                    const displayCrop = m.crop || product?.name || 'Varios';
                    const cropName = displayCrop.toLowerCase().trim();
                    const productId = m.productId || '';
                    const productName = (m.productName || product?.name || '').toLowerCase().trim();

                    // Priority 1: Average Sale Price (Specific ID -> Generic Crop Name)
                    let avgSalePrice = avgSalePriceMap[productId] || avgSalePriceMap[cropName] || 0;

                    if (!avgSalePrice || avgSalePrice === 0) {
                        // Priority 2: Weighted Average Purchase Price (Specific ID -> Generic Product Name)
                        avgSalePrice = pppPurchaseMap[productId] || pppPurchaseMap[productName] || 0;
                    }

                    if (avgSalePrice === 0) {
                        // Priority 3: Final fallback to Reference Price prompt
                        avgSalePrice = referencePrices[displayCrop] || 0;
                        if (avgSalePrice === 0) {
                            setTimeout(() => requestReferencePrice(displayCrop), 100);
                        }
                    }

                    data.push({
                        id: `${m.id}-production`,
                        rawDate: m.date,
                        date: formatLedgerDate(m.date, m.time),
                        concept: `Cosecha: ${displayCrop}`,
                        category: 'INGRESO',
                        lote: lot?.name || '-',
                        crop: displayCrop,
                        seller: '-',
                        amount: -(m.quantity * avgSalePrice),
                        detail: `Valuación cosecha: ${m.quantity} ${product?.unit || 'u.'} @ USD ${avgSalePrice.toLocaleString()} (${avgSalePriceMap[productId] || avgSalePriceMap[cropName] ? 'Venta Promedio' : (pppPurchaseMap[productId] || pppPurchaseMap[productName] ? 'Compra Promedio' : 'Ref. Manual')})`,
                        investors: parseInvestors(m.investors || [], m.investorName),
                        items: m.items || []
                    });
                }
            });
        }

        return data.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
    }, [reportType, movements, orders, products, lots, pppPurchaseMap, avgSalePriceMap, referencePrices]);

    // Unique options for dropdown filters
    const filterOptions = useMemo(() => {
        const lotsSet = new Set<string>();
        const cropsSet = new Set<string>();
        const categoriesSet = new Set<string>();
        const sellersSet = new Set<string>();
        const partnersSet = new Set<string>();

        ledgerData.forEach(item => {
            if (item.lote && item.lote !== '-') lotsSet.add(item.lote);
            if (item.crop && item.crop !== '-') cropsSet.add(item.crop);
            if (item.category && item.category !== '-') categoriesSet.add(item.category);
            if (item.seller && item.seller !== '-') sellersSet.add(item.seller);
            if (item.investors && item.investors.length > 0) {
                item.investors.forEach((inv: any) => {
                    if (inv.name.toLowerCase() !== 'sin asignar') {
                        partnersSet.add(inv.name);
                    }
                });
            }
        });

        return {
            lots: Array.from(lotsSet).sort(),
            crops: Array.from(cropsSet).sort(),
            categories: Array.from(categoriesSet).sort(),
            sellers: Array.from(sellersSet).sort(),
            partners: Array.from(partnersSet).sort()
        };
    }, [ledgerData]);

    const filteredLedger = useMemo(() => {
        return ledgerData.filter(item => {
            // Common filters
            const matchCategory = !filterCategory || item.category === filterCategory;

            let matchPartner = true;
            if (filterPartner === 'SIN_ASIGNAR') {
                // Only show expenses for partner filters
                if (item.amount <= 0) {
                    matchPartner = false;
                } else {
                    const hasNoInvestors = !item.investors || item.investors.length === 0;
                    const hasSinAsignarInvestor = item.investors?.some((inv: any) =>
                        !inv.name || inv.name.toLowerCase() === 'sin asignar'
                    );
                    matchPartner = hasNoInvestors || hasSinAsignarInvestor;
                }
            } else if (filterPartner) {
                // Only show expenses for partner filters
                if (item.amount <= 0) {
                    matchPartner = false;
                } else {
                    matchPartner = item.investors?.some((inv: any) => inv.name === filterPartner);
                }
            }

            if (reportType === 'COMPANY') {
                return matchCategory && matchPartner;
            }
            // For LOTS view:
            const matchLote = !filterLote || item.lote === filterLote;
            const matchCrop = !filterCrop || item.crop === filterCrop;
            return matchLote && matchCrop && matchCategory && matchPartner;
        });
    }, [ledgerData, filterLote, filterCrop, filterCategory, filterPartner, reportType]);

    const totals = useMemo(() => {
        let expenditure = 0;
        let income = 0;

        filteredLedger.forEach(item => {
            let itemAmount = item.amount;

            // If filtering by a specific partner, handle the split
            if (filterPartner) {
                const targetName = filterPartner === 'SIN_ASIGNAR' ? 'Sin Asignar' : filterPartner;
                const inv = item.investors?.find((i: any) => {
                    const iName = i.name || 'Sin Asignar';
                    return iName === targetName || (targetName === 'Sin Asignar' && (iName.toLowerCase() === 'sin asignar' || iName.toLowerCase() === 'sin_asignar'));
                });

                if (inv) {
                    itemAmount = item.amount * (inv.percentage / 100);
                } else if (filterPartner === 'SIN_ASIGNAR' && (!item.investors || item.investors.length === 0)) {
                    // It's fully unassigned
                    itemAmount = item.amount;
                } else {
                    // Partner doesn't participate in this specific movement (shouldn't happen with filteredLedger but safety first)
                    itemAmount = 0;
                }
            }

            if (itemAmount > 0) expenditure += itemAmount;
            else income += Math.abs(itemAmount);
        });

        return { expenditure, income, balance: income - expenditure };
    }, [filteredLedger, filterPartner]);

    const exportToCSV = () => {
        const headers = reportType === 'COMPANY'
            ? ['Fecha', 'Concepto', 'Rubro', 'Socio/Comprador', 'Monto USD', 'Observaciones']
            : ['Fecha', 'Concepto', 'Rubro', 'Lote', 'Cultivo', 'Monto USD', 'Observaciones'];

        const rows = filteredLedger.map(item => {
            if (reportType === 'COMPANY') {
                return [item.date, item.concept, item.category, item.seller, item.amount.toFixed(2), item.detail];
            }
            return [item.date, item.concept, item.category, item.lote, item.crop, item.amount.toFixed(2), item.detail];
        });

        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_${reportType.toLowerCase()}_${client?.name || 'cliente'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading || movementsLoading || productsLoading || ordersLoading) {
        return <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest animate-pulse">Generando reporte detallado...</div>;
    }

    const categories = Array.from(new Set(ledgerData.map(i => i.category))).sort();

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <Link href={`/clients/${id}/investors`} className="text-sm text-slate-500 hover:text-emerald-600 transition-colors mb-2 inline-block">
                        ← Volver a Contaduría
                    </Link>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                        {reportType === 'COMPANY' ? 'Tabla de Empresa' : 'Tabla de Lotes'}: {client?.name}
                    </h1>
                </div>
                <Button onClick={exportToCSV} variant="outline" className="gap-2 bg-white text-xs font-black uppercase tracking-widest border-slate-200">
                    📥 Descargar Excel (CSV)
                </Button>
            </div>

            {/* View Selection Row */}
            <div className="flex items-center justify-start gap-4 py-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Modo de Reporte</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => setReportType('LOTS')}
                        className={`px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${reportType === 'LOTS'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-[2px_2px_0px_rgba(0,0,0,0.1)]'
                            : 'bg-transparent text-slate-400 border-slate-300 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] hover:border-emerald-300 hover:shadow-[3px_3px_0px_rgba(0,0,0,0.1)]'
                            }`}
                    >
                        Tabla de Lotes
                    </button>
                    <button
                        onClick={() => setReportType('COMPANY')}
                        className={`px-4 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${reportType === 'COMPANY'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-[2px_2px_0px_rgba(0,0,0,0.1)]'
                            : 'bg-transparent text-slate-400 border-slate-300 shadow-[2px_2px_0px_rgba(0,0,0,0.05)] hover:border-emerald-300 hover:shadow-[3px_3px_0px_rgba(0,0,0,0.1)]'
                            }`}
                    >
                        Tabla de Empresa
                    </button>
                </div>
            </div>

            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total {reportType === 'COMPANY' ? 'Gastos / Inversión' : 'Costo Producción'} (-)</span>
                    <span className="text-lg font-black text-red-500">USD {totals.expenditure.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total {reportType === 'COMPANY' ? 'Ingresos / Ventas' : 'Producción Estimada'} (+)</span>
                    <span className="text-lg font-black text-emerald-600">USD {totals.income.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                <div className={`p-4 rounded-2xl border shadow-sm flex flex-col items-center ${totals.balance >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Resultado del Ejercicio</span>
                    <span className={`text-lg font-black ${totals.balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>USD {totals.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
            </div>

            {/* Filters Bar (Only for Lots) */}
            {reportType === 'LOTS' && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lote</label>
                            <select
                                value={filterLote}
                                onChange={e => setFilterLote(e.target.value)}
                                className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                            >
                                <option value="">Todos los lotes</option>
                                {filterOptions.lots.map(lote => (
                                    <option key={lote} value={lote}>{lote}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Cultivo</label>
                            <select
                                value={filterCrop}
                                onChange={e => setFilterCrop(e.target.value)}
                                className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                            >
                                <option value="">Todos los cultivos</option>
                                {filterOptions.crops.map(crop => (
                                    <option key={crop} value={crop}>{crop}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoría</label>
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                            >
                                <option value="">Todos los rubros</option>
                                {filterOptions.categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Socio</label>
                        <select
                            value={filterPartner}
                            onChange={e => setFilterPartner(e.target.value)}
                            className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                        >
                            <option value="">Todos los socios</option>
                            <option value="SIN_ASIGNAR">Sin asignar</option>
                            {filterOptions.partners.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}
            {/* Filters Bar (Only for Company) */}
            {reportType === 'COMPANY' && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Categoría</label>
                            <select
                                value={filterCategory}
                                onChange={e => setFilterCategory(e.target.value)}
                                className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                            >
                                <option value="">Todos los rubros</option>
                                {filterOptions.categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Socio</label>
                            <select
                                value={filterPartner}
                                onChange={e => setFilterPartner(e.target.value)}
                                className="w-full h-10 rounded-lg border-slate-300 text-sm focus:border-emerald-500 focus:ring-emerald-500 shadow-sm transition-all"
                            >
                                <option value="">Todos los socios</option>
                                <option value="SIN_ASIGNAR">Sin asignar</option>
                                {filterOptions.partners.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* The Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
                <div className="overflow-x-auto" ref={scrollRef}>
                    <table className="min-w-full divide-y divide-slate-100">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Fecha</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Concepto</th>
                                {reportType === 'LOTS' && (
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Lote / Cultivo</th>
                                )}
                                {reportType === 'COMPANY' && (
                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Socio / Comprador</th>
                                )}
                                <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Monto USD</th>
                                <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredLedger.length === 0 ? (
                                <tr>
                                    <td colSpan={reportType === 'LOTS' ? 6 : 5} className="px-6 py-20 text-center">
                                        <div className="text-slate-300 text-4xl mb-4">🔍</div>
                                        <p className="text-slate-400 italic">No se encontraron registros.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLedger.map((item) => {
                                    const hasItems = item.items && item.items.length > 0;
                                    const hasMultipleInvestors = item.investors && item.investors.length > 1;
                                    const needsExpansion = hasItems || hasMultipleInvestors;

                                    const isProductsExpanded = expandedRows.has(`${item.id}-products`);
                                    const isInvestorsExpanded = expandedRows.has(`${item.id}-investors`);
                                    const isAnyExpanded = isProductsExpanded || isInvestorsExpanded;

                                    return (
                                        <React.Fragment key={item.id}>
                                            <tr
                                                onClick={() => {
                                                    if (!needsExpansion) return;
                                                    const next = new Set(expandedRows);
                                                    if (isAnyExpanded) {
                                                        next.delete(`${item.id}-products`);
                                                        next.delete(`${item.id}-investors`);
                                                    } else {
                                                        if (hasItems) next.add(`${item.id}-products`);
                                                        if (hasMultipleInvestors) next.add(`${item.id}-investors`);
                                                    }
                                                    setExpandedRows(next);
                                                }}
                                                className={`hover:bg-slate-50/80 transition-all border-l-4 border-transparent hover:border-emerald-400 group text-sm ${needsExpansion ? 'cursor-pointer' : ''} ${isAnyExpanded ? 'bg-slate-50/50 border-emerald-400' : ''}`}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                                                    <div className="flex flex-col">
                                                        <span>{item.date.date}</span>
                                                        <span className="text-[10px] text-slate-300 font-normal uppercase tracking-tighter">
                                                            {item.date.time}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="font-bold text-slate-900 flex items-center gap-2">
                                                        {item.concept}
                                                    </div>
                                                    <div className="mt-1">
                                                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500 uppercase tracking-tighter border border-slate-200">
                                                            {item.category}
                                                        </span>
                                                    </div>
                                                </td>
                                                {reportType === 'LOTS' && (
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <div className="font-bold text-slate-700">{item.lote}</div>
                                                        <div className="text-[10px] text-emerald-600 font-black uppercase tracking-widest">{item.crop}</div>
                                                    </td>
                                                )}
                                                {reportType === 'COMPANY' && (
                                                    <td className="px-6 py-4 text-slate-500 italic font-medium whitespace-nowrap">
                                                        {item.seller}
                                                    </td>
                                                )}
                                                <td className={`px-6 py-4 text-right whitespace-nowrap font-mono font-black ${item.amount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                    {item.amount > 0 ? '-' : '+'}USD {Math.abs(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-400 italic font-medium max-w-xs truncate">
                                                    {item.detail}
                                                </td>
                                            </tr>
                                            {isAnyExpanded && (
                                                <tr className="bg-slate-50/50 border-l-4 border-emerald-400 border-b border-slate-100">
                                                    <td colSpan={reportType === 'LOTS' ? 6 : 5} className="px-6 py-3">
                                                        <div className="flex flex-col gap-3 pl-4">
                                                            {/* Products Section */}
                                                            {isProductsExpanded && hasItems && (
                                                                <div className="animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex justify-between items-center mb-1 bg-slate-100/50 px-2 py-0.5 rounded">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desglose de Productos / Ítems</span>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); const n = new Set(expandedRows); n.delete(`${item.id}-products`); setExpandedRows(n); }}
                                                                            className="text-slate-400 hover:text-red-500 transition-colors text-lg font-black leading-none pb-1"
                                                                            title="Cerrar sección"
                                                                        >
                                                                            -
                                                                        </button>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        {item.items.map((it: any, itIdx: number) => (
                                                                            <div key={itIdx} className="flex justify-between text-[11px] py-0.5 border-b border-slate-100/50 last:border-0 pr-2">
                                                                                <span className="font-bold text-slate-600">↳ {it.productName}</span>
                                                                                <span className="font-mono text-slate-400">
                                                                                    {it.quantity} {it.unit} @ USD {(it.price || 0).toLocaleString()}
                                                                                </span>
                                                                                <span className="font-mono font-bold text-slate-800">
                                                                                    USD {(parseFloat(it.price || 0) * parseFloat(it.quantity || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                            {/* Investors Section */}
                                                            {isInvestorsExpanded && hasMultipleInvestors && (
                                                                <div className="animate-fadeIn" onClick={(e) => e.stopPropagation()}>
                                                                    <div className="flex justify-between items-center mb-1 bg-slate-100/50 px-2 py-0.5 rounded">
                                                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Participación de Socios</span>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); const n = new Set(expandedRows); n.delete(`${item.id}-investors`); setExpandedRows(n); }}
                                                                            className="text-slate-400 hover:text-red-500 transition-colors text-lg font-black leading-none pb-1"
                                                                            title="Cerrar sección"
                                                                        >
                                                                            -
                                                                        </button>
                                                                    </div>
                                                                    <div className="space-y-0.5">
                                                                        {item.investors.map((inv: any, invIdx: number) => (
                                                                            <div key={invIdx} className="flex justify-between text-[11px] py-0.5 border-b border-slate-100/50 last:border-0 pr-2">
                                                                                <span className="font-bold text-slate-600">↳ {inv.name}</span>
                                                                                <span className="font-mono text-slate-400 bg-slate-100/50 px-1 rounded">{inv.percentage}%</span>
                                                                                <span className={`font-mono font-bold ${item.amount > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                                                                    USD {(Math.abs(item.amount) * (inv.percentage / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Note */}
            <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-black max-w-2xl mx-auto leading-relaxed mt-6">
                {reportType === 'LOTS' ?
                    'Tabla de Lotes: Valuación económica basada en PPP (Precio Promedio Ponderado de compras) y Cosecha valuada a precio de venta promedio del ejercicio.' :
                    'Tabla de Empresa: Balance financiero directo basado en flujos de caja reales (Compras, Ventas y Pagos de Servicios).'
                }
            </p>
        </div>
    );
}
