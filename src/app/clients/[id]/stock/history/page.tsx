'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { InventoryMovement, Order, Product, Warehouse, Client, ProductType, Unit, MovementItem, ClientStock } from '@/types';
import { OrderDetailView } from '@/components/OrderDetailView';
import { MovementDetailsView } from '@/components/MovementDetailsView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { StockEntryForm } from '../components/StockEntryForm';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { generateId } from '@/lib/uuid';
import { useCampaigns } from '@/hooks/useCampaigns';
import { syncService } from '@/services/sync';
import { usePDF } from '@/hooks/usePDF';
import { useRouter } from 'next/navigation';
import { HarvestDetailsView } from '@/components/HarvestDetailsView';
import { HarvestWizard } from '@/components/HarvestWizard';
import { useLots } from '@/hooks/useLocations';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const { generateRemitoPDF } = usePDF();
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
    const [selectedMovement, setSelectedMovement] = useState<any>(null);
    const [selectedSubMovement, setSelectedSubMovement] = useState<any>(null);
    const [harvestMovements, setHarvestMovements] = useState<InventoryMovement[]>([]);
    const [selectedOrder, setSelectedOrder] = useState<(Order & { farmName?: string; lotName?: string; hectares?: number }) | null>(null);
    const [showHarvestWizard, setShowHarvestWizard] = useState(false);
    const router = useRouter();
    const { lots: allLotsFull } = useLots(clientId);
    const { displayName, role, isMaster, profile } = useAuth();
    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(clientId));

    // Edit state
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const { stock, updateStock } = useClientStock(clientId);
    const { warehouses: warehousesList } = useWarehouses(clientId);
    const { products: allProductsList } = useInventory();

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
    // Logistics & Sale Edit States
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [saleTruckDriver, setSaleTruckDriver] = useState('');
    const [salePlateNumber, setSalePlateNumber] = useState('');
    const [saleTrailerPlate, setSaleTrailerPlate] = useState('');
    const [saleDestinationCompany, setSaleDestinationCompany] = useState('');
    const [saleDestinationAddress, setSaleDestinationAddress] = useState('');
    const [saleTransportCompany, setSaleTransportCompany] = useState('');
    const [saleDischargeNumber, setSaleDischargeNumber] = useState('');
    const [saleHumidity, setSaleHumidity] = useState('');
    const [saleHectoliterWeight, setSaleHectoliterWeight] = useState('');
    const [saleGrossWeight, setSaleGrossWeight] = useState('');
    const [saleTareWeight, setSaleTareWeight] = useState('');
    const [salePrimarySaleCuit, setSalePrimarySaleCuit] = useState('');
    const [saleDepartureDateTime, setSaleDepartureDateTime] = useState('');
    const [saleDistanceKm, setSaleDistanceKm] = useState('');
    const [saleFreightTariff, setSaleFreightTariff] = useState('');

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
                !m.notes?.toLowerCase().includes('labor de cosecha')
            )
            .sort((a: InventoryMovement, b: InventoryMovement) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        const priceMap: Record<string, number> = {};
        const pMap: Record<string, Product> = {};
        allProducts.forEach((p: any) => {
            if (p.price) priceMap[p.id] = p.price;
            pMap[p.id] = p;
        });

        const orderTypeMap: Record<string, string> = {};
        allOrders.forEach((o: any) => {
            orderTypeMap[o.id] = o.type;
        });

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
            if (partnerId) await db.delete('movements', partnerId);
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
            const { error: uploadError } = await supabase.storage.from('facturas').upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
            const publicUrl = publicUrlData.publicUrl;
            const movement = movements.find(m => m.id === movementId);
            if (movement) {
                await db.put('movements', { ...movement, facturaImageUrl: publicUrl, synced: false, updatedAt: new Date().toISOString() });
                await loadData();
            }
        } catch (error) {
            console.error('Error uploading factura:', error);
            alert('Error al subir la factura');
        } finally {
            setUploadingId(null);
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
            if (parts.length === 3) { year = parts[0]; month = parts[1]; day = parts[2]; }
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
        return { date: day !== '-' ? `${day}-${month}-${year}` : dateStr, time: formattedTime };
    };

    const getMovementLabel = (m: InventoryMovement) => {
        if (m.type === 'IN') return 'I-COMPRA';
        if (m.type === 'HARVEST') return 'I-COSECHA';
        if (m.type === 'SALE') return 'E-VENTA';
        if (m.isTransfer) return 'TRANSFERENCIA';
        if (m.type === 'OUT') {
            const orderType = ordersKey[m.referenceId || ''];
            if (!m.referenceId || !orderType) return 'E-RETIRO';
            return orderType === 'SOWING' ? 'E-SIEMBRA' : 'E-APLICACIÓN';
        }
        return 'EGRESO';
    };

    const handleEditMovement = (m: InventoryMovement) => {
        const label = getMovementLabel(m);
        if (label === 'E-SIEMBRA' || label === 'E-APLICACIÓN') {
            if (m.referenceId) {
                router.push(`/clients/${clientId}/orders/new?editId=${m.referenceId}`);
                return;
            }
        }
        if (label === 'I-COSECHA') {
            setEditingMovement(m);
            setShowHarvestWizard(true);
            return;
        }

        if (m.type === 'SALE' || m.type === 'OUT') {
            setEditingMovement(m);
            setSelectedWarehouseId(m.warehouseId || '');
            setNote(m.notes || '');
            setSaleQuantity(m.quantity.toString());
            setSalePrice(m.salePrice?.toString() || '');

            const logs = m as any;
            setSaleTruckDriver(logs.truckDriver || '');
            setSalePlateNumber(logs.plateNumber || '');
            setSaleTrailerPlate(logs.trailerPlate || '');
            setSaleDestinationCompany(logs.destinationCompany || logs.deliveryLocation || '');
            setSaleDestinationAddress(logs.destinationAddress || '');
            setSaleTransportCompany(logs.transportCompany || '');
            setSaleDischargeNumber(logs.dischargeNumber || '');
            setSaleHumidity(logs.humidity?.toString() || '');
            setSaleHectoliterWeight(logs.hectoliterWeight?.toString() || '');
            setSaleGrossWeight(logs.grossWeight?.toString() || '');
            setSaleTareWeight(logs.tareWeight?.toString() || '');
            setSalePrimarySaleCuit(logs.primarySaleCuit || '');
            setSaleDepartureDateTime(logs.departureDateTime || '');
            setSaleDistanceKm(logs.distanceKm?.toString() || '');
            setSaleFreightTariff(logs.freightTariff?.toString() || '');

            setShowEditForm(true);
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            return;
        }

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
        const allItemsToProcess = [...stockItems];
        if (activeStockItem.productId && activeStockItem.quantity) allItemsToProcess.push(activeStockItem);
        const validItems = allItemsToProcess.filter(item => item.productId && item.quantity);
        if (validItems.length === 0) return;
        setIsSubmitting(true);
        try {
            if (editingMovement.type === 'OUT' || editingMovement.type === 'SALE') {
                const isSale = editingMovement.type === 'SALE';
                const qtyNum = parseFloat(saleQuantity.replace(',', '.'));
                const priceNum = parseFloat(salePrice.replace(',', '.'));

                // Revert old quantity
                const oldSt = stock.find(s => s.productId === editingMovement.productId && s.warehouseId === editingMovement.warehouseId);
                if (oldSt) await updateStock({ ...oldSt, quantity: oldSt.quantity + editingMovement.quantity });

                // Apply new quantity
                const newSt = stock.find(s => s.productId === editingMovement.productId && s.warehouseId === selectedWarehouseId);
                if (newSt) await updateStock({ ...newSt, quantity: newSt.quantity - qtyNum });

                await db.put('movements', {
                    ...editingMovement,
                    warehouseId: selectedWarehouseId || undefined,
                    quantity: qtyNum,
                    salePrice: isSale ? priceNum : undefined,
                    notes: note,
                    updatedAt: new Date().toISOString(),
                    // Flattened Properties
                    truckDriver: saleTruckDriver || undefined,
                    plateNumber: salePlateNumber || undefined,
                    trailerPlate: saleTrailerPlate || undefined,
                    destinationCompany: saleDestinationCompany || undefined,
                    destinationAddress: saleDestinationAddress || undefined,
                    transportCompany: saleTransportCompany || undefined,
                    dischargeNumber: saleDischargeNumber || undefined,
                    humidity: saleHumidity ? parseFloat(saleHumidity.replace(',', '.')) : undefined,
                    hectoliterWeight: saleHectoliterWeight ? parseFloat(saleHectoliterWeight.replace(',', '.')) : undefined,
                    grossWeight: saleGrossWeight ? parseFloat(saleGrossWeight.replace(',', '.')) : undefined,
                    tareWeight: saleTareWeight ? parseFloat(saleTareWeight.replace(',', '.')) : undefined,
                    primarySaleCuit: salePrimarySaleCuit || undefined,
                    departureDateTime: saleDepartureDateTime || undefined,
                    distanceKm: saleDistanceKm ? parseFloat(saleDistanceKm.replace(',', '.')) : undefined,
                    freightTariff: saleFreightTariff ? parseFloat(saleFreightTariff.replace(',', '.')) : undefined,
                } as any);
                await loadData();
                setShowEditForm(false);
                setEditingMovement(null);
                syncService.pushChanges();
                return;
            }

            if (editingMovement.type === 'IN' || editingMovement.type === 'HARVEST') {
                const oldItems = editingMovement.items || [{ productId: editingMovement.productId, quantity: editingMovement.quantity, presentationLabel: (editingMovement as any).presentationLabel, presentationContent: (editingMovement as any).presentationContent }];
                for (const it of oldItems) {
                    const st = stock.find(s => s.productId === it.productId && s.warehouseId === editingMovement.warehouseId && (s.presentationLabel || '') === (it.presentationLabel || '') && (s.presentationContent || 0) === (it.presentationContent || 0));
                    if (st) await updateStock({ ...st, quantity: st.quantity - it.quantity });
                }
            } else if (editingMovement.type === 'OUT' || editingMovement.type === 'SALE') {
                const oldItems = editingMovement.items || [{ productId: editingMovement.productId, quantity: editingMovement.quantity, presentationLabel: (editingMovement as any).presentationLabel, presentationContent: (editingMovement as any).presentationContent }];
                for (const it of oldItems) {
                    const st = stock.find(s => s.productId === it.productId && s.warehouseId === editingMovement.warehouseId && (s.presentationLabel || '') === (it.presentationLabel || '') && (s.presentationContent || 0) === (it.presentationContent || 0));
                    if (st) await updateStock({ ...st, quantity: st.quantity + it.quantity });
                }
            }
            const now = new Date();
            const movementItems: MovementItem[] = [];
            for (const item of validItems) {
                const product = productsData[item.productId];
                const qtyNum = parseFloat(item.quantity.replace(',', '.'));
                const priceNum = item.price ? parseFloat(item.price.replace(',', '.')) : 0;
                const pLabel = (item.presentationLabel || '').trim();
                const pContent = item.presentationContent ? parseFloat(item.presentationContent.replace(',', '.')) : 0;
                const pAmount = item.presentationAmount ? parseFloat(item.presentationAmount.replace(',', '.')) : 0;
                const existing = stock.find(s => s.productId === item.productId && s.warehouseId === selectedWarehouseId && (s.presentationLabel || '') === pLabel && (s.presentationContent || 0) === pContent);
                const stockId = existing ? existing.id : generateId();
                await updateStock({
                    id: stockId, clientId, warehouseId: selectedWarehouseId || undefined, productId: item.productId, productBrand: item.tempBrand || product?.brandName || '',
                    quantity: (existing ? existing.quantity : 0) + (editingMovement.type === 'IN' ? qtyNum : -qtyNum),
                    lastUpdated: now.toISOString(), updatedAt: now.toISOString(),
                    presentationLabel: pLabel || undefined, presentationContent: pContent || undefined,
                    presentationAmount: existing ? (existing.presentationAmount || 0) + (editingMovement.type === 'IN' ? pAmount : -pAmount) : pAmount
                });
                movementItems.push({
                    id: generateId(), productId: item.productId, productName: product?.name || 'Unknown', productCommercialName: product?.commercialName || '-',
                    productBrand: item.tempBrand || product?.brandName || '', quantity: qtyNum, unit: product?.unit || 'L', price: priceNum,
                    sellerName: selectedSeller || undefined, presentationLabel: pLabel || undefined, presentationContent: pContent || 0, presentationAmount: pAmount || 0
                });
            }
            await db.put('movements', { ...editingMovement, warehouseId: selectedWarehouseId || undefined, notes: note, facturaDate: facturaDate || undefined, dueDate: dueDate || undefined, investors: selectedInvestors, sellerName: selectedSeller || undefined, items: movementItems, updatedAt: now.toISOString() });
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
                    <div className="overflow-x-auto" ref={scrollRef}>
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Marca</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Comercial</th>
                                    <th className="px-6 py-2 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Tipo</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
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
                                            const partner = movements.find((p: InventoryMovement) => p.id !== m.id && p.referenceId === m.referenceId && p.productId === m.productId);
                                            if (partner) {
                                                const outM = m.type === 'OUT' ? m : partner;
                                                const inM = m.type === 'IN' ? m : partner;
                                                groupedMovements.push({ ...outM, isTransfer: true, originName: warehousesKey[outM.warehouseId || ''] || 'Desconocido', destName: warehousesKey[inM.warehouseId || ''] || 'Desconocido', partnerId: partner.id });
                                                processedIds.add(m.id); processedIds.add(partner.id); return;
                                            }
                                        }
                                        groupedMovements.push(m); processedIds.add(m.id);
                                    });

                                    return groupedMovements.map((m) => {
                                        const { date, time } = formatDate(m.createdAt || m.date, m.time);
                                        const label = getMovementLabel(m);
                                        const isSelected = (selectedMovement?.movement?.id === m.id) || (selectedOrder?.id === m.referenceId);
                                        const isConsolidated = m.items && m.items.length > 1;
                                        const singleItem = (m.items && m.items.length === 1) ? m.items[0] : null;

                                        let labelClass = 'bg-orange-100 text-orange-800';
                                        if (label === 'TRANSFERENCIA') labelClass = 'bg-indigo-100 text-indigo-800';
                                        else if (label === 'I-COSECHA') labelClass = 'bg-lime-100 text-lime-800';
                                        else if (label === 'E-VENTA' || label === 'E-RETIRO') labelClass = 'bg-blue-100 text-blue-800';
                                        else if (label === 'E-SIEMBRA') labelClass = 'bg-emerald-100 text-emerald-800';

                                        let showValue = (m.type === 'IN' && !m.isTransfer) || (m.type === 'SALE');
                                        let totalValue = 0, unitPrice = 0;
                                        if (showValue) {
                                            if (isConsolidated) totalValue = m.items.reduce((acc: number, item: any) => acc + (parseFloat(item.price) * parseFloat(item.quantity)), 0);
                                            else { unitPrice = (m.type === 'IN' ? m.purchasePrice : m.salePrice) || 0; totalValue = unitPrice * m.quantity; }
                                        }

                                        const productObj = productsData[m.productId];
                                        let dispName = isConsolidated ? 'Varios' : (singleItem?.productName || m.productName || productObj?.name || 'Producto');
                                        if (dispName.toLowerCase().includes('soja')) dispName = 'Soja';

                                        const enrichedOrder = m.referenceId ? ordersData.find(o => o.id === m.referenceId) : null;
                                        const handleRowClick = async () => {
                                            if (isSelected) {
                                                setSelectedMovement(null);
                                                setSelectedOrder(null);
                                                setSelectedSubMovement(null);
                                                setHarvestMovements([]);
                                                return;
                                            }

                                            // Direct jump for Sowing and Spraying
                                            if (label === 'E-SIEMBRA' || label === 'E-APLICACIÓN') {
                                                if (enrichedOrder) {
                                                    setSelectedOrder({ ...enrichedOrder, farmName: farms.find(f => f.id === enrichedOrder.farmId)?.name || 'D.', lotName: lots.find(l => l.id === enrichedOrder.lotId)?.name || 'D.' });
                                                    setSelectedMovement(null);
                                                    setSelectedSubMovement(null);
                                                    return;
                                                }
                                            }

                                            setSelectedOrder(null);
                                            setSelectedMovement({ movement: m, order: enrichedOrder ? { ...enrichedOrder, farmName: farms.find(f => f.id === enrichedOrder.farmId)?.name || 'D.', lotName: lots.find(l => l.id === enrichedOrder.lotId)?.name || 'D.' } : undefined, typeLabel: label });
                                            setSelectedSubMovement(null);
                                            if (label === 'I-COSECHA' && m.referenceId) {
                                                const related = (await db.getAll('movements')).filter((mov: any) => mov.referenceId === m.referenceId && mov.clientId === clientId && !mov.deleted);
                                                setHarvestMovements(related);
                                            } else setHarvestMovements([]);
                                        };

                                        return (
                                            <React.Fragment key={m.id}>
                                                <tr onClick={handleRowClick} className={`group cursor-pointer transition-colors ${isSelected ? 'bg-emerald-100/80 hover:bg-emerald-100/90' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-6 py-2 whitespace-nowrap"><div className="text-slate-900 font-medium">{date}</div><div className="text-[10px] text-slate-400 font-mono uppercase">{time}</div></td>
                                                    <td className="px-6 py-2 font-bold text-slate-900">{dispName}</td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">{isConsolidated ? '-' : (singleItem?.productBrand || m.productBrand || '-')}</td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">{isConsolidated ? '-' : (singleItem?.productCommercialName || m.productCommercialName || '-')}</td>
                                                    <td className="px-6 py-2 text-center whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${labelClass}`}>{label}</span></td>
                                                    <td className="px-6 py-2 text-right font-mono font-bold text-slate-700">{isConsolidated ? '---' : `${Math.abs(Number(singleItem ? singleItem.quantity : m.quantity))} ${singleItem ? singleItem.unit : m.unit}`}</td>
                                                    <td className="px-6 py-2 text-right font-mono text-slate-600">{showValue && !isConsolidated ? `USD ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}</td>
                                                    <td className="px-6 py-2 text-right font-mono text-slate-900 font-bold">{showValue ? <span className={m.type === 'IN' ? 'text-red-500' : 'text-emerald-600'}>USD {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px]">{m.sellerName || '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px]">{m.investorName || (m.investors ? m.investors.map((i: any) => i.name).join(', ') : '-')}</td>
                                                    <td className="px-6 py-2 text-[11px] font-medium text-slate-600">{m.isTransfer ? `${warehousesKey[m.warehouseId || '']} → ${warehousesKey[m.partnerId || '']}` : warehousesKey[m.warehouseId || '']}</td>
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">{m.facturaDate ? formatDate(m.facturaDate).date : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">{m.dueDate ? formatDate(m.dueDate).date : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 max-w-xs truncate text-[11px]">{m.notes || '-'}</td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-slate-400 font-medium text-[11px]">{m.createdBy || 'Sistema'}</td>
                                                    <td className="px-6 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleEditMovement(m); }} className="w-8 h-8 text-slate-400 hover:text-emerald-500 p-2 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg></button>}
                                                            {m.facturaImageUrl ? <a href={m.facturaImageUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 border border-emerald-500 text-emerald-500 rounded-md text-[11px] font-black flex items-center justify-center" onClick={e => e.stopPropagation()}>F</a> : (m.type !== 'HARVEST' && !isReadOnly && <div className="relative" onClick={e => e.stopPropagation()}><input type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, m.id)} disabled={uploadingId === m.id} /><button className="w-7 h-7 border border-red-500 text-red-500 rounded-md text-[11px] font-black flex items-center justify-center">{uploadingId === m.id ? '...' : 'F'}</button></div>)}
                                                            {(m.type === 'SALE' || m.type === 'OUT' || m.isTransfer) && client && <button onClick={(e) => { e.stopPropagation(); generateRemitoPDF(m, client, m.isTransfer ? m.originName : warehousesKey[m.warehouseId || '']); }} className="w-7 h-7 border border-blue-500 text-blue-500 rounded-md text-[11px] font-black flex items-center justify-center ml-1">R</button>}
                                                            {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleDeleteMovement(m.id, m.partnerId); }} className="w-8 h-8 text-slate-400 hover:text-red-500 p-2 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isConsolidated && m.items.map((it: any, i: number) => (
                                                    <tr key={`${m.id}-item-${i}`} className="bg-slate-50/30 text-[11px]">
                                                        <td colSpan={1} className="px-6 py-1"></td>
                                                        <td className="px-6 py-1 font-bold text-slate-600 pl-10">↳ {it.productName}</td>
                                                        <td className="px-6 py-1 text-slate-400">{it.productBrand || '-'}</td>
                                                        <td className="px-6 py-1 text-slate-500">{it.productCommercialName || '-'}</td>
                                                        <td colSpan={1}></td>
                                                        <td className="px-6 py-1 text-right font-mono text-slate-500">{Math.abs(Number(it.quantity))} {it.unit || m.unit}</td>
                                                        <td className="px-6 py-1 text-right font-mono text-slate-500">USD {parseFloat(it.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td className="px-6 py-1 text-right font-mono font-bold text-slate-900 border-r border-slate-100">USD {(parseFloat(it.price) * parseFloat(it.quantity)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                        <td colSpan={8}></td>
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
                {movements.length > movementsLimit && (
                    <div className="flex bg-slate-50 border-t border-slate-100 divide-x divide-slate-200">
                        <button onClick={() => setMovementsLimit(prev => prev + 10)} className="flex-1 py-4 hover:bg-slate-100 flex items-center justify-center gap-3 active:bg-slate-200"><span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Cargar 10 más</span></button>
                        {movementsLimit > 10 && <button onClick={() => setMovementsLimit(prev => Math.max(10, prev - 10))} className="flex-1 py-4 hover:bg-slate-100 flex items-center justify-center gap-3 active:bg-slate-200"><span className="text-xs font-black text-slate-400 uppercase tracking-widest">Ver menos</span></button>}
                    </div>
                )}
            </div>

            {selectedMovement && client && (
                <div className="mt-4 animate-slideUp">
                    {selectedMovement.typeLabel === 'I-COSECHA' ? (
                        <HarvestDetailsView
                            harvestMovement={selectedMovement.movement}
                            harvestMovements={harvestMovements}
                            client={client}
                            warehouses={warehousesFull}
                            farms={farms}
                            lots={lots}
                            campaigns={campaigns}
                            onClose={() => { setSelectedMovement(null); setSelectedSubMovement(null); }}
                            onEdit={() => handleEditMovement(selectedMovement.movement)}
                            onSelectMovement={(m) => {
                                setSelectedSubMovement({
                                    movement: m,
                                    typeLabel: 'Distribución de Cosecha',
                                    order: ordersData.find(o => o.id === (m as any).orderId)
                                });
                            }}
                        />
                    ) : (
                        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp border-t-4 border-t-blue-500">
                            <MovementDetailsView
                                movement={selectedMovement.movement}
                                client={client}
                                order={selectedMovement.order}
                                typeLabel={selectedMovement.typeLabel}
                                onClose={() => setSelectedMovement(null)}
                            />
                        </div>
                    )}
                </div>
            )}

            {selectedSubMovement && client && (
                <div className="mt-4 animate-slideUp">
                    <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp border-t-4 border-t-blue-500">
                        <MovementDetailsView
                            movement={selectedSubMovement.movement}
                            client={client}
                            order={selectedSubMovement.order}
                            typeLabel={selectedSubMovement.typeLabel}
                            onClose={() => setSelectedSubMovement(null)}
                        />
                    </div>
                </div>
            )}

            {selectedOrder && client && (
                <div className="mt-4">
                    <OrderDetailView order={selectedOrder} client={client} onClose={() => setSelectedOrder(null)} warehouses={warehousesFull} createdBy={displayName || 'Sistema'} />
                </div>
            )}

            {showHarvestWizard && editingMovement && (
                <HarvestWizard
                    // Use allLotsFull if lot id matches
                    lot={allLotsFull.find(l => l.id === editingMovement.referenceId?.split('_')[0]) || lots.find(l => l.id === editingMovement.referenceId?.split('_')[0]) || {} as any}
                    farm={farms.find(f => f.lots?.some((l: any) => l.id === editingMovement.referenceId?.split('_')[0])) || farms.find(f => f.id === (editingMovement as any).farmId) || null as any}
                    contractors={[]} // You may need to wire this up, but empty array prevents crash
                    campaigns={campaigns}
                    warehouses={warehousesFull} // Fixes "warehouses is undefined" crash
                    partners={client?.partners || []}
                    investors={client?.investors || []}
                    onCancel={() => { setShowHarvestWizard(false); setEditingMovement(null); }}
                    onComplete={() => { setShowHarvestWizard(false); setEditingMovement(null); loadData(); }}
                    initialDate={editingMovement.date}
                    initialContractor={editingMovement.contractorName || ''}
                    initialLaborPrice={editingMovement.harvestLaborCost ? String(editingMovement.harvestLaborCost) : ''}
                    initialYield={String(editingMovement.quantity)}
                    isExecutingPlan={false} // Editing an existing one
                    // We don't have all the exact distributions here out-of-the-box in the same way, but 
                    // this prevents it from crashing. A full implementation would fetch the other movements from the same harvest block.
                    initialDistributions={[{
                        id: 'initial',
                        type: editingMovement.warehouseId ? 'WAREHOUSE' : 'PARTNER',
                        targetId: editingMovement.warehouseId || editingMovement.receiverName || '',
                        targetName: editingMovement.warehouseName || editingMovement.receiverName || 'Desconocido',
                        amount: editingMovement.quantity,
                        logistics: {
                            // Rename internal type to avoid collision if necessary, but here we use a nested object
                            // Cast to any to avoid "property logistics does not exist" on the parent distribution object
                            grainType: (editingMovement as any).type?.includes('SEMILLA') ? 'SEMILLA' : 'GRANO',
                            campaignId: editingMovement.campaignId,
                            investorName: editingMovement.investorName,
                            originAddress: editingMovement.originAddress,
                            transportName: editingMovement.transportName,
                            transportCuit: editingMovement.transportCuit,
                            driverName: editingMovement.driverName,
                            driverCuit: editingMovement.driverCuit,
                            truckPlate: editingMovement.truckPlate,
                            trailerPlate: editingMovement.trailerPlate,
                            observations: editingMovement.notes
                        } as any
                    }]}
                />
            )}

            {showEditForm && (
                <div className="mt-8 bg-white p-6 rounded-2xl shadow-xl border-4 border-emerald-500/20 animate-slideUp">
                    <div className="flex justify-between items-center mb-6"><div><h2 className="text-xl font-bold text-slate-900">Editar {editingMovement?.type === 'SALE' ? 'Venta' : (editingMovement?.type === 'OUT' ? 'Retiro / Egreso' : 'Movimiento')}</h2></div><button onClick={() => { setShowEditForm(false); setEditingMovement(null); }} className="bg-slate-100 p-2 rounded-full text-slate-400 hover:text-red-500 transition-colors">✕</button></div>

                    {editingMovement?.type === 'SALE' || editingMovement?.type === 'OUT' ? (
                        <form onSubmit={handleEditSave} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
                                <Input label="Cantidad (Tons)" type="text" value={saleQuantity} onChange={(e: any) => setSaleQuantity(e.target.value)} required className="h-11 font-bold text-lg" />
                                {editingMovement?.type === 'SALE' && <Input label="Precio USD/Ton" type="text" value={salePrice} onChange={(e: any) => setSalePrice(e.target.value)} required className="h-11 font-bold text-lg" />}
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <Input label="Empresa Destino" value={saleDestinationCompany} onChange={(e: any) => setSaleDestinationCompany(e.target.value)} className="bg-white h-10" />
                                    <Input label="Dirección / Localidad" value={saleDestinationAddress} onChange={(e: any) => setSaleDestinationAddress(e.target.value)} className="bg-white h-10" />
                                    <Input label="CUIT Venta Primaria" value={salePrimarySaleCuit} onChange={(e: any) => setSalePrimarySaleCuit(e.target.value)} className="bg-white h-10" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <Input label="Chofer" value={saleTruckDriver} onChange={(e: any) => setSaleTruckDriver(e.target.value)} className="bg-white h-10" />
                                    <Input label="Patente Camión" value={salePlateNumber} onChange={(e: any) => setSalePlateNumber(e.target.value)} className="bg-white h-10" />
                                    <Input label="Patente Acoplado" value={saleTrailerPlate} onChange={(e: any) => setSaleTrailerPlate(e.target.value)} className="bg-white h-10" />
                                    <Input label="Empresa Transporte" value={saleTransportCompany} onChange={(e: any) => setSaleTransportCompany(e.target.value)} className="bg-white h-10" />
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                    <Input label="Nro Descarga" value={saleDischargeNumber} onChange={(e: any) => setSaleDischargeNumber(e.target.value)} className="bg-white h-10 text-center" />
                                    <Input label="Humedad (%)" value={saleHumidity} onChange={(e: any) => setSaleHumidity(e.target.value)} className="bg-white h-10 text-center" />
                                    <Input label="P. Hectolítrico" value={saleHectoliterWeight} onChange={(e: any) => setSaleHectoliterWeight(e.target.value)} className="bg-white h-10 text-center" />
                                    <Input label="Peso Bruto" value={saleGrossWeight} onChange={(e: any) => setSaleGrossWeight(e.target.value)} className="bg-white h-10 text-right font-mono" />
                                    <Input label="Peso Tara" value={saleTareWeight} onChange={(e: any) => setSaleTareWeight(e.target.value)} className="bg-white h-10 text-right font-mono" />
                                    <Input label="Km Recorridos" value={saleDistanceKm} onChange={(e: any) => setSaleDistanceKm(e.target.value)} className="bg-white h-10 text-center" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="sm:col-span-2">
                                        <Input label="Notas" value={note} onChange={(e: any) => setNote(e.target.value)} className="bg-white h-10" />
                                    </div>
                                    <Input label="Fecha y Hora Partida" type="datetime-local" value={saleDepartureDateTime} onChange={(e: any) => setSaleDepartureDateTime(e.target.value)} className="bg-white h-10" />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Input label="Galpón" value={selectedWarehouseId} onChange={(e: any) => setSelectedWarehouseId(e.target.value)} type="select" className="bg-white h-10">
                                        <option value="">Selección...</option>
                                        {warehousesFull.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                                    </Input>
                                    <Input label="Tarifa Flete (USD)" value={saleFreightTariff} onChange={(e: any) => setSaleFreightTariff(e.target.value)} className="bg-white h-10 text-right" placeholder="0.00" />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100">
                                <Button type="submit" isLoading={isSubmitting} className="px-8 bg-emerald-600 hover:bg-emerald-700">Guardar Cambios</Button>
                            </div>
                        </form>
                    ) : (
                        <StockEntryForm showStockForm={true} setShowStockForm={() => { }} warehouses={warehousesFull} activeWarehouseIds={selectedWarehouseId ? [selectedWarehouseId] : []} selectedWarehouseId={selectedWarehouseId} setSelectedWarehouseId={setSelectedWarehouseId} availableProducts={Object.values(productsData)} activeStockItem={activeStockItem as any} updateActiveStockItem={(f, v) => { setActiveStockItem(prev => ({ ...prev, [f]: v })); }} stockItems={stockItems} setStockItems={setStockItems} addStockToBatch={() => { if (activeStockItem.productId && activeStockItem.quantity) { setStockItems(prev => [...prev, activeStockItem]); setActiveStockItem({ productId: '', quantity: '', price: '', tempBrand: '', presentationLabel: '', presentationContent: '', presentationAmount: '' }); } }} editBatchItem={(idx) => { const item = stockItems[idx]; setActiveStockItem({ ...item, presentationLabel: item.presentationLabel || '', presentationContent: item.presentationContent || '', presentationAmount: item.presentationAmount || '' }); setStockItems(prev => prev.filter((_, i) => i !== idx)); }} removeBatchItem={(idx) => setStockItems(prev => prev.filter((_, i) => i !== idx))} availableSellers={availableSellers} selectedSeller={selectedSeller} setSelectedSeller={setSelectedSeller} showSellerInput={showSellerInput} setShowSellerInput={setShowSellerInput} sellerInputValue={sellerInputValue} setSellerInputValue={setSellerInputValue} handleAddSeller={() => { if (sellerInputValue.trim()) { setAvailableSellers(prev => [...prev, sellerInputValue.trim()]); setSelectedSeller(sellerInputValue.trim()); setSellerInputValue(''); setShowSellerInput(false); } }} showSellerDelete={showSellerDelete} setShowSellerDelete={setShowSellerDelete} setAvailableSellers={setAvailableSellers} saveClientSellers={() => { }} selectedInvestors={selectedInvestors} setSelectedInvestors={setSelectedInvestors} client={client} showNote={showNote} setShowNote={setShowNote} note={note} setNote={setNote} setNoteConfirmed={() => { }} facturaFile={facturaFile} setFacturaFile={setFacturaFile} handleFacturaChange={(e) => { if (e.target.files?.[0]) setFacturaFile(e.target.files[0]); }} handleStockSubmit={handleEditSave} isSubmitting={isSubmitting} facturaUploading={facturaUploading} campaigns={campaigns} selectedCampaignId={selectedCampaignId} setSelectedCampaignId={setSelectedCampaignId} facturaDate={facturaDate} setFacturaDate={setFacturaDate} dueDate={dueDate} setDueDate={setDueDate} />
                    )}
                </div>
            )}

            <div className="flex justify-end pr-2 pb-4 mt-6">
                <Link href={`/clients/${clientId}/stock`} className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium">Volver</Link>
            </div>
        </div>
    );
}
