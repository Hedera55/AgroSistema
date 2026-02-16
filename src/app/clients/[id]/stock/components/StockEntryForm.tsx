'use client';

import React, { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Warehouse, Product, Client, Campaign } from '@/types';

interface SegmentedDateInputProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

function SegmentedDateInput({ label, value, onChange }: SegmentedDateInputProps) {
    const parts = value.split(' ');
    const d = parts[0] || '';
    const m = parts[1] || '';
    const y = parts[2] || '';

    const dRef = React.useRef<HTMLInputElement>(null);
    const mRef = React.useRef<HTMLInputElement>(null);
    const yRef = React.useRef<HTMLInputElement>(null);

    const updateValue = (newD: string, newM: string, newY: string) => {
        onChange(`${newD} ${newM} ${newY}`.trimEnd());
    };

    const handleDChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 2);
        updateValue(val, m, y);
        if (val.length === 2) mRef.current?.focus();
    };

    const handleMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 2);
        updateValue(d, val, y);
        if (val.length === 2) yRef.current?.focus();
    };

    const handleYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '').slice(0, 2);
        updateValue(d, m, val);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, part: 'd' | 'm' | 'y') => {
        if (e.key === 'Backspace') {
            if (part === 'm' && !m) dRef.current?.focus();
            if (part === 'y' && !y) mRef.current?.focus();
        }
    };

    return (
        <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</label>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg h-11 px-3 shadow-sm focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 transition-all">
                <input
                    ref={dRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="DD"
                    className="w-7 text-center border-none p-0 focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300"
                    value={d}
                    onChange={handleDChange}
                    onKeyDown={(e) => handleKeyDown(e, 'd')}
                />
                <span className="text-slate-300 font-bold">-</span>
                <input
                    ref={mRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="MM"
                    className="w-7 text-center border-none p-0 focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300"
                    value={m}
                    onChange={handleMChange}
                    onKeyDown={(e) => handleKeyDown(e, 'm')}
                />
                <span className="text-slate-300 font-bold">-</span>
                <input
                    ref={yRef}
                    type="text"
                    inputMode="numeric"
                    placeholder="YY"
                    className="w-7 text-center border-none p-0 focus:ring-0 text-sm font-medium text-slate-600 placeholder:text-slate-300"
                    value={y}
                    onChange={handleYChange}
                    onKeyDown={(e) => handleKeyDown(e, 'y')}
                />
            </div>
        </div>
    );
}

interface StockEntryFormProps {
    showStockForm: boolean;
    setShowStockForm: (val: boolean) => void;
    warehouses: Warehouse[];
    activeWarehouseIds: string[];
    setStockItems: (items: any[]) => void;
    handleStockSubmit: (e: React.FormEvent) => Promise<void>;
    activeStockItem: {
        productId: string;
        quantity: string;
        price: string;
        tempBrand: string;
        presentationLabel: string;
        presentationContent: string;
        presentationAmount: string;
    };
    updateActiveStockItem: (field: string, value: string) => void;
    stockItems: {
        productId: string;
        quantity: string;
        price: string;
        tempBrand: string;
        presentationLabel?: string;
        presentationContent?: string;
        presentationAmount?: string;
    }[];
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
    selectedInvestors: { name: string; percentage: number }[];
    setSelectedInvestors: (val: { name: string; percentage: number }[]) => void;
    facturaDate: string;
    setFacturaDate: (val: string) => void;
    dueDate: string;
    setDueDate: (val: string) => void;
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
    campaigns: Campaign[];
    selectedCampaignId: string;
    setSelectedCampaignId: (id: string) => void;
}

export function StockEntryForm({
    showStockForm,
    setShowStockForm,
    warehouses,
    activeWarehouseIds,
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
    facturaUploading,
    selectedInvestors,
    setSelectedInvestors,
    facturaDate,
    setFacturaDate,
    dueDate,
    setDueDate,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId
}: StockEntryFormProps) {
    if (!showStockForm) return null;

    // Sort products alphabetically
    const sortedProducts = [...availableProducts].sort((a, b) => {
        const nameA = (a.activeIngredient || a.name).toLowerCase();
        const nameB = (b.activeIngredient || b.name).toLowerCase();
        return nameA.localeCompare(nameB);
    });

    const activeProduct = availableProducts.find(p => p.id === activeStockItem.productId);

    const handleAddInvestor = (name: string) => {
        if (!name) return;
        if (selectedInvestors.find(i => i.name === name)) return;

        // precise logic: if first one, 100%. If adding second, maybe split? 
        // User didn't specify auto-split logic, just "box appears with percentage box".
        // Default to 0 or 100? Let's default to 0 and let user fill, or 100 if it's the first.
        const newInv = { name, percentage: selectedInvestors.length === 0 ? 100 : 0 };
        setSelectedInvestors([...selectedInvestors, newInv]);
    };

    const handleRemoveInvestor = (name: string) => {
        setSelectedInvestors(selectedInvestors.filter(i => i.name !== name));
    };

    const handleUpdateInvestorPercentage = (name: string, pctStr: string) => {
        const pct = parseFloat(pctStr) || 0;
        setSelectedInvestors(selectedInvestors.map(i => i.name === name ? { ...i, percentage: pct } : i));
    };

    // Auto-select warehouse from active set if not already selected
    useEffect(() => {
        if (!selectedWarehouseId && activeWarehouseIds.length > 0) {
            setSelectedWarehouseId(activeWarehouseIds[0]);
        }
    }, [activeWarehouseIds, selectedWarehouseId, setSelectedWarehouseId]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                    {activeWarehouseIds.length === 1 && warehouses.find(w => w.id === activeWarehouseIds[0])?.name === 'Acopio de Granos' ? 'Gestión de Galpón (Granos)' : 'Cargar Compra de Insumo'}
                </h2>
                <button
                    onClick={() => {
                        setShowStockForm(false);
                        setStockItems([]);
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
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end mb-4 border-b border-slate-100 pb-6">
                    <div className="md:col-span-12 lg:col-span-8">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Insumo / Producto</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={activeStockItem.productId}
                            onChange={e => updateActiveStockItem('productId', e.target.value)}
                            required={stockItems.length === 0}
                        >
                            <option value="">Seleccione...</option>
                            {sortedProducts
                                .filter(p => {
                                    const targetW = warehouses.find(w => w.id === (selectedWarehouseId || activeWarehouseIds[0]));
                                    if (targetW?.name === 'Acopio de Granos') return p.type === 'SEED';
                                    return true;
                                })
                                .map(p => (
                                    <option key={p.id} value={p.id}>
                                        {p.commercialName || '-'} ({p.activeIngredient || p.name}) ({p.brandName || '-'})
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="md:col-span-12 lg:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            Precio USD/{activeProduct?.unit || 'u.'}
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={activeStockItem.price}
                            onChange={e => updateActiveStockItem('price', e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end mb-4 border-b border-slate-100 pb-6">
                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Presentación</label>
                        <input
                            type="text"
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={activeStockItem.presentationLabel || ''}
                            onChange={e => updateActiveStockItem('presentationLabel', e.target.value)}
                            placeholder="Ej: Bidón, Caja"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Contenido ({activeProduct?.unit || 'L/kg'})</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={activeStockItem.presentationContent || ''}
                            onChange={e => updateActiveStockItem('presentationContent', e.target.value)}
                            placeholder="Ej: 20"
                        />
                    </div>

                    <div className="md:col-span-1 flex justify-center pb-3 text-slate-400 font-bold">
                        ✕
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Cantidad Fïsica</label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11 font-bold text-emerald-600"
                            value={activeStockItem.presentationAmount || ''}
                            onChange={e => updateActiveStockItem('presentationAmount', e.target.value)}
                            placeholder="Ej: 5"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total {activeProduct ? `(${activeProduct.unit})` : ''}</label>
                        <div className="flex items-center justify-between h-11 px-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-sm">
                            {activeStockItem.quantity || '0'} {activeProduct?.unit || ''}
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <button
                            type="button"
                            onClick={addStockToBatch}
                            disabled={!activeStockItem.productId || !activeStockItem.quantity}
                            className="w-full h-11 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Agregar a la lista"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14" />
                                <path d="M12 5v14" />
                            </svg>
                        </button>
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
                                                {product?.commercialName || product?.name || 'Insumo desconocido'}
                                            </div>
                                            <div className="text-[10px] items-center gap-2 font-bold mt-0.5 flex">
                                                {item.presentationLabel && item.presentationContent ? (
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-red-600 font-bold uppercase tracking-tighter text-sm">
                                                            {item.presentationLabel} {item.presentationContent}{product?.unit || ''}
                                                        </span>
                                                        <span className="text-slate-400 font-normal ml-0.5">x</span>
                                                        <span className="text-sm font-bold text-red-600 ml-0.5">
                                                            {item.presentationAmount}
                                                        </span>
                                                        <span className="text-slate-400 font-normal ml-0.5">=</span>
                                                    </div>
                                                ) : null}
                                                <span className="text-sm font-bold text-slate-800">
                                                    {item.quantity} {product?.unit || 'u.'}
                                                </span>
                                            </div>
                                            <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest mt-0.5">
                                                {product?.activeIngredient ? `${product.activeIngredient} - ` : ''}{item.tempBrand || product?.brandName || '-'} • USD {item.price || '0.00'}/{product?.unit || 'u.'}
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-slate-100">
                    <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Vendedor</label>
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
                            <div className="absolute top-8 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 rounded border-slate-300 text-base focus:ring-emerald-500 focus:border-emerald-500"
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
                            <div className="absolute top-8 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn pr-6">
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

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Campaña</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={selectedCampaignId}
                            onChange={e => setSelectedCampaignId(e.target.value)}
                        >
                            <option value="" className="text-slate-400">Seleccione Campaña...</option>
                            {campaigns.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destino (Galpón)</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={selectedWarehouseId || (activeWarehouseIds.length > 0 ? activeWarehouseIds[0] : '')}
                            onChange={e => setSelectedWarehouseId(e.target.value)}
                            required
                        >
                            <option value="">Seleccione...</option>
                            {warehouses.map(w => (
                                <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                        </select>
                    </div>

                    <SegmentedDateInput
                        label="Fecha Emisión"
                        value={facturaDate}
                        onChange={setFacturaDate}
                    />

                    <SegmentedDateInput
                        label="Fecha Vencimiento"
                        value={dueDate}
                        onChange={setDueDate}
                    />

                    <div className="md:flex flex-col justify-end">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Total Compra</label>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg h-11 px-4 flex items-center justify-end shadow-sm">
                            <span className="text-lg font-black text-emerald-700">
                                USD {stockItems.reduce((acc, it) => acc + (parseFloat(it.quantity) * (parseFloat(it.price) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Pagado por</label>
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="w-[180px] shrink-0">
                            <select
                                className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-9"
                                value=""
                                onChange={e => {
                                    handleAddInvestor(e.target.value);
                                    e.target.value = "";
                                }}
                            >
                                <option value="">...</option>
                                {client?.partners?.map((p: any) => (
                                    <option key={p.name} value={p.name}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        {selectedInvestors.map((inv, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white p-1 pl-2 pr-1 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                                <div className="text-xs font-bold text-slate-700 username-text truncate max-w-[100px]">{inv.name}</div>
                                <div className="flex items-center gap-1 bg-slate-50 rounded px-1">
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={inv.percentage}
                                        onChange={(e) => handleUpdateInvestorPercentage(inv.name, e.target.value)}
                                        className="w-10 h-6 text-right text-xs rounded border-none bg-transparent focus:ring-0 p-0 font-mono font-bold text-emerald-600"
                                    />
                                    <span className="text-slate-400 text-[10px]">%</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveInvestor(inv.name)}
                                    className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Eliminar"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {selectedInvestors.length === 0 && (
                            <span className="text-xs text-slate-400 italic">Agregue inversores...</span>
                        )}
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

                {
                    showNote && (
                        <div className="pt-2 flex gap-2 animate-fadeIn">
                            <textarea
                                className="block w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-3 px-4 h-12 min-h-[48px] resize-y"
                                rows={1}
                                placeholder="ej. Factura #0001-12345678..."
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
                                className="h-12 w-12 bg-emerald-500 text-white rounded-xl flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0 aspect-square"
                                title="Confirmar nota"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                    <polyline points="12 5 19 12 12 19"></polyline>
                                </svg>
                            </button>
                        </div>
                    )
                }
            </form >
        </div >
    );
}
