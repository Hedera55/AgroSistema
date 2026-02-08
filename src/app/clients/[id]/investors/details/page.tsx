'use client';

import { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Client, InventoryMovement, Order, Product, Lot } from '@/types';
import { useInventory, useClientMovements } from '@/hooks/useInventory';
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
    const [reportType, setReportType] = useState<'LOTS' | 'COMPANY'>('LOTS');

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

        sortedMovements.forEach(m => {
            if (m.type === 'IN') {
                if (!productPurchases[m.productId]) {
                    productPurchases[m.productId] = { totalQty: 0, totalCost: 0 };
                }
                const product = products.find(p => p.id === m.productId);
                const price = m.purchasePrice ?? product?.price ?? 0;
                productPurchases[m.productId].totalQty += m.quantity;
                productPurchases[m.productId].totalCost += (m.quantity * price);
                map[m.productId] = productPurchases[m.productId].totalCost / productPurchases[m.productId].totalQty;
            }
        });

        products.forEach(p => {
            if (!map[p.id]) map[p.id] = p.price || 0;
        });

        return map;
    }, [movements, products]);

    // Calculate Average Sale Price per Crop
    const avgSalePriceMap = useMemo(() => {
        const map: Record<string, number> = {};
        const cropSales: Record<string, { totalQty: number, totalCost: number }> = {};

        movements.forEach(m => {
            if (m.type === 'SALE') {
                const product = products.find(p => p.id === m.productId);
                const crop = m.crop || product?.name || 'Varios';
                if (!cropSales[crop]) {
                    cropSales[crop] = { totalQty: 0, totalCost: 0 };
                }
                cropSales[crop].totalQty += m.quantity;
                cropSales[crop].totalCost += (m.quantity * (m.salePrice || 0));
                map[crop] = cropSales[crop].totalCost / cropSales[crop].totalQty;
            }
        });

        return map;
    }, [movements, products]);

    const formatLedgerDate = (dateStr: string, timeStr?: string) => {
        if (!dateStr) return { date: '-', time: '-' };

        let day = '-', month = '-', year = '-';
        let formattedTime = '-';

        const dateObj = new Date(dateStr);
        if (!isNaN(dateObj.getTime())) {
            day = String(dateObj.getDate()).padStart(2, '0');
            month = String(dateObj.getMonth() + 1).padStart(2, '0');
            year = String(dateObj.getFullYear());

            if (!timeStr && dateStr.includes('T')) {
                const h = dateObj.getHours();
                const m = String(dateObj.getMinutes()).padStart(2, '0');
                const ampm = h >= 12 ? 'p.m.' : 'a.m.';
                const displayHours = h % 12 || 12;
                formattedTime = `${displayHours}:${m} ${ampm}`;
            }
        } else if (dateStr.includes('-')) {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length === 3) {
                year = parts[0];
                month = parts[1];
                day = parts[2];
            }
        }

        if (timeStr) {
            const timePart = timeStr.split(' ')[0];
            const [h, m] = timePart.split(':');
            if (h && m) {
                const hours = parseInt(h);
                const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
                const displayHours = hours % 12 || 12;
                formattedTime = `${displayHours}:${m} ${ampm}`;
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

    const ledgerData = useMemo(() => {
        const data: any[] = [];

        if (reportType === 'COMPANY') {
            // Purchases (Direct Cash Out)
            movements.forEach(m => {
                const product = products.find(p => p.id === m.productId);
                const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');

                if (m.type === 'IN' && !isTransfer) {
                    let amount = 0;
                    let concept = '';
                    let detail = '';

                    if (m.productId === 'CONSOLIDATED' && m.items) {
                        amount = m.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 0)), 0);
                        concept = 'Compra de insumos (Consolidada)';
                        detail = `Inversión: ${m.items.length} productos`;
                    } else {
                        const price = m.purchasePrice ?? product?.price ?? 0;
                        amount = m.quantity * price;
                        concept = `Compra: ${product?.name || 'Insumo'}`;
                        detail = `Inversión: ${m.quantity} ${product?.unit || 'u.'} @ USD ${price.toLocaleString()}`;
                    }

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
                        detail
                    });
                } else if (m.type === 'SALE') {
                    const product = products.find(p => p.id === m.productId);
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
                        amount: -(m.quantity * (m.salePrice || 0)),
                        detail: `Ingreso por venta: ${m.quantity} ${product?.unit || 'u.'} @ USD ${(m.salePrice || 0).toLocaleString()}`
                    });
                }
            });

            // Service costs for the whole company
            orders.forEach(o => {
                const lot = lots.find(l => l.id === o.lotId);
                if (o.servicePrice && o.servicePrice > 0) {
                    data.push({
                        id: `${o.id}-labor-company`,
                        rawDate: o.appliedAt || o.date,
                        date: formatLedgerDate(o.appliedAt || o.date, o.time),
                        concept: `Servicio: ${o.type === 'HARVEST' ? 'Cosecha' : (o.type === 'SOWING' ? 'Siembra' : 'Pulverización')}`,
                        category: 'LABOR',
                        lote: lot?.name || '-',
                        crop: lot?.cropSpecies || '-',
                        seller: o.applicatorName || '-',
                        amount: o.servicePrice * o.treatedArea,
                        detail: `Orden #${o.orderNumber}. ${o.treatedArea} ha @ USD ${o.servicePrice.toLocaleString()}/ha`
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
                        detail: `Orden #${o.orderNumber} - ${o.treatedArea} ha @ USD ${o.servicePrice.toLocaleString()}/ha`
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
                        detail: `Orden #${o.orderNumber} - ${item.totalQuantity.toFixed(2)} ${item.unit} @ PPP USD ${pppPrice.toLocaleString()}`
                    });
                });
            });

            // Production Result (Harvests valued at Average Sale Price)
            movements.forEach(m => {
                if (m.type === 'HARVEST') {
                    const product = products.find(p => p.id === m.productId);
                    const lot = lots.find(l => l.id === m.lotId);
                    const crop = m.crop || product?.name || 'Varios';

                    let avgSalePrice = avgSalePriceMap[crop];
                    if (avgSalePrice === undefined) {
                        avgSalePrice = referencePrices[crop] || 0;
                        if (avgSalePrice === 0) {
                            setTimeout(() => requestReferencePrice(crop), 100);
                        }
                    }

                    data.push({
                        id: `${m.id}-production`,
                        rawDate: m.date,
                        date: formatLedgerDate(m.date, m.time),
                        concept: `Cosecha: ${crop}`,
                        category: 'INGRESO',
                        lote: lot?.name || '-',
                        crop: crop,
                        seller: '-',
                        amount: -(m.quantity * avgSalePrice),
                        detail: `Valuación cosecha: ${m.quantity} ${product?.unit || 'u.'} @ USD ${avgSalePrice.toLocaleString()} (Venta Promedio)`
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

        ledgerData.forEach(item => {
            if (item.lote && item.lote !== '-') lotsSet.add(item.lote);
            if (item.crop && item.crop !== '-') cropsSet.add(item.crop);
            if (item.category && item.category !== '-') categoriesSet.add(item.category);
            if (item.seller && item.seller !== '-') sellersSet.add(item.seller);
        });

        return {
            lots: Array.from(lotsSet).sort(),
            crops: Array.from(cropsSet).sort(),
            categories: Array.from(categoriesSet).sort(),
            sellers: Array.from(sellersSet).sort()
        };
    }, [ledgerData]);

    const filteredLedger = useMemo(() => {
        return ledgerData.filter(item => {
            if (reportType === 'COMPANY') {
                // Company view only filters by Category and Seller/Buyer if needed
                // But currently we don't have those filters visible for Company view in the UI header
                // However, they might be useful. For now, we only apply what's in the LOTS view
                // Actually, the user specifically said "We don't need a proveedor input in tabla de lotes"
                return true;
            }
            // For LOTS view:
            const matchLote = !filterLote || item.lote === filterLote;
            const matchCrop = !filterCrop || item.crop === filterCrop;
            const matchCategory = !filterCategory || item.category === filterCategory;
            // No seller filter for LOTS view
            return matchLote && matchCrop && matchCategory;
        });
    }, [ledgerData, filterLote, filterCrop, filterCategory, reportType]);

    const totals = useMemo(() => {
        let expenditure = 0;
        let income = 0;
        filteredLedger.forEach(item => {
            if (item.amount > 0) expenditure += item.amount;
            else income += Math.abs(item.amount);
        });
        return { expenditure, income, balance: income - expenditure };
    }, [filteredLedger]);

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
                </div>
            )}

            {/* The Ledger Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
                <div className="overflow-x-auto">
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
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="text-slate-300 text-4xl mb-4">🔍</div>
                                        <p className="text-slate-400 italic">No se encontraron registros.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredLedger.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50/80 transition-all border-l-4 border-transparent hover:border-emerald-400 group text-sm">
                                        <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-slate-400">
                                            <div className="flex flex-col">
                                                <span>{item.date.date}</span>
                                                <span className="text-[10px] text-slate-300 font-normal uppercase tracking-tighter">
                                                    {item.date.time}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-bold text-slate-900">{item.concept}</div>
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
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Footer Note */}
            <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest font-black max-w-2xl mx-auto leading-relaxed">
                {reportType === 'LOTS' ?
                    'Tabla de Lotes: Valuación económica basada en PPP (Precio Promedio Ponderado de compras) y Cosecha valuada a precio de venta promedio del ejercicio.' :
                    'Tabla de Empresa: Balance financiero directo basado en flujos de caja reales (Compras, Ventas y Pagos de Servicios).'
                }
            </p>
        </div>
    );
}
