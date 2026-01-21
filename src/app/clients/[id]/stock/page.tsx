'use client';

import { use, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { ProductType, Unit, InventoryMovement } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { syncService } from '@/services/sync';

export default function ClientStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { stock, updateStock, loading: stockLoading } = useClientStock(id);
    const { products, addProduct, updateProduct, deleteProduct, loading: productsLoading } = useInventory(); // Added deleteProduct

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showForm, setShowForm] = useState(false);
    const [viewMode, setViewMode] = useState<'STOCK' | 'CATALOG'>('STOCK'); // View Mode State
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New entry state
    const [isNewProduct, setIsNewProduct] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [newProductType, setNewProductType] = useState<ProductType>('HERBICIDE');
    const [newProductUnit, setNewProductUnit] = useState<Unit>('L');
    const [quantity, setQuantity] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);

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
        if (savedShowForm === 'true') setShowForm(true);
        if (savedViewMode) setViewMode(savedViewMode as 'STOCK' | 'CATALOG');
    }, [id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showForm_${id}`, showForm.toString());
    }, [showForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_viewMode_${id}`, viewMode);
    }, [viewMode, id]);

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
        return stock.map(item => {
            const product = products.find(p => p.id === item.productId);
            // If product is not found (e.g. deleted or from another client context if legacy), handle gracefully
            return {
                ...item,
                productName: product?.name || 'Producto Desconocido (Eliminado o Ajeno)',
                productType: product?.type || 'OTHER',
                unit: product?.unit || 'UNIT',
                hasProduct: !!product
            };
        });
    }, [stock, products]);

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
                        type: newProductType,
                        unit: newProductUnit,
                        clientId: id
                    });
                } else {
                    // Create new
                    await addProduct({
                        name: newProductName,
                        type: newProductType,
                        unit: newProductUnit,
                        clientId: id
                    });
                }

                setIsNewProduct(false);
                setNewProductName('');
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
            const existingItem = stock.find(s => s.productId === selectedProductId);

            const newItem = {
                id: existingItem ? existingItem.id : generateId(),
                clientId: id,
                productId: selectedProductId,
                quantity: existingItem ? existingItem.quantity + qtyNum : qtyNum,
                lastUpdated: new Date().toISOString()
            };

            await updateStock(newItem);

            // Record Movement
            const product = availableProducts.find(p => p.id === selectedProductId);
            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            await db.put('movements', {
                id: generateId(),
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
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false
            });

            syncService.pushChanges();

            // Reset form fields for next entry (Batch mode)
            setSelectedProductId('');
            setQuantity('');
            setNote('');
            setShowNote(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
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

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Galpón Virtual</h1>
                        <p className="text-slate-500 mt-1">Gestión de stock y catálogo de productos.</p>
                    </div>
                    {!isReadOnly && (
                        <Button
                            onClick={() => {
                                setIsNewProduct(false);
                                setShowForm(true);
                            }}
                        >
                            Cargar Stock
                        </Button>
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
                                        label="Nombre del Producto"
                                        placeholder="ej. Glifosato 48%"
                                        value={newProductName}
                                        onChange={e => setNewProductName(e.target.value)}
                                        required
                                    />
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                                        <select
                                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                            value={newProductType}
                                            onChange={e => setNewProductType(e.target.value as ProductType)}
                                        >
                                            {productTypes.map(t => <option key={t} value={t}>{typeLabels[t]}</option>)}
                                        </select>
                                    </div>
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Unidad</label>
                                        <select
                                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
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
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="w-full">
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar Producto</label>
                                        <select
                                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                                            value={selectedProductId}
                                            onChange={e => setSelectedProductId(e.target.value)}
                                            required
                                        >
                                            <option value="">Seleccione un producto...</option>
                                            {availableProducts.map(p => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.unit})
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
                                        required
                                    />

                                    <Button type="submit" isLoading={isSubmitting} className="w-full">
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
                                    {!showNote && (
                                        <button
                                            type="button"
                                            onClick={() => setShowNote(true)}
                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                        >
                                            + Nota
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </form>
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
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Unidad</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {availableProducts.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">{p.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{typeLabels[p.type] || p.type}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{p.unit}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                {!isReadOnly && (
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => {
                                                                setNewProductName(p.name);
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
                                                            onClick={() => handleDeleteProduct(p.id)}
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

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Stock Actual</h3>
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
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Producto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Actual</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {enrichedStock.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                                            {item.productName}
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


            <div className="flex justify-end pr-2 pb-4 gap-2">
                <button
                    onClick={() => setViewMode(viewMode === 'CATALOG' ? 'STOCK' : 'CATALOG')}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
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
        </div>
    );
}
