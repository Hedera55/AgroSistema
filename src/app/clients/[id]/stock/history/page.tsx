'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { InventoryMovement } from '@/types';
import { supabase } from '@/lib/supabase';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';

export default function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [productsKey, setProductsKey] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const scrollRef = useHorizontalScroll();
    const [ordersKey, setOrdersKey] = useState<Record<string, string>>({});
    const [warehousesKey, setWarehousesKey] = useState<Record<string, string>>({});

    async function loadData() {
        const [allMovements, allProducts, allOrders, allWarehouses] = await Promise.all([
            db.getAll('movements'),
            db.getAll('products'),
            db.getAll('orders'),
            db.getAll('warehouses')
        ]);

        const clientMovements = allMovements
            .filter((m: InventoryMovement) => m.clientId === clientId)
            .sort((a: InventoryMovement, b: InventoryMovement) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        // Map product prices for easier lookup
        const priceMap: Record<string, number> = {};
        allProducts.forEach((p: any) => {
            if (p.price) priceMap[p.id] = p.price;
        });

        // Map orders to identify Sowing types
        const orderTypeMap: Record<string, string> = {};
        allOrders.forEach((o: any) => {
            orderTypeMap[o.id] = o.type;
        });

        // Map warehouses for consolidation
        const wMap: Record<string, string> = {};
        allWarehouses.forEach((w: any) => {
            wMap[w.id] = w.name;
        });

        setMovements(clientMovements);
        setProductsKey(priceMap);
        setOrdersKey(orderTypeMap);
        setWarehousesKey(wMap);
        setLoading(false);
    }

    const handleDeleteMovement = async (id: string, partnerId?: string) => {
        if (!confirm('¿Eliminar este movimiento? (No afectará al stock actual, solo al historial)')) return;

        try {
            await db.delete('movements', id);
            if (partnerId) {
                await db.delete('movements', partnerId);
            }
            await loadData();
        } catch (error) {
            console.error('Error deleting movement:', error);
            alert('Error al eliminar');
        }
    };

    useEffect(() => {
        loadData();
    }, [clientId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, movementId: string) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        setUploadingId(movementId);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${clientId}/facturas/${movementId}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('facturas')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
            const publicUrl = publicUrlData.publicUrl;

            // Update movement in DB
            const movement = movements.find(m => m.id === movementId);
            if (movement) {
                await db.put('movements', {
                    ...movement,
                    facturaImageUrl: publicUrl,
                    synced: false,
                    updatedAt: new Date().toISOString()
                });
                await loadData(); // Refresh UI
            }
        } catch (error) {
            console.error('Error uploading factura:', error);
            alert('Error al subir la factura');
        } finally {
            setUploadingId(null);
            // Reset input
            e.target.value = '';
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return {
            date: date.toLocaleDateString('es-AR'),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                .toLowerCase()
                .replace(' am', ' a.m.')
                .replace(' pm', ' p.m.')
        };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/clients/${clientId}/stock`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Galpón</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Historial de Movimientos</h1>
                    <p className="text-slate-500 mt-1">Ingresos y egresos de productos.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando historial...</div>
                ) : movements.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-4xl mb-2">📜</div>
                        <h3 className="text-lg font-medium text-slate-900">Sin movimientos</h3>
                        <p className="text-slate-500">No hay registros de ingresos o egresos todavía.</p>
                    </div>
                ) : (
                    <div
                        className="overflow-x-auto"
                        ref={scrollRef}
                    >
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Marca</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Nombre Comercial</th>
                                    <th className="px-6 py-2 text-center text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">P. Unitario</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Monto Total</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Notas</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Galpón</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {(() => {
                                    const groupedMovements: any[] = [];
                                    const processedIds = new Set();

                                    movements.forEach((m: InventoryMovement) => {
                                        if (processedIds.has(m.id)) return;

                                        if (m.referenceId?.startsWith('MOVE-')) {
                                            const partner = movements.find((p: InventoryMovement) =>
                                                p.id !== m.id &&
                                                p.referenceId === m.referenceId &&
                                                p.productId === m.productId
                                            );

                                            if (partner) {
                                                const outM = m.type === 'OUT' ? m : partner;
                                                const inM = m.type === 'IN' ? m : partner;

                                                groupedMovements.push({
                                                    ...outM,
                                                    isTransfer: true,
                                                    originName: warehousesKey[outM.warehouseId || ''] || 'Desconocido',
                                                    destName: warehousesKey[inM.warehouseId || ''] || 'Desconocido',
                                                    partnerId: partner.id
                                                });

                                                processedIds.add(m.id);
                                                processedIds.add(partner.id);
                                                return;
                                            }
                                        }

                                        groupedMovements.push(m);
                                        processedIds.add(m.id);
                                    });

                                    return groupedMovements.map((m) => {
                                        const { date, time } = formatDate(m.createdAt || m.date);
                                        const isConsolidated = m.items && m.items.length > 0;

                                        // Determine Label and Tooltip
                                        let label = 'EGRESO-R';
                                        let labelClass = 'bg-orange-100 text-orange-800';
                                        let tooltip = 'Retiro de stock';

                                        if (m.isTransfer) {
                                            label = 'TRANSFERENCIA';
                                            labelClass = 'bg-indigo-100 text-indigo-800';
                                            tooltip = 'Traslado entre galpones';
                                        } else if (m.type === 'IN') {
                                            label = 'INGRESO-C';
                                            labelClass = 'bg-orange-100 text-orange-800';
                                            tooltip = isConsolidated ? 'Compra multi-producto' : 'Compra';
                                        } else if (m.type === 'HARVEST') {
                                            label = 'INGRESO-CC';
                                            labelClass = 'bg-lime-100 text-lime-800';
                                            tooltip = 'Cosecha';
                                        } else if (m.type === 'SALE') {
                                            label = 'EGRESO-V';
                                            labelClass = 'bg-blue-100 text-blue-800';
                                            tooltip = 'Venta';
                                        } else if (m.type === 'OUT') {
                                            // Check if it's Sowing
                                            const orderType = ordersKey[m.referenceId];
                                            if (orderType === 'SOWING') {
                                                label = 'EGRESO-S';
                                                labelClass = 'bg-emerald-100 text-emerald-800';
                                                tooltip = 'Siembra';
                                            }
                                        }

                                        // Calculate value - ONLY for compras (IN) and ventas (SALE)
                                        let totalValue = 0;
                                        let unitPrice = 0;
                                        let isEstimate = false;
                                        let showValue = false;

                                        if (m.type === 'IN' && !m.isTransfer) {
                                            if (isConsolidated) {
                                                totalValue = m.items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * parseFloat(item.quantity)), 0);
                                            } else {
                                                unitPrice = m.purchasePrice !== undefined ? m.purchasePrice : 0;
                                                totalValue = unitPrice * m.quantity;
                                            }
                                            showValue = true;
                                        } else if (m.type === 'SALE') {
                                            unitPrice = m.salePrice !== undefined ? m.salePrice : 0;
                                            totalValue = unitPrice * m.quantity;
                                            showValue = true;
                                        }

                                        const priceLabel = m.type === 'IN' ? 'Precio de compra' : 'Precio de venta';
                                        const valueTooltip = isConsolidated
                                            ? 'Total de la compra consolidada'
                                            : `${priceLabel}: USD ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${m.unit}`;

                                        return (
                                            <React.Fragment key={m.id}>
                                                <tr className="hover:bg-slate-50 group transition-colors">
                                                    <td className="px-6 py-2 whitespace-nowrap">
                                                        <div className="text-slate-900 font-medium">{date}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono uppercase tracking-tighter">{time}</div>
                                                    </td>
                                                    <td className="px-6 py-2 font-bold text-slate-900">
                                                        {isConsolidated ? (
                                                            <div className="flex items-center gap-2">
                                                                <span className={m.type === 'IN' ? 'text-red-700' : 'text-emerald-700'}>Varios</span>
                                                                <span className="text-[10px] text-slate-400 font-normal uppercase tracking-tighter whitespace-nowrap">({m.items.length} prod)</span>
                                                            </div>
                                                        ) : m.productName}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">
                                                        {isConsolidated ? '-' : (m.productBrand || '-')}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">
                                                        {isConsolidated ? '-' : (m.productCommercialName || '-')}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-center">
                                                        <span
                                                            title={tooltip}
                                                            className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${labelClass}`}
                                                        >
                                                            {label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-right font-mono font-bold text-slate-700">
                                                        {isConsolidated ? (
                                                            <span className="text-slate-300">---</span>
                                                        ) : (
                                                            <>
                                                                {(m.type === 'IN' || m.type === 'HARVEST' || m.isTransfer) ? '+' : '-'}{m.quantity} <span className="text-[10px] text-slate-400 font-normal uppercase">{m.unit}</span>
                                                            </>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-right font-mono text-slate-600">
                                                        {(!isConsolidated && showValue) ? (
                                                            <>USD {unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>
                                                        ) : (
                                                            <span className="text-slate-300">---</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-right font-mono text-slate-900 font-bold">
                                                        {showValue ? (
                                                            <span title={valueTooltip} className={m.type === 'IN' ? 'text-red-500' : (m.type === 'SALE' ? 'text-emerald-600' : '')}>
                                                                USD {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                {isEstimate && <span className="text-slate-400 text-[10px] ml-1">*</span>}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300">-</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 text-slate-500 max-w-xs truncate text-[11px] leading-relaxed">
                                                        {m.notes || '-'}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-slate-400 font-medium text-[11px] tracking-tight">
                                                        {m.createdBy || 'Sistema'}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap">
                                                        {m.isTransfer ? (
                                                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-tight">
                                                                <span className="text-slate-500">{m.originName}</span>
                                                                <span className="text-slate-300">→</span>
                                                                <span className="text-emerald-600">{m.destName}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 text-[11px] font-medium">{warehousesKey[m.warehouseId || ''] || '-'}</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {m.type !== 'HARVEST' && (
                                                                m.facturaImageUrl ? (
                                                                    <a
                                                                        href={m.facturaImageUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        title="Ver factura"
                                                                        className="inline-block"
                                                                    >
                                                                        <button
                                                                            className="w-8 h-8 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 rounded-lg text-xs font-bold transition-all flex items-center justify-center shadow-sm"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                                        </button>
                                                                    </a>
                                                                ) : (
                                                                    <div className="inline-block relative">
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*,application/pdf"
                                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                                                                            onChange={(e) => handleFileUpload(e, m.id)}
                                                                            disabled={uploadingId === m.id}
                                                                            title="Subir factura faltante"
                                                                        />
                                                                        <button
                                                                            className={`w-8 h-8 bg-white border border-slate-200 text-slate-400 rounded-lg text-xs font-bold flex items-center justify-center transition-all ${uploadingId === m.id ? 'opacity-50 cursor-wait' : 'hover:bg-slate-50 hover:border-emerald-200 hover:text-emerald-500'}`}
                                                                        >
                                                                            {uploadingId === m.id ? '...' : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>}
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteMovement(m.id, m.partnerId)}
                                                                className="w-8 h-8 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-2"
                                                                title="Eliminar movimiento"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isConsolidated && m.items.map((it: any, i: number) => (
                                                    <tr key={`${m.id}-item-${i}`} className="bg-slate-50/30 hover:bg-slate-100/50 transition-colors border-l-4 border-l-emerald-500/30">
                                                        <td className="px-6 py-1 whitespace-nowrap"></td>
                                                        <td className="px-6 py-1 text-[11px] font-bold text-slate-600 relative pl-10">
                                                            <div className="absolute left-6 top-0 h-1/2 w-px bg-slate-200"></div>
                                                            <div className="absolute left-6 top-1/2 w-2 h-px bg-slate-200"></div>
                                                            {i < m.items.length - 1 && <div className="absolute left-6 top-1/2 bottom-0 w-px bg-slate-200"></div>}
                                                            {it.productName}
                                                        </td>
                                                        <td className="px-6 py-1 text-[11px] text-slate-400">{it.productBrand || '-'}</td>
                                                        <td className="px-6 py-1 text-[11px] text-slate-500">{it.productCommercialName || '-'}</td>
                                                        <td className="px-6 py-1"></td>
                                                        <td className="px-6 py-1 text-right font-mono text-[11px] text-slate-500">
                                                            {it.quantity} <span className="text-[9px] text-slate-400 font-normal uppercase">{it.unit || m.unit}</span>
                                                        </td>
                                                        <td className="px-6 py-1 text-right font-mono text-[11px] text-slate-500">
                                                            USD {parseFloat(it.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`px-6 py-1 text-right font-mono text-[11px] font-bold ${m.type === 'IN' ? 'text-red-500/80' : 'text-emerald-600/80'}`}>
                                                            USD {(parseFloat(it.price) * parseFloat(it.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-1" colSpan={4}></td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="flex justify-end pr-2 pb-4">
                <Link
                    href={`/clients/${clientId}/stock`}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                >
                    Volver
                </Link>
            </div>
        </div>
    );
}
