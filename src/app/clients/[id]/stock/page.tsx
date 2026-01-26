'use client';

import { use, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { ProductType, Unit, InventoryMovement } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { syncService } from '@/services/sync';
import { supabase } from '@/lib/supabase';
import { StockMovementPanel } from '@/components/StockMovementPanel';

export default function ClientStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { stock, updateStock, loading: stockLoading } = useClientStock(id);
    const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loading: warehousesLoading } = useWarehouses(id);
    const { products, addProduct, updateProduct, deleteProduct, loading: productsLoading } = useInventory(); // Added deleteProduct

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showForm, setShowForm] = useState(false);
    const [viewMode, setViewMode] = useState<'STOCK' | 'CATALOG' | 'WAREHOUSES'>('STOCK'); // Added WAREHOUSES
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
    const [isNewProduct, setIsNewProduct] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [newProductBrand, setNewProductBrand] = useState('');
    const [newProductPA, setNewProductPA] = useState('');
    const [newProductType, setNewProductType] = useState<ProductType>('HERBICIDE');
    const [newProductUnit, setNewProductUnit] = useState<Unit>('L');
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);

    // Factura upload state
    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [facturaUploading, setFacturaUploading] = useState(false);

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

        const savedShowForm = sessionStorage.getItem(`stock_showForm_${id}`);
        const savedViewMode = sessionStorage.getItem(`stock_viewMode_${id}`);
        const savedActiveW = sessionStorage.getItem(`stock_activeW_${id}`);

        if (savedShowForm === 'true') setShowForm(true);
        if (savedViewMode) setViewMode(savedViewMode as 'STOCK' | 'CATALOG' | 'WAREHOUSES');
        if (savedActiveW) setActiveWarehouseId(savedActiveW === 'null' ? null : savedActiveW);
    }, [id]);

    // Handle default selection if none set
    useEffect(() => {
        if (!activeWarehouseId && warehouses.length > 0) {
            setActiveWarehouseId(warehouses[0].id);
        } else if (activeWarehouseId && warehouses.length > 0 && !warehouses.find(w => w.id === activeWarehouseId)) {
            // Safety: if active warehouse was deleted, move to first
            setActiveWarehouseId(warehouses[0].id);
        }
    }, [warehouses, activeWarehouseId]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showForm_${id}`, showForm.toString());
    }, [showForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_viewMode_${id}`, viewMode);
    }, [viewMode, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_activeW_${id}`, activeWarehouseId || 'null');
        if (activeWarehouseId) setSelectedWarehouseId(activeWarehouseId);
        else setSelectedWarehouseId('');
    }, [activeWarehouseId, id]);

    useEffect(() => {
        if (selectedProductId) sessionStorage.setItem(`stock_productId_${id}`, selectedProductId);
        else sessionStorage.removeItem(`stock_productId_${id}`);
    }, [selectedProductId, id]);

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

    // Filter products: show ONLY client-specific ones (Strict Per-Client Isolation)
    const availableProducts = useMemo(() => {
        return products.filter(p => p.clientId === id);
    }, [products, id]);

    // Enrich stock data with product details (name, unit, type)
    const enrichedStock = useMemo(() => {
        const firstId = warehouses[0]?.id;
        const filteredStock = stock.filter(item => {
            // Match current active warehouse
            // Also include null/undefined stock in the FIRST warehouse for transition
            const effectiveWId = item.warehouseId || firstId;
            return effectiveWId === activeWarehouseId;
        });

        return filteredStock.map(item => {
            const product = products.find(p => p.id === item.productId);
            const warehouse = warehouses.find(w => w.id === item.warehouseId);
            // If product is not found (e.g. deleted or from another client context if legacy), handle gracefully
            return {
                ...item,
                productName: product?.name || 'Producto Desconocido (Eliminado o Ajeno)',
                warehouseName: warehouse?.name || (item.warehouseId === null && warehouses[0] ? warehouses[0].name : 'Galpón (Desaparecido)'),
                productType: product?.type || 'OTHER',
                unit: product?.unit || 'UNIT',
                hasProduct: !!product
            };
        });
    }, [stock, products, warehouses, activeWarehouseId]);

    const handleAddStock = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isNewProduct) {
            if (!newProductName) return;
            setIsSubmitting(true);
            try {
                if (selectedProductId) {
                    // Update existing
                    await updateProduct({
                        id: selectedProductId,
                        name: newProductName,
                        brandName: newProductBrand,
                        activeIngredient: newProductPA,
                        type: newProductType,
                        unit: newProductUnit,
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
                        clientId: id
                    });
                }

                setIsNewProduct(false);
                setNewProductName('');
                setNewProductBrand('');
                setNewProductPA('');
                setSelectedProductId(''); // Clear selection after update
                // If we are in catalog mode, we might want to stay there, or close form. 
                // If form was opened from STOCK mode, close it.
                if (viewMode === 'CATALOG') setShowForm(false);
            } catch (error) {
                console.error(error);
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (!selectedProductId || !quantity) return;

        setIsSubmitting(true);
        try {
            const qtyNum = parseFloat(quantity);
            const existingItem = stock.find(s => s.productId === selectedProductId && s.warehouseId === (selectedWarehouseId || undefined));

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
            const product = availableProducts.find(p => p.id === selectedProductId);
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
            setShowNote(false);
            setFacturaFile(null);
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
                        // id will be generated by updateStock if missing
                        clientId: id,
                        warehouseId: destinationWarehouseId,
                        productId: item.productId,
                        quantity: qtyToMove,
                        lastUpdated: now.toISOString()
                    } as any);
                }

                // IN movement record
                await db.put('movements', {
                    id: generateId(),
                    clientId: id,
                    warehouseId: destinationWarehouseId,
                    productId: item.productId,
                    productName: item.productName,
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
    const units: Unit[] = ['L', 'KG', 'UNIT'];

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
                            {selectedStockIds.length > 0 && viewMode === 'STOCK' && (
                                <Button
                                    onClick={() => setShowMovePanel(true)}
                                    className="bg-emerald-600 hover:bg-emerald-700 animate-fadeIn"
                                >
                                    Mover Stock ({selectedStockIds.length})
                                </Button>
                            )}
                            <Button
                                onClick={() => {
                                    setIsNewProduct(false);
                                    setShowForm(true);
                                }}
                            >
                                Cargar Stock
                            </Button>
                        </div>
                    )}
                </div>
            </div>



            {/* Input Form */}
            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800">
                            {isNewProduct ? (selectedProductId ? 'Editar Producto' : 'Registrar Nuevo Producto') : 'Cargar Ingreso de Stock'}
                        </h2>
                        <button
                            onClick={() => {
                                setShowForm(false);
                                setIsNewProduct(false);
                                setSelectedProductId('');
                                setNewProductName('');
                                setNewProductBrand('');
                                setNewProductPA('');
                            }}
                            className="text-emerald-500 hover:text-emerald-700 p-1 transition-colors"
                            title="Cerrar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    <form onSubmit={handleAddStock} className="space-y-4">
                        {isNewProduct ? (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <Input
                                        label="P.A. (Principio Activo)"
                                        placeholder="ej. Glifosato 48%"
                                        value={newProductPA}
                                        onChange={e => {
                                            setNewProductPA(e.target.value);
                                            // Sync with name for internal identification
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
                                    {/* removed separate P.A. input as it is now primary */}
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
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                                        <select
                                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                            value={newProductUnit}
                                            onChange={e => setNewProductUnit(e.target.value as Unit)}
                                        >
                                            {units.map(u => <option key={u} value={u}>{u}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end items-center gap-4 mt-4">
                                    {viewMode === 'STOCK' && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsNewProduct(false);
                                                setNewProductName('');
                                                setNewProductBrand('');
                                                setNewProductPA('');
                                                setSelectedProductId('');
                                            }}
                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                        >
                                            Volver a Carga de Stock
                                        </button>
                                    )}
                                    <Button type="submit" isLoading={isSubmitting}>
                                        {selectedProductId ? 'Actualizar Producto' : 'Guardar en Catálogo'}
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <>
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
                                            {availableProducts.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.activeIngredient || p.name} {p.brandName ? `(${p.brandName})` : ''} ({p.unit})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

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

                                <div className="flex justify-end pt-2">
                                    <Button type="submit" isLoading={isSubmitting} className="w-full md:w-auto px-12">
                                        Confirmar Ingreso
                                    </Button>
                                </div>

                                {showNote && (
                                    <div className="animate-fadeIn w-full mt-4">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Nota (Opcional)</label>
                                        <textarea
                                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3"
                                            rows={2}
                                            placeholder="ej. Factura #1234, Lote específico..."
                                            value={note}
                                            onChange={e => setNote(e.target.value)}
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end items-center gap-4 mt-4">
                                    <div className="flex items-center gap-2 mr-auto">
                                        <label className={`text-sm font-medium ${!showNote ? 'text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer' : 'text-slate-400'}`}>
                                            <span onClick={() => !showNote && setShowNote(true)}>
                                                {showNote ? '' : '+ Nota'}
                                            </span>
                                        </label>

                                        <div className="flex items-center gap-2 border-l pl-2 border-slate-200">
                                            <label htmlFor="factura-upload" className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">

                                                {facturaFile ? (
                                                    <span className="text-emerald-700 font-bold truncate max-w-[150px]">{facturaFile.name}</span>
                                                ) : (
                                                    <span>+ Adjuntar Factura</span>
                                                )}
                                            </label>
                                            <input
                                                id="factura-upload"
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
                                                    title="Quitar factura"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}


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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A.</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Galpón</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Actual</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {enrichedStock.map((item) => (
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
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider
                          ${item.productType === 'HERBICIDE' ? 'bg-orange-100 text-orange-800' :
                                                    item.productType === 'FERTILIZER' ? 'bg-blue-100 text-blue-800' :
                                                        item.productType === 'SEED' ? 'bg-green-100 text-green-800' :
                                                            item.productType === 'FUNGICIDE' ? 'bg-purple-100 text-purple-800' :
                                                                item.productType === 'INSECTICIDE' ? 'bg-red-100 text-red-800' :
                                                                    'bg-gray-100 text-gray-800'}`}>
                                                {typeLabels[item.productType as ProductType] || item.productType}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600">
                                            {item.quantity} <span className="text-slate-400 text-xs ml-1 font-normal group-hover:text-emerald-300 transition-colors uppercase tracking-tight">{item.unit}</span>
                                        </td>
                                    </tr>
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
                        onClick={() => setViewMode(viewMode === 'WAREHOUSES' ? 'STOCK' : 'WAREHOUSES')}
                        className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${viewMode === 'WAREHOUSES' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                    >
                        {viewMode === 'WAREHOUSES' ? 'Cerrar gestión de galpones' : 'Gestionar Galpones'}
                    </button>
                )}
                <button
                    onClick={() => setViewMode(viewMode === 'CATALOG' ? 'STOCK' : 'CATALOG')}
                    className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${viewMode === 'CATALOG' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                >
                    {viewMode === 'CATALOG' ? 'Cerrar catálogo de productos' : 'Catálogo de productos'}
                </button>
                <Link
                    href={`/clients/${id}/stock/history`}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                >
                    Historial de Movimientos
                </Link>
            </div>

            {/* Warehouse Management View */}
            {viewMode === 'WAREHOUSES' && !isReadOnly && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-emerald-100 animate-fadeIn mb-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">Galpones Disponibles</h3>
                    <div className="flex gap-2 mb-4">
                        <Input
                            placeholder="Nombre del nuevo galpón..."
                            id="new-warehouse-name"
                            className="flex-1"
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
                        <Button
                            onClick={async () => {
                                const input = document.getElementById('new-warehouse-name') as HTMLInputElement;
                                if (input.value) {
                                    await addWarehouse(input.value);
                                    input.value = '';
                                }
                            }}
                        >
                            + Agregar
                        </Button>
                    </div>
                    <div className="space-y-3">

                        {warehouses.map(w => (
                            <div
                                key={w.id}
                                onClick={() => setSelectedInManagerId(w.id)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer ${activeWarehouseId === w.id ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-100' : 'bg-white border-slate-100 hover:border-slate-200'} ${selectedInManagerId === w.id ? 'shadow-md border-emerald-300' : ''}`}
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
                                        {activeWarehouseId === w.id && (
                                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest px-2 py-1 bg-emerald-100 rounded border border-emerald-200">Activo</span>
                                        )}
                                        {selectedInManagerId === w.id && activeWarehouseId !== w.id && (
                                            <div className="flex gap-2 animate-fadeIn">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveWarehouseId(w.id);
                                                    }}
                                                    className="text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg shadow-sm transition-all"
                                                >
                                                    Abrir
                                                </button>
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
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (confirm('¿Eliminar galpón?')) deleteWarehouse(w.id);
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

            {viewMode === 'CATALOG' && (
                <div className="bg-white rounded-xl shadow-sm border border-emerald-200 overflow-hidden mb-8 animate-fadeIn">
                    <div className="bg-emerald-50 px-6 py-3 border-b border-emerald-100 flex justify-between items-center">
                        <h3 className="font-bold text-emerald-900 text-sm uppercase tracking-wider">Catálogo de Productos</h3>
                        {!isReadOnly && (
                            <button
                                onClick={() => {
                                    setIsNewProduct(true);
                                    setNewProductName('');
                                    setNewProductBrand('');
                                    setNewProductPA('');
                                    setSelectedProductId('');
                                    setShowForm(true);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
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
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A.</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidad</th>
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
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {!isReadOnly && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setNewProductName(p.name);
                                                                setNewProductBrand(p.brandName || '');
                                                                setNewProductPA(p.activeIngredient || '');
                                                                setNewProductType(p.type);
                                                                setNewProductUnit(p.unit);
                                                                setSelectedProductId(p.id);
                                                                setIsNewProduct(true);
                                                                setShowForm(true);
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
        </div>
    );
}
