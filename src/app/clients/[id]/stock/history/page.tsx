'use client';

import React, { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { InventoryMovement, Order, Product, Warehouse, Client, ProductType, Unit, MovementItem, ClientStock, CampaignSnapshot, Lot } from '@/types';
import { OrderDetailView } from '@/components/OrderDetailView';
import { MovementDetailsView } from '@/components/MovementDetailsView';
import { StockSalePanel } from '@/components/StockSalePanel';
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
import { processHarvest } from '@/services/harvest';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { normalizeNumber } from '@/lib/numbers';
import { useMovementEditor } from '@/hooks/useMovementEditor';
import { getMovementBadgeStyles } from '@/lib/movementStyles';

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
    const [client, setClient] = useState<Client | null>(null);
    const { stock, updateStock } = useClientStock(clientId);
    const { warehouses: warehousesList } = useWarehouses(clientId);
    const { products: allProductsList } = useInventory();
    const [contractors, setContractors] = useState<any[]>([]);

    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [facturaUploading, setFacturaUploading] = useState(false);
    const [availableSellers, setAvailableSellers] = useState<string[]>([]);
    const [showSellerInput, setShowSellerInput] = useState(false);
    const [showSellerDelete, setShowSellerDelete] = useState(false);
    const [sellerInputValue, setSellerInputValue] = useState('');
    const { campaigns } = useCampaigns(clientId);

    const editor = useMovementEditor(clientId, {
        productsData,
        campaigns,
        stock,
        updateStock,
        onSuccess: async () => {
            await loadData();
            if (selectedMovement?.movement?.id === editor.editingMovement?.id) {
                const freshMovements = await db.getAll('movements');
                const freshMov = freshMovements.find((m: any) => m.id === editor.editingMovement?.id);
                if (freshMov) {
                    setSelectedMovement((prev: any) => prev ? { ...prev, movement: freshMov } : null);
                }
            }
        }
    });

    // Redundant local updateActiveStockItem removed - now using editor hook

    // Recalcular Fuerte states
    const [showRecalculateModal, setShowRecalculateModal] = useState(false);
    const [recalculateCampaignId, setRecalculateCampaignId] = useState('');
    const [isRecalculating, setIsRecalculating] = useState(false);

    const loadData = React.useCallback(async () => {
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
        if (currentClient?.enabledSellers) setAvailableSellers(currentClient.enabledSellers);

        // Fetch contractors assigned to this client
        const { data: contractorsData } = await supabase
            .from('profiles')
            .select('id, username, assigned_clients')
            .eq('role', 'CONTRATISTA');

        if (contractorsData) {
            const filtered = contractorsData.filter((c: any) =>
                c.assigned_clients && c.assigned_clients.includes(clientId)
            );
            setContractors(filtered);
        }

        const clientMovements = allMovements
            .filter((m: InventoryMovement) =>
                m.clientId === clientId &&
                !m.deleted &&
                !m.notes?.toLowerCase().includes('labor de cosecha')
            )
            .sort((a: InventoryMovement, b: InventoryMovement) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        const clientProducts = allProducts.filter((p: any) => p.clientId === clientId);
        const clientOrders = allOrders.filter((o: any) => o.clientId === clientId);
        const clientWarehouses = allWarehouses.filter((w: any) => w.clientId === clientId);
        const clientFarms = allFarms.filter((f: any) => f.clientId === clientId);
        const clientLots = allLots.filter((l: any) => l.clientId === clientId);

        const priceMap: Record<string, number> = {};
        const pMap: Record<string, Product> = {};
        clientProducts.forEach((p: any) => {
            if (p.price) priceMap[p.id] = p.price;
            pMap[p.id] = p;
        });

        const orderTypeMap: Record<string, string> = {};
        clientOrders.forEach((o: any) => {
            orderTypeMap[o.id] = o.type;
        });

        const wMap: Record<string, string> = {};
        clientWarehouses.forEach((w: any) => {
            wMap[w.id] = w.name;
        });

        setMovements(clientMovements);
        setProductsKey(priceMap);
        setProductsData(pMap);
        setOrdersKey(orderTypeMap);
        setOrdersData(clientOrders);
        setFarms(clientFarms);
        setLots(clientLots);
        setWarehousesKey(wMap);
        setWarehousesFull(clientWarehouses);
        setLoading(false);
    }, [clientId]);

    const handleDeleteMovement = React.useCallback(async (id: string, partnerId?: string) => {
        if (!confirm('¿Seguro que quieres eliminar este registro? Esto ajustará el saldo en el Galpón automáticamente.')) return;

        try {
            // 1. Fetch movement to know what to revert
            const mov = await db.get('movements', id) as InventoryMovement;
            if (!mov) {
                // If not found, just try to delete anyway
                await db.delete('movements', id);
                if (partnerId) await db.delete('movements', partnerId);
                await loadData();
                return;
            }

            // 2. Identify items to revert
            const items = mov.items && mov.items.length > 0
                ? mov.items
                : [{
                    productId: mov.productId,
                    quantity: mov.quantity,
                    productBrand: mov.productBrand,
                    presentationLabel: (mov as any).presentationLabel,
                    presentationContent: (mov as any).presentationContent,
                    presentationAmount: (mov as any).presentationAmount
                }];

            const isOut = ['OUT', 'SALE'].includes(mov.type);
            const multiplier = isOut ? 1 : -1; // Reversing an OUT adds back, reversing an IN subtracts

            // 3. Helper to update stock incrementally
            const revertMovementStock = async (m: InventoryMovement, mItems: any[], mult: number) => {
                const allStock = await db.getAll('stock') as ClientStock[];

                for (const it of mItems) {
                    const existing = allStock.find(s =>
                        s.productId === it.productId &&
                        s.warehouseId === m.warehouseId &&
                        s.clientId === clientId &&
                        (it.productBrand ? (s.productBrand || '').toLowerCase().trim() === it.productBrand.toLowerCase().trim() : true) &&
                        (it.presentationLabel ? s.presentationLabel === it.presentationLabel : true) &&
                        (it.presentationContent ? s.presentationContent === it.presentationContent : true)
                    );

                    if (existing) {
                        await updateStock({
                            ...existing,
                            quantity: existing.quantity + (it.quantity * mult),
                            presentationAmount: existing.presentationAmount !== undefined
                                ? (existing.presentationAmount + ((it.presentationAmount || 0) * mult))
                                : undefined,
                            lastUpdated: new Date().toISOString()
                        });
                    } else {
                        // Create entry with negative/positive balance if it didn't exist
                        await updateStock({
                            clientId,
                            warehouseId: m.warehouseId,
                            productId: it.productId,
                            productBrand: it.productBrand,
                            campaignId: m.campaignId,
                            quantity: it.quantity * mult,
                            presentationLabel: it.presentationLabel,
                            presentationContent: it.presentationContent,
                            presentationAmount: it.presentationAmount ? (it.presentationAmount * mult) : undefined,
                            lastUpdated: new Date().toISOString()
                        });
                    }
                }
            };

            // 4. Handle Harvest Batch Deletion Logic
            if (mov.type === 'HARVEST' && mov.harvestBatchId) {
                const lotId = mov.referenceId;
                const lot = await db.get('lots', lotId) as Lot;

                if (lot) {
                    const isCurrentHarvest = lot.status === 'HARVESTED' && lot.lastHarvestId === mov.harvestBatchId;

                    if (!isCurrentHarvest && lot.lastHarvestId !== mov.harvestBatchId) {
                        // This is an "Old" harvest. Prevent deletion.
                        alert("No se puede. Opción: Editar el rinde total a 0");
                        return;
                    }

                    // Proceed with Batch Reversion
                    const allMovements = await db.getAll('movements') as InventoryMovement[];
                    const batchMovements = allMovements.filter(m => m.harvestBatchId === mov.harvestBatchId && !m.deleted);

                    for (const bMov of batchMovements) {
                        const bItems = bMov.items && bMov.items.length > 0 ? bMov.items : [{
                            productId: bMov.productId,
                            quantity: bMov.quantity,
                            productBrand: bMov.productBrand,
                            presentationLabel: bMov.presentationLabel,
                            presentationContent: bMov.presentationContent,
                            presentationAmount: bMov.presentationAmount
                        }];
                        // Harvest is IN, so multiplier -1 reverts (subtracts from stock)
                        await revertMovementStock(bMov, bItems, -1);

                        // Soft delete
                        await db.put('movements', {
                            ...bMov,
                            deleted: true,
                            updatedAt: new Date().toISOString(),
                            synced: false
                        });
                    }

                    // Delete the associated HARVEST order
                    const allOrders = await db.getAll('orders') as Order[];
                    const batchOrder = allOrders.find(o => o.harvestBatchId === mov.harvestBatchId && !o.deleted);
                    if (batchOrder) {
                        await db.put('orders', {
                            ...batchOrder,
                            deleted: true,
                            updatedAt: new Date().toISOString(),
                            synced: false
                        });
                    }

                    // If it was the current harvest, revert the Lot state
                    if (isCurrentHarvest) {
                        const lotUpdates = {
                            ...lot,
                            status: 'SOWED' as const,
                            observedYield: undefined,
                            lastHarvestId: undefined,
                            lastUpdatedBy: displayName || 'Sistema',
                            updatedAt: new Date().toISOString(),
                            synced: false
                        };
                        await db.put('lots', lotUpdates);
                        syncService.pushChanges();
                    }
                }
            } else {
                // STANDARD DELETION (Non-harvest or legacy harvest without batchId)
                // Revert primary movement
                await revertMovementStock(mov, items, multiplier);

                // Handle Transfer (Partner)
                if (partnerId) {
                    const pMov = await db.get('movements', partnerId) as InventoryMovement;
                    if (pMov) {
                        const pIsOut = ['OUT', 'SALE'].includes(pMov.type);
                        const pMultiplier = pIsOut ? 1 : -1;
                        const pItems = pMov.items && pMov.items.length > 0 ? pMov.items : items;
                        await revertMovementStock(pMov, pItems, pMultiplier);
                    }
                }

                // Soft delete from movements
                await db.put('movements', {
                    ...mov,
                    deleted: true,
                    updatedAt: new Date().toISOString(),
                    synced: false
                });

                if (partnerId) {
                    const pMov = await db.get('movements', partnerId) as InventoryMovement;
                    if (pMov) {
                        await db.put('movements', {
                            ...pMov,
                            deleted: true,
                            updatedAt: new Date().toISOString(),
                            synced: false
                        });
                    }
                }
            }

            await loadData();
            syncService.pushChanges();
        } catch (error) {
            console.error('Error deleting movement:', error);
            alert('Error al eliminar');
        }
    }, [loadData, clientId, updateStock, displayName]);

    useEffect(() => {
        loadData();
    }, [clientId]);

    const handleFileUpload = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>, movementId: string, type: 'factura' | 'remito' = 'factura') => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        setUploadingId(movementId);
        try {
            const fileExt = file.name.split('.').pop();
            const bucketName = type === 'factura' ? 'facturas' : 'remitos';
            const filePath = `${clientId}/${bucketName}/${movementId}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from(bucketName).upload(filePath, file, { upsert: true });
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(filePath);
            const publicUrl = publicUrlData.publicUrl;
            const movement = movements.find(m => m.id === movementId);
            if (movement) {
                const updateData = type === 'factura'
                    ? { facturaImageUrl: publicUrl }
                    : { remitoImageUrl: publicUrl };
                await db.put('movements', { ...movement, ...updateData, synced: false, updatedAt: new Date().toISOString() });
                await loadData();
            }
        } catch (error) {
            console.error(`Error uploading ${type}:`, error);
            alert(`Error al subir la ${type === 'factura' ? 'factura' : 'remito'}`);
        } finally {
            setUploadingId(null);
            e.target.value = '';
        }
    }, [clientId, movements, loadData]);

    const formatDate = (dateStr: string, timeStr?: string) => {
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

    const handleEditMovement = React.useCallback(async (m: InventoryMovement) => {
        const label = getMovementLabel(m);
        if (label === 'E-SIEMBRA' || label === 'E-APLICACIÓN') {
            if (m.referenceId) {
                router.push(`/clients/${clientId}/orders/new?editId=${m.referenceId}`);
                return;
            }
        }
        if (label === 'I-COSECHA') {
            if (m.referenceId) {
                const related = (await db.getAll('movements')).filter((mov: any) =>
                    mov.referenceId === m.referenceId &&
                    mov.clientId === clientId &&
                    mov.date === m.date &&
                    !mov.deleted
                );
                setHarvestMovements(related);
            } else {
                setHarvestMovements([]);
            }
            editor.startEdit(m);
            setTimeout(() => {
                editor.setShowEditForm(false);
                setShowHarvestWizard(true);
            }, 0);
            return;
        }

        editor.startEdit(m);
        setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }, 50);
    }, [clientId, router, productsData, editor]);

    const handleRecalcularFuerte = async () => {
        if (!recalculateCampaignId) return alert('Seleccione una campaña de partida.');
        if (!confirm('ATENCIÓN: Esto reescribirá todo el stock actual basándose en los movimientos posteriores a la campaña seleccionada. Esta acción no se puede deshacer. ¿Continuar con el Recálculo Fuerte?')) return;

        setIsRecalculating(true);
        try {
            // 1. Load the snapshot (if not starting from scratch)
            let targetSnapshot = null;
            if (recalculateCampaignId !== 'START_FROM_ZERO') {
                const snapshots = await db.getAll('campaign_snapshots');
                targetSnapshot = snapshots.find((s: CampaignSnapshot) => s.clientId === clientId && s.campaignId === recalculateCampaignId);

                if (!targetSnapshot) {
                    alert('No se encontró un snapshot cerrado para esta campaña. Vaya a Contaduría y cierre la campaña primero.');
                    return;
                }
            }

            // 2. Fetch all current stock to wipe/overwrite
            const allStock = await db.getAll('stock');
            const clientStock = allStock.filter((s: ClientStock) => s.clientId === clientId);

            // Delete current stock
            for (const s of clientStock) {
                await db.delete('stock', s.id);
            }

            // Clear remote fast-cache to prevent Supabase from reviving ghost stock
            try {
                if (navigator.onLine) {
                    const { supabase } = await import('@/lib/supabase');
                    await supabase.from('stock').delete().eq('client_id', clientId);
                }
            } catch (e) {
                console.warn('Could not clear remote stock cache', e);
            }

            // Restore stock from snapshot (using new IDs to prevent primary key issues if recreating)
            let currentTempStock: ClientStock[] = [];
            if (targetSnapshot) {
                for (const s of targetSnapshot.stockSnapshot) {
                    const restoredInstance: ClientStock = {
                        ...s,
                        id: generateId(), // New cache ID
                        lastUpdated: new Date().toISOString(),
                        synced: false
                    };
                    await db.put('stock', restoredInstance);
                    currentTempStock.push(restoredInstance);
                }
            }

            // 3. Fetch all POST-snapshot movements (or all movements if starting from zero) and apply them chronologically
            const allMovements = await db.getAll('movements');
            const postMovements = allMovements.filter((m: InventoryMovement) =>
                m.clientId === clientId &&
                !m.deleted &&
                (targetSnapshot ? new Date(m.createdAt || m.date).getTime() > new Date(targetSnapshot.createdAt).getTime() : true)
            ).sort((a: InventoryMovement, b: InventoryMovement) => new Date(a.createdAt || a.date).getTime() - new Date(b.createdAt || b.date).getTime());

            // 4. Replay logic
            for (const mov of postMovements) {
                // Phase 21: Ignore partner harvest distributions as they do not belong in the physical warehouse stock
                if (mov.type === 'HARVEST' && !mov.warehouseId) continue;

                const isOut = ['OUT', 'SALE'].includes(mov.type);
                const isIn = ['IN', 'HARVEST'].includes(mov.type);

                const processItemMath = (item: { productId: string; quantity: number; tempBrand?: string; presentationLabel?: string; presentationContent?: number; presentationAmount?: number; }) => {
                    const existingIdx = currentTempStock.findIndex(s =>
                        s.productId === item.productId &&
                        s.warehouseId === mov.warehouseId &&
                        s.clientId === clientId &&
                        (item.tempBrand ? (s.productBrand || '').toLowerCase().trim() === item.tempBrand.toLowerCase().trim() : true) &&
                        (item.presentationLabel ? s.presentationLabel === item.presentationLabel : true) &&
                        (item.presentationContent ? s.presentationContent === item.presentationContent : true) &&
                        (mov.campaignId ? s.campaignId === mov.campaignId : true)
                    );

                    if (existingIdx !== -1) {
                        const existing = currentTempStock[existingIdx];
                        let newQty = normalizeNumber(existing.quantity);
                        let newAmount = normalizeNumber(existing.presentationAmount || 0);

                        let itemQty = normalizeNumber(item.quantity);
                        let itemAmount = normalizeNumber(item.presentationAmount || 0);

                        if (isIn) {
                            newQty += itemQty;
                            newAmount += itemAmount;
                        } else if (isOut) {
                            newQty -= itemQty;
                            newAmount -= itemAmount;
                        }

                        currentTempStock[existingIdx] = { ...existing, quantity: newQty, presentationAmount: newAmount, updatedAt: new Date().toISOString(), synced: false };
                    } else if (isIn) { // Only create if it's an IN operation AND didn't exist
                        const newItem: ClientStock = {
                            id: generateId(),
                            clientId,
                            warehouseId: mov.warehouseId,
                            productId: item.productId,
                            productBrand: item.tempBrand,
                            quantity: item.quantity,
                            presentationLabel: item.presentationLabel,
                            presentationContent: item.presentationContent,
                            presentationAmount: item.presentationAmount,
                            lastUpdated: new Date().toISOString(),
                            synced: false,
                            campaignId: mov.campaignId
                        };
                        currentTempStock.push(newItem);
                    }
                };

                if (mov.items && mov.items.length > 0) {
                    for (const item of mov.items) {
                        processItemMath({ ...item, tempBrand: item.productBrand, quantity: normalizeNumber(item.quantity), presentationAmount: normalizeNumber(item.presentationAmount) });
                    }
                } else {
                    processItemMath({
                        productId: mov.productId,
                        quantity: normalizeNumber(mov.quantity),
                        tempBrand: mov.productBrand,
                        presentationLabel: mov.presentationLabel,
                        presentationContent: mov.presentationContent,
                        presentationAmount: normalizeNumber(mov.presentationAmount)
                    });
                }
            }

            // 5. Save all fully calculated stock to DB
            for (const s of currentTempStock) {
                await db.put('stock', s);
            }

            alert(`Recálculo Fuerte completado. Se procesaron ${postMovements.length} movimientos.`);
            setShowRecalculateModal(false);
            setRecalculateCampaignId('');
            // Trigger refresh
            window.location.reload();
        } catch (error) {
            console.error(error);
            alert('Error crítico durante el Recálculo Fuerte.');
        } finally {
            setIsRecalculating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/clients/${clientId}/stock`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Galpón</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Historial de Movimientos</h1>
                    <p className="text-slate-500 mt-1">Ingresos y egresos de insumos.</p>
                </div>
                {!isReadOnly && (
                    <Button
                        onClick={() => setShowRecalculateModal(true)}
                        variant="outline"
                        className="border-orange-200 text-orange-600 hover:bg-orange-50 font-bold uppercase tracking-widest text-[10px]"
                    >
                        ⚡ Recalcular Fuerte
                    </Button>
                )}
            </div>

            {showRecalculateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-3 text-orange-600 mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><polyline points="3 3 3 8 8 8" /><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" /><polyline points="16 16 21 16 21 21" /></svg>
                            <h2 className="text-lg font-bold">Recalcular Fuerte</h2>
                        </div>

                        <p className="text-sm text-slate-600 mb-6">
                            Esta herramienta reconstruye el inventario actual partiendo desde cero.
                            Tomará el registro de stock guardado en la campaña seleccionada y
                            re-aplicará todos los movimientos posteriores matemáticamente.
                        </p>

                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-700 uppercase mb-2 drop-shadow-sm">Iniciar recálculo desde cierre de:</label>
                            <select
                                value={recalculateCampaignId}
                                onChange={e => setRecalculateCampaignId(e.target.value)}
                                className="w-full h-11 px-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-orange-500/20 outline-none text-slate-700 bg-slate-50"
                            >
                                <option value="">Seleccione una Campaña cerrada...</option>
                                <option value="START_FROM_ZERO">Desde cero</option>
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                            <Button
                                variant="outline"
                                onClick={() => setShowRecalculateModal(false)}
                                disabled={isRecalculating}
                            >
                                Cancelar
                            </Button>
                            <Button
                                className="bg-orange-500 hover:bg-orange-600 font-bold"
                                onClick={handleRecalcularFuerte}
                                isLoading={isRecalculating}
                            >
                                {isRecalculating ? 'Procesando...' : 'Iniciar'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

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
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Fecha <br /> de carga</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Insumo</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Marca</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase whitespace-nowrap">N. Comercial</th>
                                    <th className="px-6 py-2 text-center text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Tipo</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">P. Unit.</th>
                                    <th className="px-6 py-2 text-right text-xs font-medium text-slate-500 uppercase whitespace-nowrap">Total</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Vendedor</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase">Pagado por</th>
                                    <th className="px-6 py-2 text-left text-xs font-medium text-slate-500 uppercase min-w-[140px] whitespace-nowrap">Galpón</th>
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
                                    
                                    // Pre-calculate harvest batches
                                    const harvestBatches = new Map<string, InventoryMovement[]>();
                                    movements.forEach(mv => {
                                        if (mv.type === 'HARVEST' && mv.harvestBatchId && !mv.deleted) {
                                            if (!harvestBatches.has(mv.harvestBatchId)) harvestBatches.set(mv.harvestBatchId, []);
                                            harvestBatches.get(mv.harvestBatchId)!.push(mv);
                                        }
                                    });

                                    // Pre-calculate order groups (E-SIEMBRA / E-APLICACIÓN)
                                    const orderGroups = new Map<string, InventoryMovement[]>();
                                    movements.forEach(mv => {
                                        if (mv.type === 'OUT' && mv.referenceId && !mv.referenceId.startsWith('MOVE-') && ordersKey[mv.referenceId] && !mv.deleted) {
                                            if (!orderGroups.has(mv.referenceId)) orderGroups.set(mv.referenceId, []);
                                            orderGroups.get(mv.referenceId)!.push(mv);
                                        }
                                    });

                                    movements.forEach((m: InventoryMovement) => {
                                        if (processedIds.has(m.id)) return;

                                        // Phase 23: Hide non-stock harvest rows (Partner distributions) from the visual history list
                                        if (m.type === 'HARVEST' && !m.warehouseId) return;

                                        // Group Harvest Batches
                                        if (m.type === 'HARVEST' && m.harvestBatchId) {
                                            const batch = harvestBatches.get(m.harvestBatchId);
                                            if (batch && batch.length > 1) {
                                                const totalQty = batch.reduce((acc, curr) => acc + curr.quantity, 0);
                                                groupedMovements.push({
                                                    ...m,
                                                    isBatch: true,
                                                    batchRows: batch,
                                                    quantity: totalQty
                                                });
                                                batch.forEach(bm => processedIds.add(bm.id));
                                                return;
                                            }
                                        }

                                        // Group Order movements (E-SIEMBRA / E-APLICACIÓN with 2+ items)
                                        if (m.type === 'OUT' && m.referenceId && !m.referenceId.startsWith('MOVE-') && ordersKey[m.referenceId]) {
                                            const group = orderGroups.get(m.referenceId);
                                            if (group && group.length > 1) {
                                                groupedMovements.push({
                                                    ...m,
                                                    isOrderGroup: true,
                                                    orderRows: group
                                                });
                                                group.forEach(gm => processedIds.add(gm.id));
                                                return;
                                            }
                                        }

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
                                        const isSelected = (selectedMovement?.movement?.id === m.id) || (selectedOrder?.id === m.referenceId) || (m.isOrderGroup && m.orderRows?.some((r: any) => selectedOrder?.id === r.referenceId));
                                        const isConsolidated = m.items && m.items.length > 1;
                                        const singleItem = (m.items && m.items.length === 1) ? m.items[0] : null;

                                        const labelClass = getMovementBadgeStyles(m.type, m.notes, label).classes;

                                        let showValue = (m.type === 'IN' && !m.isTransfer && m.type !== 'HARVEST') || (m.type === 'SALE');
                                        let totalValue = 0, unitPrice = 0;
                                        if (showValue) {
                                            if (isConsolidated) {
                                                totalValue = m.items.reduce((acc: number, item: any) => acc + (parseFloat(item.price?.toString().replace(',', '.') || '0') * parseFloat(item.quantity?.toString().replace(',', '.') || '0')), 0);
                                                if (m.items.length === 1) unitPrice = parseFloat(m.items[0].price?.toString().replace(',', '.') || '0');
                                            } else {
                                                unitPrice = (m.type === 'IN' ? m.purchasePrice : m.salePrice) || 0;
                                                totalValue = unitPrice * m.quantity;
                                            }
                                        }

                                        const productObj = productsData[m.productId];
                                        let dispName = (isConsolidated || m.isOrderGroup) ? 'Varios' : (singleItem?.productName || m.productName || productObj?.name || 'Insumo');
                                        if (dispName.toLowerCase().includes('soja')) dispName = 'Soja';

                                        // Enrich brand & commercial name from live data
                                        const isHarvestRow = m.type === 'HARVEST' || m.source === 'HARVEST';
                                        const camp = campaigns.find(c => c.id === m.campaignId);
                                        
                                        let dispBrand = '';
                                        // Priority: Catalog > Movement Campaign > Movement Brand
                                        if (productObj?.brandName && productObj.brandName !== '---' && productObj.brandName !== 'Comun') {
                                            dispBrand = productObj.brandName;
                                        } else if (isHarvestRow && camp) {
                                            dispBrand = camp.name;
                                        } else {
                                            dispBrand = singleItem?.productBrand || m.productBrand || '---';
                                        }
                                        if (dispBrand === 'Comun' || dispBrand === 'Común') dispBrand = '---';

                                        let dispCommName = '';
                                        // Priority: Catalog > Movement Detail > "Propia" (if Harvest)
                                        if (productObj?.commercialName && productObj.commercialName !== '---' && productObj.commercialName !== 'Comun') {
                                            dispCommName = productObj.commercialName;
                                        } else if (isHarvestRow) {
                                            dispCommName = 'Propia';
                                        } else {
                                            dispCommName = singleItem?.productCommercialName || m.productCommercialName || '---';
                                        }
                                        if (dispCommName === 'Comun' || dispCommName === 'Común') dispCommName = '---';

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
                                                const related = (await db.getAll('movements')).filter((mov: any) =>
                                                    mov.referenceId === m.referenceId &&
                                                    mov.clientId === clientId &&
                                                    mov.date === m.date &&
                                                    !mov.deleted
                                                );
                                                setHarvestMovements(related);
                                            } else setHarvestMovements([]);
                                        };

                                        return (
                                            <React.Fragment key={m.id}>
                                                <tr onClick={handleRowClick} className={`group cursor-pointer transition-colors ${isSelected ? 'bg-emerald-100/80 hover:bg-emerald-100/90' : 'hover:bg-slate-50'}`}>
                                                    <td className="px-6 py-2 whitespace-nowrap"><div className="text-slate-900 font-medium">{date}</div><div className="text-[10px] text-slate-400 font-mono uppercase">{time}</div></td>
                                                    <td className="px-6 py-2 font-bold text-slate-900">{dispName}</td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">{(isConsolidated || m.isOrderGroup) ? '-' : (dispBrand || '-')}</td>
                                                    <td className="px-6 py-2 text-sm text-slate-500">{(isConsolidated || m.isOrderGroup) ? '-' : (dispCommName || '-')}</td>
                                                    <td className="px-6 py-2 text-center whitespace-nowrap"><span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${labelClass}`}>{label}</span></td>
                                                    <td className="px-6 py-2 text-right font-mono font-bold text-slate-700">{(isConsolidated || m.isOrderGroup) ? '---' : `${Math.abs(Number(singleItem ? singleItem.quantity : m.quantity))} ${singleItem ? singleItem.unit : m.unit}`}</td>
                                                    <td className="px-6 py-2 text-right font-mono text-slate-600">{showValue && !isConsolidated ? `USD ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '---'}</td>
                                                    <td className="px-6 py-2 text-right font-mono text-slate-900 font-bold whitespace-nowrap">{showValue ? <span className={m.type === 'IN' ? 'text-red-500' : 'text-emerald-600'}>USD {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span> : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px]">{m.sellerName || '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 text-[10px] font-bold uppercase truncate max-w-[120px]">
                                                        {m.investorName ? m.investorName : (m.investors && m.investors.length > 1 ? 'Varios' : (m.investors?.[0]?.name || '-'))}
                                                    </td>
                                                    <td className="px-6 py-2 text-[11px] font-medium text-slate-600 min-w-[140px] whitespace-nowrap">
                                                        {m.isTransfer ? `${warehousesKey[m.warehouseId || '']} → ${warehousesKey[m.partnerId || '']}` : 
                                                         (m.isBatch ? (
                                                            <span className="text-slate-900 font-bold">
                                                                Varios
                                                            </span>
                                                         ) : m.isOrderGroup ? '-' : (warehousesKey[m.warehouseId || ''] || m.receiverName || '-'))}
                                                    </td>
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">{m.facturaDate ? formatDate(m.facturaDate).date : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 whitespace-nowrap text-[11px] font-mono">{m.dueDate ? formatDate(m.dueDate).date : '-'}</td>
                                                    <td className="px-6 py-2 text-slate-500 max-w-xs truncate text-[11px]">{m.notes || '-'}</td>
                                                    <td className="px-6 py-2 whitespace-nowrap text-slate-400 font-medium text-[11px]">{m.createdBy || 'Sistema'}</td>
                                                    <td className="px-6 py-2 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleEditMovement(m); }} className="w-8 h-8 text-slate-400 hover:text-emerald-500 p-2 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg></button>}
                                                            {m.facturaImageUrl ? <a href={m.facturaImageUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 border border-emerald-500 text-emerald-500 rounded-md text-[11px] font-black flex items-center justify-center" onClick={e => e.stopPropagation()}>F</a> : (m.type !== 'HARVEST' && !isReadOnly && <div className="relative" onClick={e => e.stopPropagation()}><input type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, m.id, 'factura')} disabled={uploadingId === m.id} /><button className="w-7 h-7 border border-red-500 text-red-500 rounded-md text-[11px] font-black flex items-center justify-center">{uploadingId === m.id ? '...' : 'F'}</button></div>)}
                                                            {(m.type === 'SALE' || m.type === 'OUT' || m.isTransfer) && (
                                                                <>
                                                                    {m.remitoImageUrl ? (
                                                                        <a href={m.remitoImageUrl} target="_blank" rel="noopener noreferrer" className="w-7 h-7 border border-emerald-500 text-emerald-500 rounded-md text-[11px] font-black flex items-center justify-center ml-1" onClick={e => e.stopPropagation()}>R</a>
                                                                    ) : (
                                                                        !isReadOnly && (
                                                                            <div className="relative ml-1" onClick={e => e.stopPropagation()}>
                                                                                <input type="file" accept="image/*,application/pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={(e) => handleFileUpload(e, m.id, 'remito')} disabled={uploadingId === m.id} />
                                                                                <button className="w-7 h-7 border border-red-500 text-red-500 rounded-md text-[11px] font-black flex items-center justify-center">{uploadingId === m.id ? '...' : 'R'}</button>
                                                                            </div>
                                                                        )
                                                                    )}
                                                                </>
                                                            )}
                                                            {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); handleDeleteMovement(m.id, m.partnerId); }} className="w-8 h-8 text-slate-400 hover:text-red-500 p-2 transition-all"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg></button>}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isSelected && (
                                                    <>
                                                        {(m.items && m.items.length > 1 || (m.investors && m.investors.length > 1)) && (
                                                            <>
                                                                {/* Parallel Header for Items and Investors */}
                                                                <tr className="bg-slate-100/60 border-y border-slate-200/50">
                                                                    <td colSpan={1}></td>
                                                                    <td colSpan={7} className="px-10 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumos</td>
                                                                    <td colSpan={1}></td>
                                                                    <td colSpan={7} className="px-10 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado por</td>
                                                                </tr>

                                                                {/* Parallel Zipped Rows */}
                                                                {(() => {
                                                                    const maxRows = Math.max(m.items?.length || 0, (m.investors && m.investors.length > 1 ? m.investors.length : 0));
                                                                    const rows = [];
                                                                    for (let i = 0; i < maxRows; i++) {
                                                                        const it = m.items?.[i];
                                                                        const itProd = it ? productsData[it.productId] : null;
                                                                        const itIsHarvest = m.type === 'HARVEST' || m.source === 'HARVEST';
                                                                        
                                                                        let itBrand = '';
                                                                        let itCommName = '';
                                                                        if (itProd) {
                                                                            itBrand = itProd.brandName && itProd.brandName !== '---' ? itProd.brandName : (it.productBrand || '');
                                                                            itCommName = itProd.commercialName && itProd.commercialName !== '---' ? itProd.commercialName : (it.productCommercialName || '');
                                                                        } else if (it) {
                                                                            itBrand = it.productBrand || '';
                                                                            itCommName = it.productCommercialName || '';
                                                                        }
                                                                        if (it && itIsHarvest) {
                                                                            if (!itBrand || itBrand === '---' || itBrand === 'Comun') { 
                                                                                const camp = campaigns.find(c => c.id === m.campaignId); 
                                                                                itBrand = camp?.name || ''; 
                                                                            }
                                                                            if (!itCommName || itCommName === '---' || itCommName === 'Comun') itCommName = 'Propia';
                                                                        }

                                                                        const inv = (m.investors && m.investors.length > 1) ? m.investors[i] : null;

                                                                        rows.push(
                                                                            <tr key={`${m.id}-parallel-${i}`} className="bg-slate-100/60 text-[11px] border-b border-slate-200/30">
                                                                                <td colSpan={1}></td>
                                                                                {it ? (
                                                                                    <>
                                                                                        <td className="px-6 py-1 font-bold text-slate-600 pl-10 whitespace-nowrap">↳ {it.productName}</td>
                                                                                        <td className="px-6 py-1 text-slate-400 font-bold uppercase">{itBrand || '-'}</td>
                                                                                        <td className="px-6 py-1 text-slate-400 font-bold uppercase">{itCommName || '-'}</td>
                                                                                        <td colSpan={1}></td>
                                                                                        <td className="px-6 py-1 text-right font-mono font-bold text-slate-500">{Math.abs(Number(it.quantity))} {it.unit || m.unit}</td>
                                                                                        <td className="px-6 py-1 text-right font-mono text-slate-400 whitespace-nowrap">USD {Number(it.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                        <td className="px-6 py-1 text-right font-mono text-slate-700 font-bold whitespace-nowrap">USD {(it.quantity * (it.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                                    </>
                                                                                ) : (
                                                                                    <td colSpan={7}></td>
                                                                                )}
                                                                                <td colSpan={1}></td>
                                                                                {inv ? (
                                                                                    <td className="px-6 py-2 font-bold text-slate-600 pl-10 whitespace-nowrap">↳ {inv.name} <span className="text-slate-400 font-medium ml-2">({inv.percentage}%)</span></td>
                                                                                ) : (
                                                                                    <td></td>
                                                                                )}
                                                                                <td colSpan={6}></td>
                                                                            </tr>
                                                                        );
                                                                    }
                                                                    return rows;
                                                                })()}
                                                            </>
                                                        )}
                                                        {m.isBatch && (
                                                            <>
                                                                <tr className="bg-slate-100/60 border-y border-slate-200/50">
                                                                    <td colSpan={10} className="px-6 py-1.5"></td>
                                                                    <td colSpan={6} className="px-6 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Destinos de Cosecha</td>
                                                                </tr>
                                                                {m.batchRows?.map((bm: InventoryMovement, i: number) => (
                                                                    <tr key={`${m.id}-batch-${i}`} className="bg-slate-100/60 text-[11px] border-b border-slate-200/30">
                                                                        <td colSpan={10} className="px-6 py-1"></td>
                                                                        <td colSpan={2} className="px-6 py-1 font-bold text-slate-600 whitespace-nowrap">↳ {warehousesKey[bm.warehouseId || ''] || bm.receiverName || 'Desconocido'}</td>
                                                                        <td colSpan={4} className="px-6 py-1 text-[11px] text-slate-500 font-mono">
                                                                            {Math.abs(bm.quantity).toLocaleString()} kg
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </>
                                                        )}
                                                        {m.isOrderGroup && m.orderRows && (
                                                            <>
                                                                <tr className="bg-slate-100/60 border-y border-slate-200/50">
                                                                    <td colSpan={1}></td>
                                                                    <td colSpan={15} className="px-10 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Insumos</td>
                                                                </tr>
                                                                {m.orderRows.map((om: InventoryMovement, i: number) => {
                                                                    const omProd = productsData[om.productId];
                                                                    let omBrand = omProd?.brandName && omProd.brandName !== '---' ? omProd.brandName : (om.productBrand || '-');
                                                                    let omCommName = omProd?.commercialName && omProd.commercialName !== '---' ? omProd.commercialName : (om.productCommercialName || '-');
                                                                    if (omBrand === 'Comun' || omBrand === 'Común') omBrand = '-';
                                                                    if (omCommName === 'Comun' || omCommName === 'Común') omCommName = '-';
                                                                    return (
                                                                        <tr key={`${m.id}-order-${i}`} className="bg-slate-100/60 text-[11px] border-b border-slate-200/30">
                                                                            <td colSpan={1}></td>
                                                                            <td className="px-6 py-1 font-bold text-slate-600 pl-10 whitespace-nowrap">↳ {om.productName || omProd?.name || 'Insumo'}</td>
                                                                            <td className="px-6 py-1 text-slate-400 font-bold uppercase">{omBrand}</td>
                                                                            <td className="px-6 py-1 text-slate-400 font-bold uppercase">{omCommName}</td>
                                                                            <td colSpan={1}></td>
                                                                            <td className="px-6 py-1 text-right font-mono font-bold text-slate-500">{Math.abs(Number(om.quantity))} {om.unit}</td>
                                                                            <td className="px-6 py-1 text-right font-mono text-slate-400">---</td>
                                                                            <td className="px-6 py-1 text-right font-mono text-slate-400">---</td>
                                                                            <td colSpan={8}></td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </>
                                                        )}

                                                    </>
                                                )}
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
                        <MovementDetailsView
                            movement={selectedMovement.movement}
                            client={client}
                            order={selectedMovement.order}
                            typeLabel={selectedMovement.typeLabel}
                            originName={selectedMovement.movement.isTransfer ? warehousesKey[selectedMovement.movement.warehouseId || ''] : undefined}
                            destName={selectedMovement.movement.isTransfer ? warehousesKey[selectedMovement.movement.partnerId || ''] : warehousesKey[selectedMovement.movement.warehouseId || '']}
                            onClose={() => setSelectedMovement(null)}
                            onEdit={() => handleEditMovement(selectedMovement.movement)}
                            isReadOnly={isReadOnly}
                            campaigns={campaigns}
                        />
                    )}
                </div>
            )}

            {selectedSubMovement && client && (
                <div className="mt-4 animate-slideUp">
                    <MovementDetailsView
                        movement={selectedSubMovement.movement}
                        client={client}
                        order={selectedSubMovement.order}
                        typeLabel={selectedSubMovement.typeLabel}
                        originName={selectedSubMovement.movement.isTransfer ? warehousesKey[selectedSubMovement.movement.warehouseId || ''] : undefined}
                        destName={selectedSubMovement.movement.isTransfer ? warehousesKey[selectedSubMovement.movement.partnerId || ''] : warehousesKey[selectedSubMovement.movement.warehouseId || '']}
                        onClose={() => setSelectedSubMovement(null)}
                        onEdit={() => handleEditMovement(selectedSubMovement.movement)}
                        isReadOnly={isReadOnly}
                        campaigns={campaigns}
                    />
                </div>
            )}

            {selectedOrder && client && (
                <div className="mt-4">
                    <OrderDetailView 
                        order={selectedOrder} 
                        client={client} 
                        onClose={() => setSelectedOrder(null)} 
                        onEdit={() => router.push(`/clients/${clientId}/orders/new?editId=${selectedOrder.id}`)}
                        warehouses={warehousesFull} 
                        createdBy={displayName || 'Sistema'} 
                        isReadOnly={isReadOnly} 
                    />
                </div>
            )}

            {showHarvestWizard && editor.editingMovement && (
                <HarvestWizard
                    // Use allLotsFull if lot id matches
                    lot={allLotsFull.find(l => l.id === editor.editingMovement?.referenceId?.split('_')[0]) || lots.find(l => l.id === editor.editingMovement?.referenceId?.split('_')[0]) || {} as any}
                    farm={farms.find(f => f.lots?.some((l: any) => l.id === editor.editingMovement?.referenceId?.split('_')[0])) || farms.find(f => f.id === (editor.editingMovement as any)?.farmId) || null as any}
                    contractors={contractors} // Dynamically loaded contractors
                    campaigns={campaigns}
                    warehouses={warehousesList} // Fixes unfiltered warehouses crash, now properly restricted to current client
                    defaultWhId={client?.defaultHarvestWarehouseId}
                    partners={client?.partners || []}
                    investors={client?.investors || []}
                    movements={movements}
                    onCancel={() => { setShowHarvestWizard(false); editor.setEditingMovement(null); setHarvestMovements([]); }}
                    onComplete={async (data) => {
                        try {
                             if (!editor.editingMovement) return;
                             const { date } = data;
                             const lotId = editor.editingMovement?.referenceId?.split('_')[0] || '';
                             const lot = allLotsFull.find((l: any) => l.id === lotId) || lots.find(l => l.id === lotId) || {} as any;

                             await processHarvest({
                                 db,
                                 clientId,
                                 lot,
                                 data,
                                 campaigns,
                                 products: Object.values(productsData),
                                 identity: { displayName: displayName || 'Sistema' },
                                 updaters: {
                                     updateStock: (s) => db.put('stock', s),
                                     updateLot: (l) => db.put('lots', l),
                                     addProduct: (p) => db.put('products', p).then(() => p as Product)
                                 },
                                 isEditing: true,
                                 existingBatchId: editor.editingMovement?.harvestBatchId,
                                 existingOrder: ordersData.find((o: any) => o.harvestBatchId === editor.editingMovement?.harvestBatchId && !o.deleted)
                             });

                             syncService.pushChanges();
                             setShowHarvestWizard(false); 
                             editor.setEditingMovement(null); 
                            
                            // Refresh modal state if it's open
                            const freshMovements = await db.getAll('movements');
                            const related = freshMovements.filter((mov: any) =>
                                mov.referenceId === editor.editingMovement?.referenceId &&
                                mov.clientId === clientId &&
                                mov.date === (date || editor.editingMovement?.date) &&
                                !mov.deleted
                            );
                            
                            if (selectedMovement && related.length > 0) {
                                // We pick the first one as the new "primary" selected movement just like handleRowClick does
                                setSelectedMovement({ movement: related[0], order: selectedMovement.order, typeLabel: selectedMovement.typeLabel });
                                setHarvestMovements(related);
                            } else {
                                setHarvestMovements([]);
                            }
                            
                            loadData();
                        } catch (error) {
                            console.error(error); alert("Error al actualizar la cosecha.");
                        }
                    }}
                    initialDate={editor.editingMovement?.date}
                    initialContractor={editor.editingMovement?.contractorName || ''}
                    initialLaborPrice={editor.editingMovement?.harvestLaborPricePerHa ? String(editor.editingMovement?.harvestLaborPricePerHa) : editor.editingMovement?.harvestLaborCost ? String(editor.editingMovement?.harvestLaborCost) : ''}
                    initialYield={String(harvestMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0))}
                    isExecutingPlan={false} // Editing an existing one
                    // Map ALL related peer harvest movements (they are all type: HARVEST)
                    initialDistributions={harvestMovements.map(m => ({
                        id: m.id,
                        type: m.warehouseId ? 'WAREHOUSE' : 'PARTNER',
                        targetId: m.warehouseId || m.receiverName || (m.investors && m.investors.length > 0 ? m.investors[0].name : '') || '',
                        targetName: warehousesKey[m.warehouseId || ''] || m.receiverName || (m.investors && m.investors.length > 0 ? m.investors[0].name : '') || 'Desconocido',
                        amount: Math.abs(m.quantity),
                        transportSheets: m.transportSheets || [],
                        logistics: {
                            grainType: (m as any).type?.includes('SEMILLA') ? 'SEMILLA' : 'GRANO',
                            campaignId: m.campaignId,
                            investorName: m.investorName,
                            investors: m.investors,
                            originAddress: m.originAddress,
                            transportName: m.transportName,
                            transportCuit: m.transportCuit,
                            driverName: m.driverName,
                            driverCuit: m.driverCuit,
                            truckPlate: m.truckPlate,
                            trailerPlate: m.trailerPlate,
                            observations: m.notes
                        } as any
                    }))}
                    initialTransportSheets={Array.from(new Map(
                        harvestMovements.flatMap(m => m.transportSheets || []).map(sheet => [sheet.id, sheet])
                    ).values())}
                />
            )}

            {editor.showEditForm && editor.editingMovement && (
                <div className="mt-8 animate-slideUp">
                    {(editor.editingMovement.type === 'SALE' || editor.editingMovement.type === 'OUT') ? (
                        <StockSalePanel
                            titleOverride={editor.editingMovement?.type === 'SALE' ? "Editar Venta" : "Editar Retiro"}
                            stockItem={{
                                productId: editor.editingMovement.productId,
                                productName: productsData[editor.editingMovement.productId]?.name || editor.editingMovement.productName,
                                productType: productsData[editor.editingMovement.productId]?.type,
                                productBrand: productsData[editor.editingMovement.productId]?.brandName || editor.editingMovement.productBrand,
                                productCommercialName: productsData[editor.editingMovement.productId]?.commercialName || (editor.editingMovement as any).productCommercialName,
                                quantity: (stock.find(s => s.productId === editor.editingMovement!.productId)?.quantity || 0) + editor.editingMovement.quantity,
                                unit: editor.editingMovement.unit,
                                warehouseId: editor.selectedWarehouseId,
                                warehouseName: warehousesKey[editor.selectedWarehouseId] || 'Galpón'
                            }}
                            onClose={() => { editor.setShowEditForm(false); editor.setEditingMovement(null); }}
                            onSubmit={async (e) => { e?.preventDefault(); await editor.saveEdit(); }}
                            saleQuantity={editor.saleQuantity} 
                            setSaleQuantity={editor.setSaleQuantity}
                            salePrice={editor.salePrice}
                            setSalePrice={editor.setSalePrice}
                            isSubmitting={editor.isSubmitting}
                            facturaUploading={facturaUploading}
                            saleTruckDriver={editor.saleTruckDriver}
                            setSaleTruckDriver={editor.setSaleTruckDriver}
                            salePlateNumber={editor.salePlateNumber}
                            setSalePlateNumber={editor.setSalePlateNumber}
                            saleTrailerPlate={editor.saleTrailerPlate}
                            setSaleTrailerPlate={editor.setSaleTrailerPlate}
                            saleDestinationCompany={editor.saleDestinationCompany}
                            setSaleDestinationCompany={editor.setSaleDestinationCompany}
                            saleDestinationAddress={editor.saleDestinationAddress}
                            setSaleDestinationAddress={editor.setSaleDestinationAddress}
                            salePrimarySaleCuit={editor.salePrimarySaleCuit}
                            setSalePrimarySaleCuit={editor.setSalePrimarySaleCuit}
                            saleTransportCompany={editor.saleTransportCompany}
                            setSaleTransportCompany={editor.setSaleTransportCompany}
                            saleDischargeNumber={editor.saleDischargeNumber}
                            setSaleDischargeNumber={editor.setSaleDischargeNumber}
                            saleHumidity={editor.saleHumidity}
                            setSaleHumidity={editor.setSaleHumidity}
                            saleHectoliterWeight={editor.saleHectoliterWeight}
                            setSaleHectoliterWeight={editor.setSaleHectoliterWeight}
                            saleGrossWeight={editor.saleGrossWeight}
                            setSaleGrossWeight={editor.setSaleGrossWeight}
                            saleTareWeight={editor.saleTareWeight}
                            setSaleTareWeight={editor.setSaleTareWeight}
                            saleDistanceKm={editor.saleDistanceKm}
                            setSaleDistanceKm={editor.setSaleDistanceKm}
                            saleDepartureDateTime={editor.saleDepartureDateTime}
                            setSaleDepartureDateTime={editor.setSaleDepartureDateTime}
                            saleFreightTariff={editor.saleFreightTariff}
                            setSaleFreightTariff={editor.setSaleFreightTariff}
                            showSaleNote={editor.showNote}
                            setShowSaleNote={editor.setShowNote}
                            saleNote={editor.note}
                            setSaleNote={editor.setNote}
                            saleFacturaFile={facturaFile}
                            setSaleFacturaFile={setFacturaFile}
                            saleRemitoFile={null}
                            setSaleRemitoFile={() => {}}
                        />
                    ) : (
                        <StockEntryForm 
                            showStockForm={true} 
                            setShowStockForm={editor.setShowEditForm} 
                            warehouses={warehousesFull} 
                            activeWarehouseIds={editor.selectedWarehouseId ? [editor.selectedWarehouseId] : []} 
                            selectedWarehouseId={editor.selectedWarehouseId} 
                            setSelectedWarehouseId={editor.setSelectedWarehouseId} 
                            availableProducts={Object.values(productsData).filter(p => p.clientId === clientId)} 
                            activeStockItem={editor.activeStockItem as any} 
                            updateActiveStockItem={editor.updateActiveStockItem} 
                            stockItems={editor.stockItems} 
                            setStockItems={editor.setStockItems as any} 
                            addStockToBatch={editor.addStockToBatch} 
                            editBatchItem={editor.editBatchItem} 
                            removeBatchItem={editor.removeBatchItem} 
                            availableSellers={availableSellers} 
                            selectedSeller={editor.selectedSeller} 
                            setSelectedSeller={editor.setSelectedSeller} 
                            showSellerInput={showSellerInput} 
                            setShowSellerInput={setShowSellerInput} 
                            sellerInputValue={sellerInputValue} 
                            setSellerInputValue={setSellerInputValue} 
                            handleAddSeller={() => { 
                                if (sellerInputValue.trim()) { 
                                    setAvailableSellers((prev: any) => [...prev, sellerInputValue.trim()]); 
                                    editor.setSelectedSeller(sellerInputValue.trim()); 
                                    setSellerInputValue(''); 
                                    setShowSellerInput(false); 
                                } 
                            }} 
                            showSellerDelete={showSellerDelete} 
                            setShowSellerDelete={setShowSellerDelete} 
                            setAvailableSellers={setAvailableSellers} 
                            saveClientSellers={() => { }} 
                            selectedInvestors={editor.selectedInvestors} 
                            setSelectedInvestors={editor.setSelectedInvestors} 
                            client={client!} 
                            showNote={editor.showNote} 
                            setShowNote={editor.setShowNote} 
                            note={editor.note} 
                            setNote={editor.setNote} 
                            setNoteConfirmed={() => { }} 
                            facturaFile={facturaFile} 
                            setFacturaFile={setFacturaFile} 
                            handleFacturaChange={(e: any) => { 
                                if (e.target.files?.[0]) setFacturaFile(e.target.files[0]); 
                            }} 
                            handleStockSubmit={async (e: any) => { e?.preventDefault(); await editor.saveEdit(); }} 
                            isSubmitting={editor.isSubmitting} 
                            facturaUploading={facturaUploading} 
                            campaigns={campaigns} 
                            selectedCampaignId={editor.selectedCampaignId} 
                            setSelectedCampaignId={editor.setSelectedCampaignId} 
                            facturaDate={editor.facturaDate} 
                            setFacturaDate={editor.setFacturaDate} 
                            dueDate={editor.dueDate} 
                            setDueDate={editor.setDueDate} 
                            isEditing={true} 
                        />
                    )}
                </div>
            )}

            <div className="flex justify-end pr-2 pb-4 mt-6">
                <Link href={`/clients/${clientId}/stock`} className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium">Volver</Link>
            </div>
        </div>
    );
}
