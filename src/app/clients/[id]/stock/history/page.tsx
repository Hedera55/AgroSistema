'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { InventoryMovement, Order, Product, Warehouse, Client, ProductType, Unit, MovementItem, ClientStock } from '@/types';
import { OrderDetailView } from '@/components/OrderDetailView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { StockEntryForm } from '../components/StockEntryForm';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { generateId } from '@/lib/uuid';
import { useCampaigns } from '@/hooks/useCampaigns';
import { syncService } from '@/services/sync';

export default function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [productsKey, setProductsKey] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);
    const scrollRef = useHorizontalScroll();
    const [movementsLimit, setMovementsLimit] = useState(10);
    const [productsData, setProductsData] = useState<Record<string, Product>>({});
    const [ordersKey, setOrdersKey] = useState<Record<string, string>>({});
    const [ordersData, setOrdersData] = useState<Order[]>([]);
    const [farms, setFarms] = useState<any[]>([]);
    const [lots, setLots] = useState<any[]>([]);
    const [warehousesKey, setWarehousesKey] = useState<Record<string, string>>({});
    const [warehousesFull, setWarehousesFull] = useState<any[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<(Order & { farmName?: string; lotName?: string; hectares?: number }) | null>(null);
    const { displayName } = useAuth();

    // Edit state
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const { stock, updateStock } = useClientStock(clientId);
    const { warehouses: warehousesList } = useWarehouses(clientId);
    const { products: allProductsList } = useInventory(); // To make it match StockPage's behavior if needed

    // StockEntryForm Required States
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [activeStockItem, setActiveStockItem] = useState({ productId: '', quantity: '', price: '', tempBrand: '', presentationLabel: '', presentationContent: '', presentationAmount: '' });
    const [stockItems, setStockItems] = useState<{ productId: string; quantity: string; price: string; tempBrand: string; presentationLabel?: string; presentationContent?: string; presentationAmount?: string; }[]>([]);
    const [selectedInvestors, setSelectedInvestors] = useState<{ name: string; percentage: number }[]>([]);
    const [facturaDate, setFacturaDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedSeller, setSelectedSeller] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [facturaUploading, setFacturaUploading] = useState(false);
    const [availableSellers, setAvailableSellers] = useState<string[]>([]);
    const [showSellerInput, setShowSellerInput] = useState(false);
    const [showSellerDelete, setShowSellerDelete] = useState(false);
    const [sellerInputValue, setSellerInputValue] = useState('');
    const { campaigns } = useCampaigns(clientId);
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [typeLabels] = useState<Record<ProductType, string>>({
        HERBICIDE: 'HERBICIDA',
        FERTILIZER: 'FERTILIZANTE',
        SEED: 'SEMILLA/GRANOS',
        FUNGICIDE: 'FUNGICIDA',
        INSECTICIDE: 'INSECTICIDA',
        COADYUVANTE: 'COADYUVANTE',
        INOCULANTE: 'INOCULANTE',
        OTHER: 'OTR'
    });


    async function loadData() {
        const [allMovements, allProducts, allOrders, allWarehouses, allFarms, allLots, allClients] = await Promise.all([
            db.getAll('movements'),
            db.getAll('products'),
            db.getAll('orders'),
            db.getAll('warehouses'),
            db.getAll('farms'),
            db.getAll('lots'),
            db.getAll('clients')
        ]);

        const currentClient = allClients.find((c: Client) => c.id === clientId);
        setClient(currentClient || null);

        const clientMovements = allMovements
            .filter((m: InventoryMovement) =>
                m.clientId === clientId &&
                !m.notes?.toLowerCase().includes('labor de cosecha') // Filter out irrelevant labor entries
            )
            .sort((a: InventoryMovement, b: InventoryMovement) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        // Map products for brand lookup and prices
        const priceMap: Record<string, number> = {};
        const pMap: Record<string, Product> = {};
        allProducts.forEach((p: any) => {
            if (p.price) priceMap[p.id] = p.price;
            pMap[p.id] = p;
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
        setProductsData(pMap);
        setOrdersKey(orderTypeMap);
        setOrdersData(allOrders);
        setFarms(allFarms);
        setLots(allLots);
        setWarehousesKey(wMap);
        setWarehousesFull(allWarehouses);
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

    const formatDate = (dateStr: string, timeStr?: string) => {
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

    const handleEditMovement = (m: InventoryMovement) => {
        setEditingMovement(m);
        setSelectedWarehouseId(m.warehouseId || '');
        setNote(m.notes || '');
        setFacturaDate(m.facturaDate || '');
        setDueDate(m.dueDate || '');
        if (m.items && m.items.length > 0) {
            setStockItems(m.items.map(it => ({
                productId: it.productId,
                quantity: it.quantity.toString(),
                price: it.price?.toString() || '',
                tempBrand: it.productBrand || '',
                presentationLabel: it.presentationLabel || '',
                presentationContent: it.presentationContent?.toString() || '',
                presentationAmount: it.presentationAmount?.toString() || ''
            })));
        } else {
            setStockItems([{
                productId: m.productId,
                quantity: m.quantity.toString(),
                price: (m.purchasePrice || m.salePrice || 0).toString(),
                tempBrand: m.productBrand || '',
                presentationLabel: '',
                presentationContent: '',
                presentationAmount: ''
            }]);
        }

        setShowEditForm(true);
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleEditSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMovement) return;

        // Include active items if present (duplicated from StockPage logic)
        const allItemsToProcess = [...stockItems];
        if (activeStockItem.productId && activeStockItem.quantity) {
            allItemsToProcess.push(activeStockItem);
        }
        const validItems = allItemsToProcess.filter(item => item.productId && item.quantity);
        if (validItems.length === 0) return;

        setIsSubmitting(true);
        try {
            // 1. REVERT OLD STOCK EFFECT
            if (editingMovement.type === 'IN' || editingMovement.type === 'HARVEST') {
                const oldItems = editingMovement.items || [{ productId: editingMovement.productId, quantity: editingMovement.quantity, presentationLabel: (editingMovement as any).presentationLabel, presentationContent: (editingMovement as any).presentationContent }];
                for (const it of oldItems) {
                    const st = stock.find(s =>
                        s.productId === it.productId &&
                        s.warehouseId === editingMovement.warehouseId &&
                        (s.presentationLabel || '') === (it.presentationLabel || '') &&
                        (s.presentationContent || 0) === (it.presentationContent || 0)
                    );
                    if (st) {
                        await updateStock({ ...st, quantity: st.quantity - it.quantity });
                    }
                }
            } else if (editingMovement.type === 'OUT' || editingMovement.type === 'SALE') {
                const oldItems = editingMovement.items || [{ productId: editingMovement.productId, quantity: editingMovement.quantity, presentationLabel: (editingMovement as any).presentationLabel, presentationContent: (editingMovement as any).presentationContent }];
                for (const it of oldItems) {
                    const st = stock.find(s =>
                        s.productId === it.productId &&
                        s.warehouseId === editingMovement.warehouseId &&
                        (s.presentationLabel || '') === (it.presentationLabel || '') &&
                        (s.presentationContent || 0) === (it.presentationContent || 0)
                    );
                    if (st) {
                        await updateStock({ ...st, quantity: st.quantity + it.quantity });
                    }
                }
            }

            // 2. APPLY NEW STOCK EFFECT & PREPARE MOVEMENT DATA
            const now = new Date();
            const movementItems: MovementItem[] = [];

            for (const item of validItems) {
                const product = productsData[item.productId];
                const qtyNum = parseFloat(item.quantity.replace(',', '.'));
                const priceNum = item.price ? parseFloat(item.price.replace(',', '.')) : 0;
                const pLabel = (item.presentationLabel || '').trim();
                const pContent = item.presentationContent ? parseFloat(item.presentationContent.replace(',', '.')) : 0;
                const pAmount = item.presentationAmount ? parseFloat(item.presentationAmount.replace(',', '.')) : 0;

                // Standard stock update logic
                const existing = stock.find(s =>
                    s.productId === item.productId &&
                    s.warehouseId === selectedWarehouseId &&
                    (s.presentationLabel || '') === pLabel &&
                    (s.presentationContent || 0) === pContent
                );
                const stockId = existing ? existing.id : generateId();
                const updatedStockItem: ClientStock = {
                    id: stockId,
                    clientId: clientId,
                    warehouseId: selectedWarehouseId || undefined,
                    productId: item.productId,
                    productBrand: item.tempBrand || product?.brandName || '',
                    quantity: (existing ? existing.quantity : 0) + (editingMovement.type === 'IN' ? qtyNum : -qtyNum),
                    lastUpdated: now.toISOString(),
                    updatedAt: now.toISOString(),
                    presentationLabel: pLabel || undefined,
                    presentationContent: pContent || undefined,
                    presentationAmount: existing
                        ? (existing.presentationAmount || 0) + (editingMovement.type === 'IN' ? pAmount : -pAmount)
                        : pAmount
                };
                await updateStock(updatedStockItem);

                movementItems.push({
                    id: generateId(),
                    productId: item.productId,
                    productName: product?.name || 'Unknown',
                    productCommercialName: product?.commercialName || '-',
                    productBrand: item.tempBrand || product?.brandName || '',
                    quantity: qtyNum,
                    unit: product?.unit || 'L',
                    price: priceNum,
                    sellerName: selectedSeller || undefined,
                    presentationLabel: pLabel || undefined,
                    presentationContent: pContent || 0,
                    presentationAmount: pAmount || 0
                });
            }

            // 3. UPDATE MOVEMENT RECORD
            const updatedMovement: InventoryMovement = {
                ...editingMovement,
                warehouseId: selectedWarehouseId || undefined,
                notes: note,
                facturaDate: facturaDate || undefined,
                dueDate: dueDate || undefined,
                investors: selectedInvestors,
                sellerName: selectedSeller || undefined,
                items: movementItems,
                updatedAt: now.toISOString()
            };

            await db.put('movements', updatedMovement);
            await loadData();
            setShowEditForm(false);
            setEditingMovement(null);
            syncService.pushChanges();

        } catch (error) {
            console.error(error);
            alert('Error al guardar los cambios');
        } finally {
            setIsSubmitting(false);
        }
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
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Comercial</th>
                                    <th className="px-6 py-2 text-center text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cant.</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">P. Unit.</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Total</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Vendedor</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Socio que pagó</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Galpón</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">F. Emisión</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">F. Venc.</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Notas</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
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
                                        const { date, time } = formatDate(m.createdAt || m.date, m.time);
                                        const isConsolidated = m.items && m.items.length > 1;
                                        const isSingleItemConsolidated = m.items && m.items.length === 1;
                                        const singleItem = isSingleItemConsolidated ? m.items[0] : null;

                                        // Determine Label and Tooltip
                                        let label = 'EGRESO';
                                        let labelClass = 'bg-orange-100 text-orange-800';
                                        let tooltip = 'Retiro de stock';

                                        if (m.isTransfer) {
                                            label = 'TRANSFERENCIA';
                                            labelClass = 'bg-indigo-100 text-indigo-800';
                                            tooltip = 'Traslado entre galpones';
                                        } else if (m.type === 'IN') {
                                            label = 'I-COMPRA';
                                            labelClass = 'bg-orange-100 text-orange-800';
                                            tooltip = 'ingreso - compra';
                                        } else if (m.type === 'HARVEST') {
                                            label = 'I-COSECHA';
                                            labelClass = 'bg-lime-100 text-lime-800';
                                            tooltip = 'ingreso - cosecha';
                                        } else if (m.type === 'SALE') {
                                            label = 'E-VENTA';
                                            labelClass = 'bg-blue-100 text-blue-800';
                                            tooltip = 'egreso - venta';
                                        } else if (m.type === 'OUT') {
                                            // Check order type
                                            const orderType = ordersKey[m.referenceId];
                                            if (orderType === 'SOWING') {
                                                label = 'E-SIEMBRA';
                                                labelClass = 'bg-emerald-100 text-emerald-800';
                                                tooltip = 'egreso - siembra';
                                            } else {
                                                // Default for OUT movements related to orders is now E-APLICACIÓN
                                                label = 'E-APLICACIÓN';
                                                labelClass = 'bg-orange-100 text-orange-800';
                                                tooltip = 'Aplicación';
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

                                        // Standardize terminology for Soja
                                        const productObj = productsData[m.productId];
                                        let displayProductName = isConsolidated ? 'Varios' : (isSingleItemConsolidated ? (singleItem?.productName || 'Producto') : (m.productName || productObj?.name || 'Producto'));
                                        let displayBrand = isConsolidated ? '-' : (isSingleItemConsolidated ? (singleItem?.productBrand || '-') : (m.productBrand || productObj?.brandName || '-'));

                                        // Aggressive Soja terminology fix: "Granos de soja" -> "Soja"
                                        if (displayProductName.toLowerCase().includes('soja')) {
                                            displayProductName = 'Soja';
                                        }

                                        const order = m.referenceId ? ordersData.find(o => o.id === m.referenceId) : null;
                                        const isClickable = !!order && !m.isTransfer;

                                        const handleRowClick = () => {
                                            if (!isClickable) return;

                                            if (order) {
                                                // Enrich order with farm and lot names for OrderDetailView
                                                const farm = farms.find(f => f.id === order.farmId);
                                                const lot = lots.find(l => l.id === order.lotId);
                                                setSelectedOrder({
                                                    ...order,
                                                    farmName: farm?.name || 'Desconocido',
                                                    lotName: lot?.name || 'Desconocido',
                                                    hectares: lot?.hectares || 0
                                                });
                                            }
                                        };

                                        return (
                                            <React.Fragment key={m.id}>
                                                <tr
                                                    className={`hover:bg-slate-50 group transition-colors ${isClickable ? 'cursor-pointer' : ''}`}
                                                    onClick={handleRowClick}
                                                >
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
                                                        ) : displayProductName}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">
                                                        {displayBrand}
                                                    </td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">
                                                        {isConsolidated ? '-' : (isSingleItemConsolidated ? (singleItem.productCommercialName || '-') : (m.productCommercialName || '-'))}
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
                                                                {(m.type === 'IN' || m.type === 'HARVEST' || m.isTransfer) ? '+' : '-'}{isSingleItemConsolidated ? singleItem.quantity : m.quantity} <span className="text-[10px] text-slate-400 font-normal uppercase">{isSingleItemConsolidated ? (singleItem.unit || m.unit) : m.unit}</span>
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
                                                    <td className={`px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px] ${m.sellerName ? 'text-blue-600' : ''}`}>
                                                        {m.sellerName || '-'}
                                                    </td>
                                                    <td className={`px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px] ${(m.investorName || (m.investors && m.investors.length > 0)) ? 'text-indigo-600' : ''}`} title={m.investors ? m.investors.map((i: any) => `${i.name} (${i.percentage}%)`).join(', ') : ''}>
                                                        {m.investorName || (m.investors ? m.investors.map((i: any) => i.name).join(', ') : '-')}
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
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                                                        {m.facturaDate ? formatDate(m.facturaDate).date : '-'}
                                                    </td>
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">
                                                        {m.dueDate ? formatDate(m.dueDate).date : '-'}
                                                    </td>
                                                    <td className="px-6 py-2 text-slate-500 max-w-xs truncate text-[11px] leading-relaxed">
                                                        {m.notes || '-'}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-slate-400 font-medium text-[11px] tracking-tight">
                                                        {m.createdBy || 'Sistema'}
                                                    </td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-right">
                                                        <div className="flex items-center justify-end gap-2 text-right">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditMovement(m);
                                                                }}
                                                                className="w-8 h-8 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center p-2"
                                                                title="Editar movimiento"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                            </button>
                                                            {m.facturaImageUrl ? (

                                                                <a
                                                                    href={m.facturaImageUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    title="Ver factura"
                                                                    className="inline-block"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <button
                                                                        className="w-7 h-7 bg-white border border-emerald-500 text-emerald-500 hover:bg-emerald-50 rounded-md text-[11px] font-black transition-all flex items-center justify-center shadow-sm"
                                                                    >
                                                                        F
                                                                    </button>
                                                                </a>
                                                            ) : (
                                                                m.type !== 'HARVEST' && (
                                                                    <div className="inline-block relative" onClick={e => e.stopPropagation()}>
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*,application/pdf"
                                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                                                                            onChange={(e) => handleFileUpload(e, m.id)}
                                                                            disabled={uploadingId === m.id}
                                                                            title="Subir factura faltante"
                                                                        />
                                                                        <button
                                                                            className={`w-7 h-7 bg-white border border-red-500 text-red-500 rounded-md text-[11px] font-black flex items-center justify-center transition-all ${uploadingId === m.id ? 'opacity-50 cursor-wait' : 'hover:bg-red-50'}`}
                                                                        >
                                                                            {uploadingId === m.id ? '...' : 'F'}
                                                                        </button>
                                                                    </div>
                                                                )
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteMovement(m.id, m.partnerId);
                                                                }}
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
                                    }).slice(0, movementsLimit);
                                })()}
                            </tbody>
                        </table>
                    </div>
                )}
                {(movements.length > movementsLimit || movementsLimit > 10) && (
                    <div className="flex bg-slate-50 border-t border-slate-100 divide-x divide-slate-200">
                        {movements.length > movementsLimit && (
                            <button
                                onClick={() => setMovementsLimit(prev => prev + 10)}
                                className="flex-1 py-4 hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 active:bg-slate-200 group/btn"
                            >
                                <span className="text-xs font-black text-emerald-600 uppercase tracking-[0.2em]">Cargar 10 más</span>
                            </button>
                        )}
                        {movementsLimit > 10 && (
                            <button
                                onClick={() => setMovementsLimit(prev => Math.max(10, prev - 10))}
                                className="flex-1 py-4 hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 active:bg-slate-200 group/btn"
                            >
                                <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Ver menos</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {selectedOrder && client && (
                <div className="mt-4 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden animate-slideUp">
                    <div className="bg-emerald-600 px-6 py-2 flex justify-between items-center bg-gradient-to-r from-emerald-600 to-emerald-500">
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Detalle de la Orden selecionada</span>
                        <button onClick={() => setSelectedOrder(null)} className="text-white/80 hover:text-white text-xs font-bold">Cerrar ✕</button>
                    </div>
                    <OrderDetailView
                        order={selectedOrder}
                        client={client}
                        onClose={() => setSelectedOrder(null)}
                        warehouses={warehousesFull}
                        createdBy={displayName || 'Sistema'}
                    />
                </div>
            )}

            {showEditForm && (
                <div className="mt-8 bg-white p-6 rounded-2xl shadow-xl border-4 border-emerald-500/20 animate-slideUp">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Editar Movimiento</h2>
                            <p className="text-sm text-slate-500">Modificando registro: {editingMovement?.id.slice(0, 8)}</p>
                        </div>
                        <button
                            onClick={() => {
                                setShowEditForm(false);
                                setEditingMovement(null);
                            }}
                            className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        >
                            ✕
                        </button>
                    </div>

                    <StockEntryForm
                        showStockForm={true}
                        setShowStockForm={() => { }}
                        warehouses={warehousesFull}
                        activeWarehouseIds={selectedWarehouseId ? [selectedWarehouseId] : []}
                        selectedWarehouseId={selectedWarehouseId}
                        setSelectedWarehouseId={setSelectedWarehouseId}
                        availableProducts={Object.values(productsData)}
                        activeStockItem={activeStockItem as any}
                        updateActiveStockItem={(field, value) => {
                            setActiveStockItem(prev => {
                                const newState = { ...prev, [field]: value };
                                if (field === 'presentationContent' || field === 'presentationAmount') {
                                    const contentVal = (field === 'presentationContent' ? value : (prev.presentationContent || ''));
                                    const amountVal = (field === 'presentationAmount' ? value : (prev.presentationAmount || ''));

                                    const content = parseFloat(contentVal.toString().replace(',', '.'));
                                    const amount = parseFloat(amountVal.toString().replace(',', '.'));

                                    if (!isNaN(content) && !isNaN(amount)) {
                                        newState.quantity = (content * amount).toString();
                                    }
                                }
                                return newState;
                            });
                        }}
                        stockItems={stockItems}
                        setStockItems={setStockItems}
                        addStockToBatch={() => {
                            if (activeStockItem.productId && activeStockItem.quantity) {
                                setStockItems(prev => [...prev, activeStockItem]);
                                setActiveStockItem({
                                    productId: '',
                                    quantity: '',
                                    price: '',
                                    tempBrand: '',
                                    presentationLabel: '',
                                    presentationContent: '',
                                    presentationAmount: ''
                                });
                            }
                        }}
                        editBatchItem={(idx) => {
                            const item = stockItems[idx];
                            setActiveStockItem({
                                ...item,
                                presentationLabel: item.presentationLabel || '',
                                presentationContent: item.presentationContent || '',
                                presentationAmount: item.presentationAmount || ''
                            });
                            setStockItems(prev => prev.filter((_, i) => i !== idx));
                        }}
                        removeBatchItem={(idx) => setStockItems(prev => prev.filter((_, i) => i !== idx))}
                        availableSellers={availableSellers}
                        selectedSeller={selectedSeller}
                        setSelectedSeller={setSelectedSeller}
                        showSellerInput={showSellerInput}
                        setShowSellerInput={setShowSellerInput}
                        sellerInputValue={sellerInputValue}
                        setSellerInputValue={setSellerInputValue}
                        handleAddSeller={() => {
                            if (sellerInputValue.trim()) {
                                setAvailableSellers(prev => [...prev, sellerInputValue.trim()]);
                                setSelectedSeller(sellerInputValue.trim());
                                setSellerInputValue('');
                                setShowSellerInput(false);
                            }
                        }}
                        showSellerDelete={showSellerDelete}
                        setShowSellerDelete={setShowSellerDelete}
                        setAvailableSellers={setAvailableSellers}
                        saveClientSellers={() => { }} // Not strictly needed here
                        selectedInvestors={selectedInvestors}
                        setSelectedInvestors={setSelectedInvestors}
                        client={client}
                        showNote={showNote}
                        setShowNote={setShowNote}
                        note={note}
                        setNote={setNote}
                        setNoteConfirmed={() => { }}
                        facturaFile={facturaFile}
                        setFacturaFile={setFacturaFile}
                        handleFacturaChange={(e) => {
                            if (e.target.files?.[0]) setFacturaFile(e.target.files[0]);
                        }}
                        handleStockSubmit={handleEditSave}
                        isSubmitting={isSubmitting}
                        facturaUploading={facturaUploading}
                        campaigns={campaigns}
                        selectedCampaignId={selectedCampaignId}
                        setSelectedCampaignId={setSelectedCampaignId}
                        facturaDate={facturaDate}
                        setFacturaDate={setFacturaDate}
                        dueDate={dueDate}
                        setDueDate={setDueDate}
                    />
                </div>
            )}

            <div className="flex justify-end pr-2 pb-4 mt-6">
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
