'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Warehouse, Product, Client } from '@/types';

interface StockEntryFormProps {
    showStockForm: boolean;
    setShowStockForm: (val: boolean) => void;
    warehouses: Warehouse[];
    activeWarehouseId: string | null;
    setStockItems: (items: any[]) => void;
    handleStockSubmit: (e: React.FormEvent) => Promise<void>;
    activeStockItem: { productId: string; quantity: string; price: string; tempBrand: string };
    updateActiveStockItem: (field: string, value: string) => void;
    stockItems: { productId: string; quantity: string; price: string; tempBrand: string }[];
    availableProducts: Product[];
    selectedWarehouseId: string;
    setSelectedWarehouseId: (id: string) => void;
    addStockToBatch: () => void;
    editBatchItem: (idx: number) => void;
    removeBatchItem: (idx: number) => void;
    selectedSeller: string;
    setSelectedSeller: (val: string) => void;
    setShowSellerInput: (val: boolean) => void;
    setShowSellerDelete: (val: boolean) => void;
    availableSellers: string[];
    showSellerInput: boolean;
    showSellerDelete: boolean;
    sellerInputValue: string;
    setSellerInputValue: (val: string) => void;
    handleAddSeller: () => void;
    setAvailableSellers: (val: string[]) => void;
    saveClientSellers: (sellers: string[]) => void;
    selectedInvestor: string;
    setSelectedInvestor: (val: string) => void;
    client: Client | null;
    showNote: boolean;
    setShowNote: (val: boolean) => void;
    note: string;
    setNote: (val: string) => void;
    setNoteConfirmed: (val: boolean) => void;
    facturaFile: File | null;
    setFacturaFile: (val: File | null) => void;
    handleFacturaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    isSubmitting: boolean;
    facturaUploading: boolean;
}

export function StockEntryForm({
    showStockForm,
    setShowStockForm,
    warehouses,
    activeWarehouseId,
    setStockItems,
    handleStockSubmit,
    activeStockItem,
    updateActiveStockItem,
    stockItems,
    availableProducts,
    selectedWarehouseId,
    setSelectedWarehouseId,
    addStockToBatch,
    editBatchItem,
    removeBatchItem,
    selectedSeller,
    setSelectedSeller,
    setShowSellerInput,
    setShowSellerDelete,
    availableSellers,
    showSellerInput,
    showSellerDelete,
    sellerInputValue,
    setSellerInputValue,
    handleAddSeller,
    setAvailableSellers,
    saveClientSellers,
    selectedInvestor,
    setSelectedInvestor,
    client,
    showNote,
    setShowNote,
    note,
    setNote,
    setNoteConfirmed,
    facturaFile,
    setFacturaFile,
    handleFacturaChange,
    isSubmitting,
    facturaUploading
}: StockEntryFormProps) {
    if (!showStockForm) return null;

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                    {warehouses.find(w => w.id === activeWarehouseId)?.name === 'Acopio de Granos' ? 'Gestión de Galpón (Granos)' : 'Cargar Ingreso de Stock'}
                </h2>
                <button
                    onClick={() => {
                        setShowStockForm(false);
                        setStockItems([{ productId: '', quantity: '', price: '', tempBrand: '' }]);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <form onSubmit={handleStockSubmit} className="space-y-6">
                <div className="space-y-4 mb-4">
                    <div className="relative animate-fadeIn">
                        <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                            <div className="md:col-span-5">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Insumo / Producto</label>
                                <select
                                    className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-10"
                                    value={activeStockItem.productId}
                                    onChange={e => updateActiveStockItem('productId', e.target.value)}
                                    required={stockItems.length === 0}
                                >
                                    <option value="">Seleccione...</option>
                                    {availableProducts
                                        .filter(p => {
                                            const targetW = warehouses.find(w => w.id === (selectedWarehouseId || activeWarehouseId));
                                            if (targetW?.name === 'Acopio de Granos') return p.type === 'SEED';
                                            return true;
                                        })
                                        .map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.activeIngredient || p.name} ({p.commercialName || '-'}) ({p.brandName || '-'})
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <div className="w-full">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            required={stockItems.length === 0}
                                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-10"
                                            value={activeStockItem.quantity}
                                            onChange={e => updateActiveStockItem('quantity', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-3">
                                <div className="w-full">
                                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                                        Precio USD/{availableProducts.find(p => p.id === activeStockItem.productId)?.unit || 'u.'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            inputMode="decimal"
                                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-10"
                                            value={activeStockItem.price}
                                            onChange={e => updateActiveStockItem('price', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 flex justify-end items-end">
                                <button
                                    type="button"
                                    onClick={addStockToBatch}
                                    className="w-10 h-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm"
                                    title="Agregar a la lista"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M5 12h14" />
                                        <path d="M12 5v14" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    {stockItems.length > 0 && (
                        <div className="space-y-2 pt-2">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Productos a cargar</label>
                            <div className="overflow-hidden divide-y divide-slate-100">
                                {stockItems.map((item, idx) => {
                                    const product = availableProducts.find(p => p.id === item.productId);
                                    return (
                                        <div key={idx} className="flex items-center justify-between p-3 hover:bg-orange-100 bg-orange-50/50 transition-colors border-l-4 border-orange-400 mb-1 rounded-r-md">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-bold text-slate-800 truncate">
                                                    {product?.activeIngredient || product?.name || 'Insumo desconocido'}
                                                </div>
                                                <div className="text-[10px] text-slate-400 uppercase font-medium flex gap-2">
                                                    <span>{product?.commercialName || '-'}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{item.quantity} {product?.unit || 'u.'}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>USD {item.price ? (parseFloat(item.price) * parseFloat(item.quantity)).toFixed(2) : '0.00'}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 ml-4">
                                                <button
                                                    type="button"
                                                    onClick={() => editBatchItem(idx)}
                                                    className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors"
                                                    title="Editar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeBatchItem(idx)}
                                                    className="p-1.5 text-slate-300 hover:text-red-400 transition-colors"
                                                    title="Eliminar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendedor</label>
                        <div className="relative">
                            <select
                                className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                                value={selectedSeller}
                                onChange={e => {
                                    if (e.target.value === 'ADD_NEW') {
                                        setShowSellerInput(true);
                                    } else if (e.target.value === 'DELETE') {
                                        setShowSellerDelete(true);
                                    } else {
                                        setSelectedSeller(e.target.value);
                                    }
                                }}
                            >
                                <option value="">Seleccione...</option>
                                {availableSellers.map(s => <option key={s} value={s}>{s}</option>)}
                                <option value="ADD_NEW">+ vendedor</option>
                                {availableSellers.length > 0 && <option value="DELETE">- vendedor</option>}
                            </select>

                            {showSellerInput && (
                                <div className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn flex gap-2">
                                    <input
                                        type="text"
                                        className="flex-1 rounded border-slate-300 text-[10px] focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="NUEVO VENDEDOR..."
                                        value={sellerInputValue}
                                        onChange={e => setSellerInputValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddSeller();
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleAddSeller()}
                                        className="bg-emerald-500 text-white rounded px-2 py-1 text-xs font-bold hover:bg-emerald-600"
                                    >
                                        +
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowSellerInput(false)}
                                        className="text-slate-400 p-1 hover:text-slate-600"
                                    >
                                        ✕
                                    </button>
                                </div>
                            )}

                            {showSellerDelete && (
                                <div className="absolute top-0 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn pr-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowSellerDelete(false)}
                                        className="absolute top-1 right-1 text-slate-400 hover:text-slate-600 p-1"
                                    >
                                        ✕
                                    </button>
                                    <p className="text-[10px] text-slate-500 mb-2 font-medium">Eliminar vendedor:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {availableSellers.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    const newSellers = availableSellers.filter(seller => seller !== s);
                                                    setAvailableSellers(newSellers);
                                                    saveClientSellers(newSellers);
                                                }}
                                                className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold uppercase border border-slate-200 hover:bg-slate-200 hover:border-slate-300 transition-colors"
                                            >
                                                {s} ✕
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Inversor / Pagado por</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={selectedInvestor}
                            onChange={e => setSelectedInvestor(e.target.value)}
                        >
                            <option value="">Seleccione un socio...</option>
                            {client?.partners?.map((p: any) => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destino (Galpón)</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={selectedWarehouseId || activeWarehouseId || ''}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                            required
                        >
                            <option value="">Seleccione...</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setShowNote(!showNote)}
                            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                        >
                            {showNote ? '× Quitar Nota' : (note ? 'Editar nota' : '+ Agregar nota')}
                        </button>

                        <div className="flex items-center gap-2 border-l pl-4 border-slate-100">
                            <label
                                htmlFor="factura-upload-stock"
                                className="cursor-pointer text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 focus:outline-none focus:underline"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        document.getElementById('factura-upload-stock')?.click();
                                    }
                                }}
                            >
                                {facturaFile ? (
                                    <span className="text-emerald-700 font-bold truncate max-w-[200px]">{facturaFile.name}</span>
                                ) : (
                                    <span>+ Adjuntar factura</span>
                                )}
                            </label>
                            <input
                                id="factura-upload-stock"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFacturaChange}
                                className="hidden"
                            />
                            {facturaFile && (
                                <button type="button" onClick={() => setFacturaFile(null)} className="text-red-400 hover:text-red-600">
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        isLoading={isSubmitting || facturaUploading}
                        className="px-8 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                    >
                        Confirmar Compra
                    </Button>
                </div>

                {showNote && (
                    <div className="pt-2 flex gap-2 animate-fadeIn">
                        <textarea
                            className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-3 px-4"
                            rows={2}
                            placeholder="ej. Factura #0001-12345678, observaciones adicionales..."
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setNoteConfirmed(true);
                                setShowNote(false);
                            }}
                            className="h-[68px] w-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
                            title="Confirmar nota"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                                <polyline points="12 5 19 12 12 19"></polyline>
                            </svg>
                        </button>
                    </div>
                )}
            </form>
        </div>
    );
}
