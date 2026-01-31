'use client';

import { use, useEffect, useState } from 'react';
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Monto Total</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Galpón</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase"></th>
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
                                        const { date, time } = formatDate(m.date);

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
                                            labelClass = 'bg-green-100 text-green-800';
                                            tooltip = 'Compra';
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
                                            unitPrice = m.purchasePrice !== undefined ? m.purchasePrice : 0;
                                            totalValue = unitPrice * m.quantity;
                                            showValue = true; // Always show even if 0
                                        } else if (m.type === 'SALE') {
                                            unitPrice = m.salePrice !== undefined ? m.salePrice : 0;
                                            totalValue = unitPrice * m.quantity;
                                            showValue = true; // Always show even if 0
                                        } else if (m.type === 'HARVEST') {
                                            // Optional: if you want to show 0 for harvest too
                                            unitPrice = 0;
                                            totalValue = 0;
                                            showValue = false; // Usually harvest doesn't have a "price" here, it's just production
                                        }

                                        const priceLabel = m.type === 'IN' ? 'Precio de compra' : 'Precio de venta';
                                        const valueTooltip = `${priceLabel}: $${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${m.unit}`;

                                        return (
                                            <tr key={m.id} className="hover:bg-slate-50 group">
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <div className="text-slate-900">{date}</div>
                                                    <div className="text-xs text-slate-400">{time}</div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-800">
                                                    {m.productName}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    <span
                                                        title={tooltip}
                                                        className={`px-2 py-1 rounded-full text-[10px] font-bold ${labelClass}`}
                                                    >
                                                        {label}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold">
                                                    {(m.type === 'IN' || m.type === 'HARVEST' || m.isTransfer) ? '+' : '-'}{m.quantity} {m.unit}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right font-mono text-slate-600">
                                                    {showValue ? (
                                                        <span title={valueTooltip}>
                                                            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            {isEstimate && <span className="text-slate-400 text-[10px] ml-1">*</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                                                    {m.notes}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-slate-400 italic">
                                                    {m.createdBy || 'Sistema'}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    {m.isTransfer ? (
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <span className="font-bold text-slate-900">{m.originName}</span>
                                                            <span className="text-slate-300">→</span>
                                                            <span className="font-bold text-emerald-600">{m.destName}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-900">{warehousesKey[m.warehouseId || ''] || '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-right">
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
                                                                        className="w-6 h-6 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded text-xs font-bold transition-colors flex items-center justify-center"
                                                                    >
                                                                        F
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
                                                                        className={`w-6 h-6 bg-white border border-red-200 text-red-500 rounded text-xs font-bold flex items-center justify-center ${uploadingId === m.id ? 'opacity-50 cursor-wait' : 'hover:bg-red-50'}`}
                                                                    >
                                                                        {uploadingId === m.id ? '...' : 'F'}
                                                                    </button>
                                                                </div>
                                                            )
                                                        )}
                                                        <button
                                                            onClick={() => handleDeleteMovement(m.id, m.partnerId)}
                                                            className="w-6 h-6 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
                                                            title="Eliminar movimiento"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
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
