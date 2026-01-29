'use client';

import React, { use, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { ProductType, Unit, InventoryMovement, ClientStock, Product, Observation } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { syncService } from '@/services/sync';
import { supabase } from '@/lib/supabase';
import { StockMovementPanel } from '@/components/StockMovementPanel';

interface EnrichedStockItem extends ClientStock {
    productName: string;
    warehouseName: string;
    productType: ProductType;
    unit: Unit;
    price: number;
    productBrand?: string;
    hasProduct: boolean;
}

export default function ClientStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { stock, updateStock, loading: stockLoading } = useClientStock(id);
    const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loading: warehousesLoading } = useWarehouses(id);
    const { products, addProduct, updateProduct, deleteProduct, loading: productsLoading } = useInventory(); // Added deleteProduct

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showStockForm, setShowStockForm] = useState(false);
    const [showProductForm, setShowProductForm] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [showWarehouses, setShowWarehouses] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Active Warehouse context
    const [activeWarehouseId, setActiveWarehouseId] = useState<string | null>(null);
    const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
    const [selectedInManagerId, setSelectedInManagerId] = useState<string | null>(null); // For click interaction
    const [editName, setEditName] = useState('');

    // Stock Selection state
    const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
    const [showMovePanel, setShowMovePanel] = useState(false);

    // New entry state
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [newProductBrand, setNewProductBrand] = useState('');
    const [newProductPA, setNewProductPA] = useState('');
    const [newProductType, setNewProductType] = useState<ProductType>('HERBICIDE');
    const [newProductUnit, setNewProductUnit] = useState<Unit>('L');
    const [availableUnits, setAvailableUnits] = useState<string[]>(['L', 'KG']);
    const [unitsLoaded, setUnitsLoaded] = useState(false);
    const [showUnitInput, setShowUnitInput] = useState(false);
    const [showUnitDelete, setShowUnitDelete] = useState(false);
    const [unitInputValue, setUnitInputValue] = useState('');
    const [newProductPrice, setNewProductPrice] = useState(''); // Added Price
    const [quantity, setQuantity] = useState('');
    const [transactionPrice, setTransactionPrice] = useState(''); // PRICE PAID
    const [note, setNote] = useState('');
    const [noteConfirmed, setNoteConfirmed] = useState(false);
    const [tempBrand, setTempBrand] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);

    // Factura upload state
    const [sellingStockId, setSellingStockId] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [saleNote, setSaleNote] = useState('');
    const [showSaleNote, setShowSaleNote] = useState(false);
    const [saleFacturaFile, setSaleFacturaFile] = useState<File | null>(null);
    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [facturaUploading, setFacturaUploading] = useState(false);

    const unitInputRef = useRef<HTMLDivElement>(null);

    // Handle file selection
    const handleFacturaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFacturaFile(e.target.files[0]);
        }
    };

    // Upload factura to Supabase Storage and return public URL
    const uploadFactura = async (movementId: string) => {
        if (!facturaFile) return '';
        const fileExt = facturaFile.name.split('.').pop();
        const filePath = `${id}/facturas/${movementId}.${fileExt}`;
        const { data, error } = await supabase.storage
            .from('facturas')
            .upload(filePath, facturaFile, { upsert: true });
        if (error) {
            console.error('Factura upload error:', error);
            return '';
        }
        const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrlData.publicUrl;
    };

    // Persistence for form state
    useEffect(() => {
        const savedProduct = sessionStorage.getItem(`stock_productId_${id}`);
        const savedQuantity = sessionStorage.getItem(`stock_quantity_${id}`);
        const savedNote = sessionStorage.getItem(`stock_note_${id}`);
        const savedShowNote = sessionStorage.getItem(`stock_showNote_${id}`);

        if (savedProduct) setSelectedProductId(savedProduct);
        if (savedQuantity) setQuantity(savedQuantity);
        if (savedNote) setNote(savedNote);
        if (savedShowNote === 'true') setShowNote(true);

        if (savedProduct) setSelectedProductId(savedProduct);
        if (savedQuantity) setQuantity(savedQuantity);
        if (savedNote) setNote(savedNote);
        if (savedShowNote === 'true') setShowNote(true);

        const savedShowStockForm = sessionStorage.getItem(`stock_showStockForm_${id}`);
        const savedShowProductForm = sessionStorage.getItem(`stock_showProductForm_${id}`);
        const savedShowCatalog = sessionStorage.getItem(`stock_showCatalog_${id}`);
        const savedShowWarehouses = sessionStorage.getItem(`stock_showWarehouses_${id}`);
        const savedActiveW = sessionStorage.getItem(`stock_activeW_${id}`);

        if (savedShowStockForm === 'true') setShowStockForm(true);
        if (savedShowProductForm === 'true') setShowProductForm(true);
        if (savedShowCatalog === 'true') setShowCatalog(true);
        if (savedShowWarehouses === 'true') setShowWarehouses(true);
        if (savedActiveW) setActiveWarehouseId(savedActiveW === 'null' ? null : savedActiveW);
    }, [id]);

    // Handle default selection if none set
    useEffect(() => {
        // Only force selection if ID is invalid (deleted), but allow NULL (user deselected)
        if (activeWarehouseId && warehouses.length > 0 && !warehouses.find(w => w.id === activeWarehouseId)) {
            // Safety: if active warehouse was deleted, move to first
            setActiveWarehouseId(warehouses[0].id);
        }
        // Removed logic that forced warehouses[0] if activeWarehouseId was null
    }, [warehouses, activeWarehouseId]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showStockForm_${id}`, showStockForm.toString());
    }, [showStockForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showProductForm_${id}`, showProductForm.toString());
    }, [showProductForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showCatalog_${id}`, showCatalog.toString());
    }, [showCatalog, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showWarehouses_${id}`, showWarehouses.toString());
    }, [showWarehouses, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_activeW_${id}`, activeWarehouseId || 'null');
        if (activeWarehouseId) setSelectedWarehouseId(activeWarehouseId);
        else setSelectedWarehouseId('');
    }, [activeWarehouseId, id]);

    useEffect(() => {
        if (selectedProductId) {
            sessionStorage.setItem(`stock_productId_${id}`, selectedProductId);
            // Default tempBrand to product's brandName
            const product = products.find(p => p.id === selectedProductId);
            if (product && !tempBrand) {
                setTempBrand(product.brandName || '');
            }
        }
        else {
            sessionStorage.removeItem(`stock_productId_${id}`);
            setTempBrand('');
        }
    }, [selectedProductId, id, products]);

    useEffect(() => {
        if (quantity) sessionStorage.setItem(`stock_quantity_${id}`, quantity);
        else sessionStorage.removeItem(`stock_quantity_${id}`);
    }, [quantity, id]);

    useEffect(() => {
        if (note) sessionStorage.setItem(`stock_note_${id}`, note);
        else sessionStorage.removeItem(`stock_note_${id}`);
    }, [note, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showNote_${id}`, showNote.toString());
    }, [showNote, id]);


    // Load available units from Client persistence
    useEffect(() => {
        const loadClientUnits = async () => {
            try {
                const client = await db.get('clients', id);
                if (client?.enabledUnits) {
                    setAvailableUnits(client.enabledUnits);
                    // If current unit is not in the loaded list, reset it
                    if (client.enabledUnits.length > 0) {
                        if (!client.enabledUnits.includes(newProductUnit)) {
                            setNewProductUnit(client.enabledUnits[0]);
                        }
                    } else {
                        setNewProductUnit(''); // Select placeholder if empty
                    }
                }
                setUnitsLoaded(true);
            } catch (error) {
                console.error('Error loading client units:', error);
                setUnitsLoaded(true);
            }
        };
        loadClientUnits();
    }, [id]);

    // Close unit input on click outside if empty
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showUnitInput &&
                !unitInputValue.trim() &&
                unitInputRef.current &&
                !unitInputRef.current.contains(event.target as Node)
            ) {
                setShowUnitInput(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUnitInput, unitInputValue]);

    // Save available units to Client persistence
    const saveClientUnits = async (newUnits: string[]) => {
        try {
            const client = await db.get('clients', id);
            if (client) {
                await db.put('clients', {
                    ...client,
                    enabledUnits: newUnits,
                    synced: false,
                    updatedAt: new Date().toISOString()
                });
                syncService.pushChanges();
            }
        } catch (error) {
            console.error('Error saving client units:', error);
        }
    };

    const handleAddUnit = () => {
        if (unitInputValue.trim()) {
            const upper = unitInputValue.trim().toUpperCase();
            if (!availableUnits.includes(upper)) {
                const newUnits = [...availableUnits, upper];
                setAvailableUnits(newUnits);
                saveClientUnits(newUnits);
                setNewProductUnit(upper);
            }
            setUnitInputValue('');
            setShowUnitInput(false);
        }
    };

    // Filter products: show ONLY client-specific ones (Strict Per-Client Isolation)
    const availableProducts = useMemo(() => {
        return products.filter(p => p.clientId === id);
    }, [products, id]);

    // Check for duplicates in real-time
    useEffect(() => {
        if (!showProductForm) {
            setIsDuplicate(false);
            return;
        }

        const duplicate = availableProducts.find(p =>
            p.id !== editingProductId && // Don't count self when editing
            p.activeIngredient?.toLowerCase().trim() === newProductPA.toLowerCase().trim() &&
            p.brandName?.toLowerCase().trim() === newProductBrand.toLowerCase().trim()
        );

        setIsDuplicate(!!duplicate);
    }, [newProductPA, newProductBrand, availableProducts, showProductForm, editingProductId]);

    // Enrich stock data with product details (name, unit, type)
    const enrichedStock = useMemo<EnrichedStockItem[]>(() => {
        const firstId = warehouses[0]?.id;
        const filteredStock = stock.filter((item: ClientStock) => {
            // Match current active warehouse
            // Also include null/undefined stock in the FIRST warehouse for transition
            const effectiveWId = item.warehouseId || firstId;
            return effectiveWId === activeWarehouseId;
        });

        return filteredStock.map((item: ClientStock) => {
            const product = products.find(p => p.id === item.productId);
            const warehouse = warehouses.find(w => w.id === item.warehouseId);
            return {
                ...item,
                productName: product?.name || 'Producto Desconocido',
                warehouseName: warehouse?.name || (item.warehouseId === null && warehouses[0] ? warehouses[0].name : 'Galpón'),
                productType: product?.type || 'OTHER',
                unit: product?.unit || 'UNIT',
                price: product?.price || 0,
                productBrand: product?.brandName || '',
                hasProduct: !!product
            };
        }).filter(item => item.hasProduct);
    }, [stock, products, warehouses, activeWarehouseId]);

    // Auto-update Sale Note with pricing details
    useEffect(() => {
        if (sellingStockId && saleQuantity && salePrice) {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (stockItem) {
                const qtyNum = parseFloat(saleQuantity);
                const priceNum = parseFloat(salePrice);
                if (!isNaN(qtyNum) && !isNaN(priceNum)) {
                    setSaleNote(`${priceNum} $/ ${stockItem.unit}, $${(qtyNum * priceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total`);
                }
            }
        }
    }, [sellingStockId, saleQuantity, salePrice, enrichedStock]);

    const handleProductSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductName) return;
        setIsSubmitting(true);
        try {
            if (editingProductId) {
                // Update existing
                await updateProduct({
                    id: editingProductId,
                    name: newProductName,
                    brandName: newProductBrand,
                    activeIngredient: newProductPA,
                    type: newProductType,
                    unit: newProductUnit,
                    price: parseFloat(newProductPrice) || 0,
                    clientId: id
                });
            } else {
                // Create new
                await addProduct({
                    name: newProductName,
                    brandName: newProductBrand,
                    activeIngredient: newProductPA,
                    type: newProductType,
                    unit: newProductUnit,
                    price: parseFloat(newProductPrice) || 0,
                    clientId: id
                });
            }

            setNewProductName('');
            setNewProductBrand('');
            setNewProductPA('');
            setNewProductPrice('');
            setEditingProductId(null);
            setIsEditingProduct(false);
            setShowProductForm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProductId || !quantity) return;

        setIsSubmitting(true);
        try {
            const qtyNum = parseFloat(quantity);
            const existingItem = stock.find((s: ClientStock) => s.productId === selectedProductId && s.warehouseId === (selectedWarehouseId || undefined));

            const newItem = {
                id: (existingItem && (!selectedWarehouseId || existingItem.warehouseId === selectedWarehouseId)) ? existingItem.id : generateId(),
                clientId: id,
                warehouseId: selectedWarehouseId || undefined,
                productId: selectedProductId,
                quantity: (existingItem && (!selectedWarehouseId || existingItem.warehouseId === selectedWarehouseId)) ? existingItem.quantity + qtyNum : qtyNum,
                lastUpdated: new Date().toISOString()
            };

            await updateStock(newItem);

            // Record Movement
            const product = availableProducts.find((p: Product) => p.id === selectedProductId);
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const movementId = generateId();
            let facturaUrl = '';

            if (facturaFile) {
                setFacturaUploading(true);
                facturaUrl = await uploadFactura(movementId);
                setFacturaUploading(false);
            }

            await db.put('movements', {
                id: movementId,
                clientId: id,
                productId: selectedProductId,
                productName: product?.name || 'Unknown',
                productBrand: tempBrand || product?.brandName || '-',
                type: 'IN',
                quantity: qtyNum,
                unit: product?.unit || 'L',
                date: dateStr,
                time: timeStr,
                referenceId: newItem.id,
                notes: note || '-',
                facturaImageUrl: facturaUrl || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false
            });

            syncService.pushChanges();

            // Reset form fields for next entry (Batch mode)
            setSelectedProductId('');
            setSelectedWarehouseId('');
            setQuantity('');
            setNote('');
            setNoteConfirmed(false);
            setTempBrand('');
            setShowNote(false);
            setFacturaFile(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sellingStockId || !saleQuantity || !salePrice) return;

        setIsSubmitting(true);
        try {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (!stockItem) return;

            const qtyNum = parseFloat(saleQuantity);
            const priceNum = parseFloat(salePrice);

            // Record Movement
            const movementId = generateId();
            let facturaUrl = '';

            if (saleFacturaFile) {
                setFacturaUploading(true);
                // Temporarily use the existing facturaFile state for the upload helper if needed, 
                // but let's just use the saleFacturaFile directly in the helper logic or inline it.
                const fileExt = saleFacturaFile.name.split('.').pop();
                const filePath = `${id}/facturas/${movementId}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('facturas')
                    .upload(filePath, saleFacturaFile, { upsert: true });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
                    facturaUrl = publicUrlData.publicUrl;
                }
                setFacturaUploading(false);
            }

            // Update Stock
            await updateStock({
                ...stockItem,
                quantity: stockItem.quantity - qtyNum,
                lastUpdated: new Date().toISOString()
            });

            await db.put('movements', {
                id: movementId,
                clientId: id,
                warehouseId: stockItem.warehouseId,
                productId: stockItem.productId,
                productName: stockItem.productName,
                productBrand: stockItem.productBrand || '-',
                type: 'SALE',
                quantity: qtyNum,
                unit: stockItem.unit,
                salePrice: priceNum,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                referenceId: `SALE-${generateId()}`,
                notes: saleNote || `${priceNum} $/ ${stockItem.unit}, $${(qtyNum * priceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total`,
                facturaImageUrl: facturaUrl || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: new Date().toISOString(),
                synced: false
            });

            syncService.pushChanges();
            setSellingStockId(null);
            setSaleQuantity('');
            setSalePrice('');
            setSaleNote('');
            setShowSaleNote(false);
            setSaleFacturaFile(null);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmMove = async (action: 'WITHDRAW' | 'TRANSFER', quantities: Record<string, number>, destinationWarehouseId?: string, note?: string) => {
        // Iterate over selected IDs
        // For each, create movement(s) and update stock

        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        for (const itemId of selectedStockIds) {
            const item = enrichedStock.find(i => i.id === itemId);
            if (!item) continue;

            const qtyToMove = quantities[itemId] || 0;
            if (qtyToMove <= 0) continue;

            const product = products.find(p => p.id === item.productId);

            // 1. Create OUT Movement (Origin)
            await db.put('movements', {
                id: generateId(),
                clientId: id,
                warehouseId: item.warehouseId,
                productId: item.productId,
                productName: item.productName,
                productBrand: item.productBrand || '-',
                type: 'OUT',
                quantity: qtyToMove,
                unit: item.unit,
                date: dateStr,
                time: timeStr,
                referenceId: `MOVE-${now.getTime()}`,
                notes: `${action === 'WITHDRAW' ? 'Retiro de stock' : 'Traslado a ' + (warehouses.find(w => w.id === destinationWarehouseId)?.name || 'galpón')} - ${note || ''}`,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false
            });

            // 2. Update Origin Stock
            // We use updateStock logic manually or helper
            // Note: item.quantity is UI value, we should check DB value theoretically but here we'll update with sub logic
            // Careful: item might differ from DB if race condition, but assuming single user active logic for now.
            // Better to re-fetch or use db.get but we have local `stock` state which is synced.
            // Let's rely on item.quantity being reasonably fresh or calculate from existing `stock` list raw

            const currentStockItem = stock.find(s => s.id === item.id);
            if (currentStockItem) {
                const newQty = currentStockItem.quantity - qtyToMove;
                // If 0, do we delete? Or leave as 0? Usually stock records at 0 might be kept or deleted.
                // Logic in handleAddStock doesn't delete. Let's keep at 0 for now or delete if desired.
                // Keeping at 0 allows history view of "runs out".
                await updateStock({ ...currentStockItem, quantity: Math.max(0, newQty) });
            }

            // 3. If TRANSFER, create IN (Destination)
            if (action === 'TRANSFER' && destinationWarehouseId) {
                // Find existing stock at destination
                // We need to look up in the FULL `stock` list, not just `enrichedStock` (filtered by active warehouse)
                const existingDestItem = stock.find(s => s.productId === item.productId && s.warehouseId === destinationWarehouseId);

                if (existingDestItem) {
                    await updateStock({
                        ...existingDestItem,
                        quantity: existingDestItem.quantity + qtyToMove
                    });
                } else {
                    // Create new stock record at destination
                    await updateStock({
                        clientId: id,
                        warehouseId: destinationWarehouseId,
                        productId: item.productId,
                        quantity: qtyToMove,
                        lastUpdated: now.toISOString()
                    });
                }

                // IN movement record
                await db.put('movements', {
                    id: generateId(),
                    clientId: id,
                    warehouseId: destinationWarehouseId,
                    productId: item.productId,
                    productName: item.productName,
                    productBrand: item.productBrand || '-',
                    type: 'IN',
                    quantity: qtyToMove,
                    unit: item.unit,
                    date: dateStr,
                    time: timeStr,
                    referenceId: `MOVE-${now.getTime()}`,
                    notes: `Transferencia desde ${item.warehouseName} - ${note || ''}`,
                    createdBy: displayName || 'Sistema',
                    createdAt: now.toISOString(),
                    synced: false
                });
            }
        }

        syncService.pushChanges();
        handleClearSelection();
    };

    const toggleStockSelection = (id: string, e: React.MouseEvent) => {
        // Prevent if clicking on actions or links
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;

        setSelectedStockIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleClearSelection = () => {
        setSelectedStockIds([]);
        setShowMovePanel(false);
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm('¿Está seguro que desea eliminar este producto del catálogo? Esto no eliminará el historial pero podría afectar la visualización de stock actual.')) return;
        try {
            await deleteProduct(productId);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar producto');
        }
    };

    const productTypes: ProductType[] = ['HERBICIDE', 'FERTILIZER', 'SEED', 'FUNGICIDE', 'INSECTICIDE', 'OTHER'];

    const typeLabels: Record<ProductType, string> = {
        HERBICIDE: 'Herbicida',
        FERTILIZER: 'Fertilizante',
        SEED: 'Semilla',
        FUNGICIDE: 'Fungicida',
        INSECTICIDE: 'Insecticida',
        OTHER: 'Otro'
    };

    if (role === 'CONTRATISTA') {
        return (
            <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-4xl mb-4">🚫</div>
                <h2 className="text-xl font-bold text-slate-800">Acceso Denegado</h2>
                <p className="text-slate-500 mt-2">Los contratistas solo tienen acceso a la sección de órdenes asignadas.</p>
                <Link href={`/clients/${id}/orders`} className="inline-block mt-6 text-emerald-600 font-bold hover:underline font-mono">Ir a Mis Órdenes →</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Galpón Virtual</h1>
                    </div>
                    {!isReadOnly && (
                        <div className="flex gap-2">
                            {selectedStockIds.length > 0 && (
                                <>
                                    <Button
                                        onClick={() => setShowMovePanel(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 animate-fadeIn"
                                    >
                                        Mover Stock ({selectedStockIds.length})
                                    </Button>

                                    {warehouses.find(w => w.id === activeWarehouseId)?.name === 'Acopio de Granos' && (
                                        <Button
                                            onClick={() => {
                                                if (sellingStockId) {
                                                    setSellingStockId(null);
                                                    return;
                                                }

                                                if (selectedStockIds.length === 1) {
                                                    const item = enrichedStock.find(s => s.id === selectedStockIds[0]);
                                                    if (item) {
                                                        setSellingStockId(item.id);
                                                        setSaleQuantity(item.quantity.toString());
                                                    }
                                                } else {
                                                    alert('Por favor selecciona un solo producto para vender.');
                                                }
                                            }}
                                            variant={sellingStockId ? "secondary" : "primary"}
                                            className={`${sellingStockId ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"} animate-fadeIn`}
                                        >
                                            {sellingStockId ? 'Cancelar' : 'Vender'}
                                        </Button>
                                    )}
                                </>
                            )}
                            <Button
                                onClick={() => {
                                    setShowStockForm(!showStockForm);
                                }}
                                variant={showStockForm ? "secondary" : "primary"}
                                className={showStockForm ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : ""}
                            >
                                {showStockForm ? 'Cancelar' : 'Cargar Stock'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>



            {/* Input Form */}


            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                        Existencias {warehouses.find(w => w.id === activeWarehouseId)?.name || 'Cargando...'}
                    </h3>
                    {/* removed configuración text */}
                </div>
                {stockLoading || productsLoading ? (
                    <div className="p-8 text-center text-slate-500">Cargando stock...</div>
                ) : enrichedStock.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <h3 className="text-lg font-medium text-slate-900">Galpón vacío</h3>
                        <p>No hay productos cargados todavía.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A. / Cultivo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Galpón</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                    {warehouses.find(w => w.id === activeWarehouseId)?.name !== 'Acopio de Granos' && (
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total (pesos)</th>
                                    )}
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Actual</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {enrichedStock.map((item: EnrichedStockItem) => (
                                    <React.Fragment key={item.id}>
                                        <tr
                                            key={item.id}
                                            onClick={(e) => toggleStockSelection(item.id, e)}
                                            className={`transition-colors cursor-pointer ${selectedStockIds.includes(item.id) ? 'bg-emerald-50 border-emerald-200' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">

                                                {products.find(p => p.id === item.productId)?.activeIngredient || item.productName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                                {products.find(p => p.id === item.productId)?.brandName || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-emerald-700 font-medium">
                                                {item.warehouseName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                                {typeLabels[item.productType] || item.productType}
                                            </td>
                                            {warehouses.find(w => w.id === activeWarehouseId)?.name !== 'Acopio de Granos' && (
                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-500">
                                                    ${(item.quantity * item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            )}
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600">
                                                {item.quantity} <span className="text-slate-400 text-xs ml-1 font-normal group-hover:text-emerald-300 transition-colors uppercase tracking-tight">{item.unit}</span>
                                            </td>
                                        </tr>
                                        {sellingStockId === item.id && (
                                            <tr className="bg-emerald-50/50 animate-fadeIn">
                                                <td colSpan={6} className="px-6 py-4">
                                                    <form onSubmit={handleSaleSubmit} className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-emerald-200 shadow-sm" onClick={e => e.stopPropagation()}>
                                                        <div className="flex flex-wrap items-end gap-4">
                                                            <div className="flex-1 min-w-[120px]">
                                                                <Input
                                                                    label="Cantidad a Vender"
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={saleQuantity}
                                                                    onChange={e => setSaleQuantity(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="flex-1 min-w-[120px]">
                                                                <Input
                                                                    label={`Precio de Venta ($/${item.unit})`}
                                                                    type="number"
                                                                    step="0.01"
                                                                    value={salePrice}
                                                                    onChange={e => setSalePrice(e.target.value)}
                                                                    required
                                                                />
                                                            </div>
                                                            <div className="flex gap-2 mb-1">
                                                                <Button type="submit" size="sm" disabled={isSubmitting || facturaUploading}>Confirmar Venta</Button>
                                                            </div>
                                                        </div>

                                                        {showSaleNote && (
                                                            <div className="animate-fadeIn w-full mt-2">
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Nota de Venta</label>
                                                                <textarea
                                                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3"
                                                                    rows={2}
                                                                    placeholder="Escribe una nota para este movimiento..."
                                                                    value={saleNote}
                                                                    onChange={(e) => setSaleNote(e.target.value)}
                                                                />
                                                            </div>
                                                        )}

                                                        <div className="flex flex-col sm:flex-row items-center justify-start gap-4 mt-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => setShowSaleNote(!showSaleNote)}
                                                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                                            >
                                                                {showSaleNote ? 'Quitar Nota' : '+ Agregar Nota'}
                                                            </button>

                                                            <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                                                                <label htmlFor={`factura-upload-sale-${item.id}`} className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">
                                                                    {saleFacturaFile ? (
                                                                        <span className="text-emerald-700 font-bold truncate max-w-[120px]">{saleFacturaFile.name}</span>
                                                                    ) : (
                                                                        <span>+ Adjuntar Factura</span>
                                                                    )}
                                                                </label>
                                                                <input
                                                                    id={`factura-upload-sale-${item.id}`}
                                                                    type="file"
                                                                    accept="image/*,application/pdf"
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            setSaleFacturaFile(e.target.files[0]);
                                                                        }
                                                                    }}
                                                                    className="hidden"
                                                                />
                                                                {saleFacturaFile && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setSaleFacturaFile(null)}
                                                                        className="text-red-400 hover:text-red-600 font-bold px-1"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </form>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>


            {/* Stock Movement Panel (Moved to bottom) */}
            {showMovePanel && (
                <StockMovementPanel
                    selectedIds={selectedStockIds}
                    stockItems={enrichedStock}
                    warehouses={warehouses}
                    activeWarehouseId={activeWarehouseId}
                    onConfirm={handleConfirmMove}
                    onCancel={() => setShowMovePanel(false)}
                />
            )}

            <div className="flex justify-end pr-2 pb-4 gap-2 flex-wrap">
                {!isReadOnly && (
                    <button
                        onClick={() => setShowWarehouses(!showWarehouses)}
                        className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showWarehouses ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                    >
                        {showWarehouses ? 'Cerrar gestión de granos' : 'Gestionar Galpones'}
                    </button>
                )}
                <button
                    onClick={() => setShowCatalog(!showCatalog)}
                    className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showCatalog ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                >
                    {showCatalog ? 'Cerrar catálogo' : 'Catálogo de productos'}
                </button>
                <Link
                    href={`/clients/${id}/stock/history`}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                >
                    Historial de Movimientos
                </Link>
            </div>

            {/* Warehouse Management View */}
            {showWarehouses && !isReadOnly && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-fadeIn mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Galpones Disponibles</h3>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="flex-1">
                            <Input
                                placeholder="Nombre del nuevo galpón..."
                                id="new-warehouse-name"
                                className="h-[38px] text-sm"
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        const input = e.currentTarget as HTMLInputElement;
                                        if (input.value) {
                                            await addWarehouse(input.value);
                                            input.value = '';
                                        }
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={async () => {
                                const input = document.getElementById('new-warehouse-name') as HTMLInputElement;
                                if (input.value) {
                                    await addWarehouse(input.value);
                                    input.value = '';
                                }
                            }}
                            size="sm"
                            className="h-[38px] px-6"
                        >
                            Agregar
                        </Button>
                    </div>
                    <div className="space-y-3">

                        {warehouses.map(w => (
                            <div
                                key={w.id}
                                onClick={() => {
                                    if (selectedInManagerId === w.id) {
                                        // Toggle: if clicking the active one, deactivate it (show all)
                                        if (activeWarehouseId === w.id) {
                                            setActiveWarehouseId(null);
                                            // Reset to default if needed, or null to show all? 
                                            // User request: "make it inactive" -> implies showing all or no filter.
                                            // Logic at line 289 handles null/undefined as "first warehouse" OR if we want "ALL", we need to adjust filtering.
                                            // However, line 140 forces a default if none selected. We might need to relax that or handle "null" explicitly in the filter.
                                            // Let's assume for now "inactive" means clear selection -> effectively null.
                                            // But the effect at line 138 might re-select the first one immediately.
                                            // We should check that effect.
                                        } else {
                                            setActiveWarehouseId(w.id);
                                        }
                                        setSelectedStockIds([]);
                                        setSellingStockId(null);
                                        setShowMovePanel(false);
                                    } else {
                                        setSelectedInManagerId(w.id);
                                    }
                                }}
                                className={`p-2 rounded-xl border transition-all cursor-pointer select-none ${activeWarehouseId === w.id ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'} ${selectedInManagerId === w.id ? 'shadow-md border-emerald-300' : ''}`}
                            >
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-3 flex-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${activeWarehouseId === w.id ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                            📦
                                        </div>
                                        <div className="flex-1">
                                            {editingWarehouseId === w.id ? (
                                                <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                    <input
                                                        autoFocus
                                                        className="flex-1 text-sm border-2 border-emerald-500 rounded px-2 py-1 outline-none"
                                                        value={editName}
                                                        onChange={e => setEditName(e.target.value)}
                                                        onKeyDown={async e => {
                                                            if (e.key === 'Enter' && editName) {
                                                                await updateWarehouse({ ...w, name: editName });
                                                                setEditingWarehouseId(null);
                                                            }
                                                        }}
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            if (editName) {
                                                                await updateWarehouse({ ...w, name: editName });
                                                                setEditingWarehouseId(null);
                                                            }
                                                        }}
                                                        className="bg-emerald-600 text-white px-3 rounded font-bold text-xs"
                                                    >
                                                        Ok
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className={`font-bold block ${activeWarehouseId === w.id ? 'text-emerald-900' : 'text-slate-700'}`}>{w.name}</span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        {activeWarehouseId === w.id && editingWarehouseId !== w.id && (
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-1 bg-emerald-100 rounded border border-emerald-200">Activo</span>
                                        )}
                                        {/* Show controls if selected in manager OR if it is the active warehouse */}
                                        {(selectedInManagerId === w.id || activeWarehouseId === w.id) && (
                                            <div className="flex gap-2 animate-fadeIn">
                                                {editingWarehouseId !== w.id && (
                                                    <>
                                                        {activeWarehouseId !== w.id && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveWarehouseId(w.id);
                                                                    setSelectedStockIds([]);
                                                                    setSellingStockId(null);
                                                                    setShowMovePanel(false);
                                                                }}
                                                                className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg shadow-sm transition-all"
                                                            >
                                                                Abrir
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setEditingWarehouseId(w.id);
                                                                setEditName(w.name);
                                                            }}
                                                            className="text-xs font-bold text-slate-500 hover:text-emerald-600 px-2 transition-colors"
                                                        >
                                                            Editar
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (editingWarehouseId === w.id) {
                                                            setEditingWarehouseId(null);
                                                        } else {
                                                            if (confirm('¿Eliminar galpón?')) deleteWarehouse(w.id);
                                                        }
                                                    }}
                                                    className="text-slate-400 hover:text-red-500 p-2"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showCatalog && (
                <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden mb-8 animate-fadeIn">
                    <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex justify-between items-center">
                        <h3 className="font-bold text-emerald-900 text-sm uppercase tracking-wider">Catálogo de Productos</h3>
                        {!isReadOnly && (
                            <button
                                onClick={() => {
                                    setIsEditingProduct(false);
                                    setEditingProductId(null);
                                    setNewProductName('');
                                    setNewProductBrand('');
                                    setNewProductPA('');
                                    setNewProductPrice('');
                                    setShowProductForm(true);
                                    setTimeout(() => {
                                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                    }, 100);
                                }}
                                className="text-emerald-600 hover:text-emerald-700 text-[10px] font-bold uppercase tracking-widest"
                            >
                                Registrar nuevo producto
                            </button>
                        )}
                    </div>
                    {productsLoading ? (
                        <div className="p-8 text-center text-slate-500">Cargando catálogo...</div>
                    ) : availableProducts.length === 0 ? (
                        <div className="p-12 text-center text-slate-500">
                            <h3 className="text-lg font-medium text-slate-900">Catálogo vacío</h3>
                            <p>Agregue productos para comenzar.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A. / Cultivo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidad</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Precio de Referencia (pesos/unidad)</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {availableProducts.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{p.activeIngredient || p.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.brandName || '-'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{typeLabels[p.type] || p.type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.unit}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-500">${(p.price || 0).toFixed(2)}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {!isReadOnly && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setIsEditingProduct(true);
                                                                setEditingProductId(p.id);
                                                                setNewProductName(p.name);
                                                                setNewProductBrand(p.brandName || '');
                                                                setNewProductPA(p.activeIngredient || '');
                                                                setNewProductType(p.type);
                                                                setNewProductUnit(p.unit);
                                                                setNewProductPrice(p.price?.toString() || '');
                                                                setShowProductForm(true);
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            className="text-slate-400 hover:text-emerald-600 px-2 py-1 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                            title="Editar"
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('¿Eliminar producto del catálogo?')) await deleteProduct(p.id);
                                                            }}
                                                            className="text-slate-400 hover:text-red-900 px-2 py-1 transition-colors text-[10px] font-bold uppercase tracking-widest"
                                                            title="Eliminar"
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {/* Product Registration/Edition Form */}
            {showProductForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-fadeIn mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-emerald-800">
                            {editingProductId ? 'Editar Producto' : 'Registrar Nuevo Producto'}
                        </h2>
                        <button
                            onClick={() => {
                                setShowProductForm(false);
                                setIsEditingProduct(false);
                                setEditingProductId(null);
                            }}
                            className="text-emerald-500 hover:text-emerald-700 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleProductSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Input
                                label={newProductType === 'SEED' ? 'Cultivo' : 'P.A. (Principio Activo)'}
                                placeholder={newProductType === 'SEED' ? 'ej. Soja, Maíz...' : 'ej. Glifosato 48%'}
                                value={newProductPA}
                                onChange={e => {
                                    setNewProductPA(e.target.value);
                                    setNewProductName(e.target.value);
                                }}
                                className="h-[42px]"
                                required
                            />
                            <Input
                                label="Marca"
                                placeholder="ej. Bayer"
                                value={newProductBrand}
                                onChange={e => setNewProductBrand(e.target.value)}
                                className="h-[42px]"
                            />
                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={newProductType}
                                    onChange={e => setNewProductType(e.target.value as ProductType)}
                                >
                                    {productTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                                </select>
                            </div>
                            <div className="w-full relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={newProductUnit}
                                    onChange={e => {
                                        if (e.target.value === 'ADD_NEW') {
                                            setShowUnitInput(true);
                                            // Reset to whatever it was (or placeholder) so it doesn't stay on ADD_NEW
                                            // This allows clicking it again if they close the input without adding
                                        } else if (e.target.value === 'DELETE_UNIT') {
                                            setShowUnitDelete(true);
                                        } else {
                                            setNewProductUnit(e.target.value);
                                        }
                                    }}
                                >
                                    {(!newProductUnit || !availableUnits.includes(newProductUnit)) && (
                                        <option value="">Seleccionar...</option>
                                    )}
                                    {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                                    <option value="ADD_NEW">+ unidad</option>
                                    {availableUnits.length > 0 && (
                                        <option value="DELETE_UNIT">- unidad</option>
                                    )}
                                </select>

                                {showUnitInput && (
                                    <div
                                        ref={unitInputRef}
                                        className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn flex gap-2"
                                    >
                                        <input
                                            type="text"
                                            className="flex-1 rounded border-slate-300 text-xs focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder="NUEVA UNIDAD..."
                                            value={unitInputValue}
                                            onChange={e => setUnitInputValue(e.target.value.toUpperCase())}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    handleAddUnit();
                                                }
                                            }}
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddUnit}
                                            className="bg-emerald-500 text-white rounded px-2 py-1 text-xs font-bold hover:bg-emerald-600"
                                        >
                                            +
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowUnitInput(false);
                                                setUnitInputValue('');
                                            }}
                                            className="text-slate-400 p-1 hover:text-slate-600"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                )}

                                {showUnitDelete && (
                                    <div className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn pr-6">
                                        <button
                                            type="button"
                                            onClick={() => setShowUnitDelete(false)}
                                            className="absolute top-1 right-1 text-slate-400 hover:text-slate-600 p-1"
                                        >
                                            ✕
                                        </button>
                                        <p className="text-xs text-slate-500 mb-2 font-medium">Eliminar unidad:</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {availableUnits.map(u => (
                                                <button
                                                    key={u}
                                                    type="button"
                                                    onClick={() => {
                                                        const newUnits = availableUnits.filter(unit => unit !== u);
                                                        setAvailableUnits(newUnits);
                                                        saveClientUnits(newUnits);
                                                        if (newProductUnit === u) {
                                                            setNewProductUnit(newUnits[0] || '');
                                                        }
                                                        // Keep box open as requested
                                                    }}
                                                    className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-bold uppercase border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-colors"
                                                >
                                                    {u} ✕
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                            <Input
                                label="Precio de Referencia (pesos/unidad)"
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                value={newProductPrice}
                                onChange={e => setNewProductPrice(e.target.value)}
                                className="h-[42px]"
                                prefix="$"
                            />
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 mt-4 border-t pt-4">
                            {isDuplicate && (
                                <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg animate-fadeIn flex-1 sm:flex-initial">
                                    <p className="text-xs font-bold text-red-600 uppercase tracking-tight">
                                        ⚠️ Este producto ya existe en el catálogo
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setShowProductForm(false);
                                        setIsEditingProduct(false);
                                        setEditingProductId(null);
                                    }}
                                >
                                    Cerrar
                                </Button>
                                <Button type="submit" isLoading={isSubmitting} disabled={isDuplicate}>
                                    {editingProductId ? 'Actualizar en Catálogo' : 'Guardar en Catálogo'}
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {/* Stock Entry Form */}
            {showStockForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">Cargar Ingreso de Stock</h2>
                        <button
                            onClick={() => setShowStockForm(false)}
                            className="text-slate-400 hover:text-slate-600 p-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleStockSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pb-2">
                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Producto</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={selectedProductId}
                                    onChange={e => setSelectedProductId(e.target.value)}
                                    required
                                >
                                    <option value="">Seleccione un producto...</option>
                                    {availableProducts
                                        .filter(p => {
                                            const targetW = warehouses.find(w => w.id === selectedWarehouseId);
                                            if (targetW?.name === 'Acopio de Granos') return p.type === 'SEED';
                                            return true;
                                        })
                                        .map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.activeIngredient || p.name} {p.brandName ? `(${p.brandName})` : ''} ({typeLabels[p.type]}) ({p.unit})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Cantidad a Ingresar"
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={quantity}
                                    onChange={e => setQuantity(e.target.value)}
                                    className="h-[42px]"
                                    required
                                />
                                <div>
                                    <Input
                                        label={`Precio ($/${availableProducts.find(p => p.id === selectedProductId)?.unit || 'u.'})`}
                                        type="number"
                                        step="0.01"
                                        placeholder={availableProducts.find(p => p.id === selectedProductId)?.price ? String(availableProducts.find(p => p.id === selectedProductId)?.price) : "0.00"}
                                        value={transactionPrice}
                                        onChange={e => setTransactionPrice(e.target.value)}
                                        className="h-[42px]"
                                        prefix="$"
                                    />
                                    {selectedProductId && availableProducts.find(p => p.id === selectedProductId)?.price && (
                                        <div className="text-[10px] text-slate-400 mt-1">
                                            Ref: ${availableProducts.find(p => p.id === selectedProductId)?.price}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="w-full">
                                <Input
                                    label="Marca de referencia"
                                    placeholder="ej. Bayer"
                                    value={tempBrand}
                                    onChange={e => setTempBrand(e.target.value)}
                                    className="h-[42px]"
                                />
                            </div>

                            <div className="w-full">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Destino (Galpón)</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                    value={selectedWarehouseId}
                                    onChange={e => setSelectedWarehouseId(e.target.value)}
                                >
                                    {warehouses.map(w => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {showNote && (
                            <div className="animate-fadeIn w-full mt-2 relative">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Nota (Opcional)</label>
                                <div className="flex gap-2">
                                    <textarea
                                        className={`block w-full rounded-lg shadow-sm focus:ring-emerald-500 text-sm py-2 px-3 transition-colors ${noteConfirmed ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 focus:border-emerald-500'}`}
                                        rows={2}
                                        placeholder="ej. Factura #1234, Lote específico..."
                                        value={note}
                                        onChange={e => {
                                            setNote(e.target.value);
                                            setNoteConfirmed(false);
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (note.trim()) {
                                                setNoteConfirmed(true);
                                                setTimeout(() => setNoteConfirmed(false), 2000);
                                            }
                                        }}
                                        className={`flex-none w-10 h-10 self-end rounded-lg flex items-center justify-center transition-all ${note.trim() ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-md transform active:scale-95' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}
                                        title="Confirmar nota"
                                    >
                                        {noteConfirmed ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="animate-bounce">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                                <polyline points="12 5 19 12 12 19"></polyline>
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                {noteConfirmed && (
                                    <span className="absolute -bottom-5 right-12 text-[10px] font-bold text-emerald-600 uppercase tracking-widest animate-fadeIn">Guardada</span>
                                )}
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                            <div className="flex items-center gap-4">
                                <button
                                    type="button"
                                    onClick={() => setShowNote(!showNote)}
                                    className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                >
                                    {showNote ? 'Quitar Nota' : '+ Agregar Nota'}
                                </button>

                                <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                                    <label htmlFor="factura-upload-stock" className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">
                                        {facturaFile ? (
                                            <span className="text-emerald-700 font-bold truncate max-w-[120px]">{facturaFile.name}</span>
                                        ) : (
                                            <span>+ Adjuntar Factura</span>
                                        )}
                                    </label>
                                    <input
                                        id="factura-upload-stock"
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={handleFacturaChange}
                                        disabled={facturaUploading}
                                        className="hidden"
                                    />
                                    {facturaFile && (
                                        <button
                                            type="button"
                                            onClick={() => setFacturaFile(null)}
                                            className="text-red-400 hover:text-red-600 font-bold px-1"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end gap-3">
                                <Button type="submit" isLoading={isSubmitting}>
                                    Confirmar Ingreso
                                </Button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
