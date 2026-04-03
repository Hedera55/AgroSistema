'use client';

import React, { useState, useEffect, useRef, memo, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Warehouse, Product, Client, Campaign, MovementItem } from '@/types';
import { InvestorSelector } from '@/components/InvestorSelector';
import { generateId } from '@/lib/uuid';

interface SegmentedDateInputProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
}

function SegmentedDateInput({ label, value, onChange }: SegmentedDateInputProps) {
    let d = '', m = '', y = '';
    
    // Support both ISO (YYYY-MM-DD) and legacy space-separated format (DD MM YY)
    if (value && value.includes('-')) {
        const isoParts = value.split('-');
        if (isoParts.length === 3) {
            y = isoParts[0].slice(-2);
            m = isoParts[1];
            d = isoParts[2];
        } else {
            d = value; // Fallback
        }
    } else {
        const parts = (value || '').split(' ');
        d = parts[0] || '';
        m = parts[1] || '';
        y = parts[2] || '';
    }

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
    facturaUploading: boolean;
    remitoFile?: File | null;
    setRemitoFile?: (val: File | null) => void;
    handleRemitoChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    remitoUploading?: boolean;
    movementType?: 'IN' | 'OUT' | 'SALE' | 'TRANSFER'; // to conditionally show
    campaigns?: Campaign[];
    selectedCampaignId?: string;
    setSelectedCampaignId?: (id: string) => void;
    isEditing?: boolean;
    isSubmitting?: boolean;
}

const StockEntryFormInternal = memo(({
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
    facturaUploading,
    remitoFile,
    setRemitoFile,
    handleRemitoChange,
    remitoUploading,
    movementType = 'IN',
    selectedInvestors,
    setSelectedInvestors,
    facturaDate,
    setFacturaDate,
    dueDate,
    setDueDate,
    campaigns,
    selectedCampaignId,
    setSelectedCampaignId,
    isEditing,
    showSellerInput,
    setShowSellerInput,
    showSellerDelete,
    setShowSellerDelete,
    sellerInputValue,
    setSellerInputValue,
    handleAddSeller,
    availableSellers,
    isSubmitting
}: StockEntryFormProps) => {
    // Visibility is now controlled by the parent conditional

    const filteredProducts = useMemo(() => {
        const sorted = availableProducts
            .filter((p: Product) => !p.brandName || p.brandName.toLowerCase() !== 'propia')
            .sort((a, b) => {
                const nameA = (a.activeIngredient || a.name).toLowerCase();
                const nameB = (b.activeIngredient || b.name).toLowerCase();
                return nameA.localeCompare(nameB);
            });

        const targetWId = selectedWarehouseId || activeWarehouseIds[0];
        const targetW = warehouses.find(w => w.id === targetWId);

        return sorted;
    }, [availableProducts, selectedWarehouseId, activeWarehouseIds, warehouses]);

    const activeProduct = useMemo(() =>
        availableProducts.find(p => p.id === activeStockItem.productId)
        , [availableProducts, activeStockItem.productId]);

    // Auto-calculate quantity from presentation fields
    useEffect(() => {
        if (activeStockItem.presentationAmount && activeStockItem.presentationContent) {
            const amount = parseFloat(activeStockItem.presentationAmount.toString().replace(',', '.'));
            const content = parseFloat(activeStockItem.presentationContent.toString().replace(',', '.'));
            
            if (!isNaN(amount) && !isNaN(content)) {
                const total = amount * content;
                const currentTotal = activeStockItem.quantity || '0';
                // Use a small epsilon for float comparison or just string comparison if we want precision
                if (total.toString() !== currentTotal) {
                    updateActiveStockItem('quantity', total.toString());
                }
            }
        }
    }, [activeStockItem.presentationAmount, activeStockItem.presentationContent, activeStockItem.quantity, updateActiveStockItem]);

    const productOptions = useMemo(() => [
        <option key="prod-default" value="">Seleccione...</option>,
        ...filteredProducts.map(p => {
            const isSeedOrGrain = p.type === 'SEED' || p.type === 'GRAIN';
            return (
                <option key={`prod-${p.id}`} value={p.id}>
                    {isSeedOrGrain
                        ? `${p.activeIngredient || p.name} (${p.commercialName || '-'}) (${p.brandName || '-'})`
                        : `${p.commercialName || '-'} (${p.activeIngredient || p.name}) (${p.brandName || '-'})`
                    }
                </option>
            );
        })
    ], [filteredProducts]);

    const [triedToAdd, setTriedToAdd] = useState(false);
    useEffect(() => {
        if (triedToAdd && activeStockItem.productId && activeStockItem.quantity && activeStockItem.price) {
            setTriedToAdd(false);
        }
    }, [activeStockItem, triedToAdd]);

    const sellerOptions = useMemo(() => [
        <option key="sell-default" value="">Seleccione...</option>,
        ...availableSellers.map(s => <option key={`opt-sel-${s}`} value={s}>{s}</option>),
        ...(selectedSeller && !availableSellers.includes(selectedSeller) ? [
            <option key="sell-fallback" value={selectedSeller}>{selectedSeller}</option>
        ] : []),
        <option key="sell-add" value="ADD_NEW">+ vendedor</option>,
        ...(availableSellers.length > 0 ? [
            <option key="sell-del" value="DELETE">- vendedor</option>
        ] : [])
    ], [availableSellers, selectedSeller]);

    const campaignOptions = useMemo(() => [
        <option key="camp-default" value="" className="text-slate-400">Seleccione Campaña...</option>,
        ...(campaigns?.map(c => (
            <option key={`opt-camp-${c.id}`} value={c.id}>{c.name}</option>
        )) || []),
        ...(selectedCampaignId && !campaigns?.some(c => c.id === selectedCampaignId) ? [
            <option key="camp-fallback" value={selectedCampaignId}>Campaña anterior</option>
        ] : [])
    ], [campaigns, selectedCampaignId]);

    const warehouseOptions = useMemo(() => [
        <option key="ware-default" value="">Seleccione...</option>,
        ...warehouses.map(w => (
            <option key={`opt-ware-${w.id}`} value={w.id}>{w.name}</option>
        ))
    ], [warehouses]);

    // Auto-select warehouse from active set if not already selected
    useEffect(() => {
        if (!selectedWarehouseId && activeWarehouseIds.length > 0) {
            setSelectedWarehouseId(activeWarehouseIds[0]);
        }
    }, [activeWarehouseIds, selectedWarehouseId, setSelectedWarehouseId]);

    const insumoRef = useRef<HTMLSelectElement>(null);
    const handleAddItem = () => {
        if (!activeStockItem.productId || !activeStockItem.quantity || !activeStockItem.price) {
            setTriedToAdd(true);
            return;
        }
        addStockToBatch();
        setTriedToAdd(false);
        setTimeout(() => {
            insumoRef.current?.focus();
        }, 0);
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn mb-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                    <span>
                        {isEditing 
                            ? 'Editar compra' 
                            : (activeWarehouseIds.length === 1 && warehouses.find(w => w.id === activeWarehouseIds[0])?.name === 'Acopio de Granos'
                                ? 'Gestión de Galpón (Granos)'
                                : 'Cargar compra de insumo')}
                    </span>
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
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Insumo</label>
                        <select
                            ref={insumoRef}
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={activeStockItem.productId || ''}
                            onChange={e => updateActiveStockItem('productId', e.target.value)}
                            required={stockItems.length === 0}
                        >
                            {productOptions}
                        </select>
                    </div>

                    <div className="md:col-span-12 lg:col-span-4">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            <span>Precio USD/</span>
                            <span>{activeProduct?.unit || 'u.'}</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className={`block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11 transition-colors ${triedToAdd && !activeStockItem.price ? 'bg-red-50 border-red-300' : ''}`}
                            value={activeStockItem.price || ''}
                            onChange={e => updateActiveStockItem('price', e.target.value.replace(',', '.'))}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end mb-4 border-b border-slate-100 pb-6">
                    <div className="md:col-span-3 relative">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Presentación</label>
                        <input
                            type="text"
                            list={`pres-list-${activeProduct?.id || 'default'}`}
                            className={`block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11 transition-colors ${triedToAdd && !activeStockItem.presentationLabel ? 'bg-red-50 border-red-300' : ''}`}
                            value={activeStockItem.presentationLabel || ''}
                            onChange={e => {
                                const val = e.target.value;
                                updateActiveStockItem('presentationLabel', val);

                                // Find if this value matches a standard presentation to auto-populate content
                                const found = activeProduct?.standardPresentations?.find(p => p.label === val);
                                if (found) {
                                    updateActiveStockItem('presentationContent', found.content.toString());
                                }
                            }}
                            onFocus={e => {
                                try {
                                    if (typeof (e.target as any).showPicker === 'function') {
                                        (e.target as any).showPicker();
                                    }
                                } catch (err) {}
                            }}
                            onClick={e => {
                                try {
                                    if (typeof (e.target as any).showPicker === 'function') {
                                        (e.target as any).showPicker();
                                    }
                                } catch (err) {}
                            }}
                            placeholder="Ej: Bidón, Caja"
                        />
                        <datalist id={`pres-list-${activeProduct?.id || 'default'}`}>
                            {activeProduct?.standardPresentations?.map((p, i) => (
                                <option key={i} value={p.label}>
                                    {p.label} x {p.content}{activeProduct.unit}
                                </option>
                            ))}
                        </datalist>
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            <span>Contenido (</span>
                            <span>{activeProduct?.unit || 'L/kg'}</span>
                            <span>)</span>
                        </label>
                        <input
                            type="text"
                            inputMode="decimal"
                            className={`block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11 transition-colors ${triedToAdd && !activeStockItem.presentationContent ? 'bg-red-50 border-red-300' : ''}`}
                            value={activeStockItem.presentationContent || ''}
                            onChange={e => updateActiveStockItem('presentationContent', e.target.value.replace(',', '.'))}
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
                            className={`block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11 font-bold text-emerald-600 transition-colors ${triedToAdd && !activeStockItem.presentationAmount ? 'bg-red-50 border-red-300' : ''}`}
                            value={activeStockItem.presentationAmount || ''}
                            onChange={e => updateActiveStockItem('presentationAmount', e.target.value.replace(',', '.'))}
                            placeholder="Ej: 5"
                        />
                    </div>

                    <div className="md:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                            <span>Total </span>
                            {activeProduct && <span>({activeProduct.unit})</span>}
                        </label>
                        <div className="flex items-center justify-between h-11 px-4 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-black text-sm">
                            {(!activeStockItem.presentationAmount && !activeStockItem.presentationContent) ? (
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm font-black text-emerald-700"
                                    value={activeStockItem.quantity || ''}
                                    onChange={e => updateActiveStockItem('quantity', e.target.value.replace(',', '.'))}
                                    placeholder="0"
                                />
                            ) : (
                                <span>{activeStockItem.quantity || '0'} </span>
                            )}
                            <span className="shrink-0">{activeProduct?.unit || ''}</span>
                        </div>
                    </div>

                    <div className="md:col-span-1">
                        <button
                            type="button"
                            onClick={handleAddItem}
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
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Insumos a cargar</label>
                        <div className="overflow-hidden divide-y divide-slate-100">
                            {stockItems.map((item, idx) => {
                                const product = availableProducts.find(p => p.id === item.productId);
                                return (
                                    <div key={idx} className="flex items-center justify-between p-3 hover:bg-orange-100 bg-orange-50/50 transition-colors border-l-4 border-orange-400 mb-1 rounded-r-md">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-slate-800 truncate">
                                                {product?.type === 'SEED'
                                                    ? `${product.name} - ${product.commercialName || '-'}`
                                                    : (product?.commercialName || product?.name || 'Insumo desconocido')}
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
                                                {product?.type === 'SEED'
                                                    ? `${item.tempBrand || product?.brandName || '-'} • USD ${item.price || '0.00'}/${product?.unit || 'u.'}`
                                                    : `${product?.activeIngredient ? `${product.activeIngredient} - ` : ''}${item.tempBrand || product?.brandName || '-'} • USD ${item.price || '0.00'}/${product?.unit || 'u.'}`
                                                }
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end justify-center mr-4 shrink-0">
                                            <div className="text-sm font-black text-emerald-700">
                                                USD {(parseFloat(item.quantity.toString().replace(',', '.')) * (parseFloat(item.price.toString().replace(',', '.')) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 ml-0">
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
                            value={selectedSeller || ''}
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
                            {sellerOptions}
                        </select>

                        {showSellerInput && (
                            <div className="absolute top-8 right-0 left-0 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-30 animate-fadeIn flex gap-2">
                                <input
                                    type="text"
                                    className="flex-1 rounded border-slate-300 text-base focus:ring-emerald-500 focus:border-emerald-500"
                                    placeholder="Nuevo vendedor..."
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
                            value={selectedCampaignId || ''}
                            onChange={e => setSelectedCampaignId?.(e.target.value)}
                        >
                            {campaignOptions}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Destino (Galpón)</label>
                        <select
                            className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-11"
                            value={selectedWarehouseId || (activeWarehouseIds.length > 0 ? activeWarehouseIds[0] : '')}
                            onChange={e => { (e.target as HTMLSelectElement).setCustomValidity(''); setSelectedWarehouseId(e.target.value); }}
                            required
                            onInvalid={e => (e.target as HTMLSelectElement).setCustomValidity('Seleccione un galpón')}
                            onInput={e => (e.target as HTMLSelectElement).setCustomValidity('')}
                        >
                            {warehouseOptions}
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
                                USD {stockItems.reduce((acc, it) => acc + (parseFloat(it.quantity.toString().replace(',', '.')) * (parseFloat(it.price.toString().replace(',', '.')) || 0)), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                <InvestorSelector
                    label="Pagado por"
                    availablePartners={[...(client?.partners || []), ...(client?.investors || [])]}
                    selectedInvestors={selectedInvestors}
                    onChange={setSelectedInvestors}
                />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => setShowNote(!showNote)}
                            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                        >
                            {showNote ? '× Cancelar' : (note ? 'Editar nota' : '+ Agregar nota')}
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

                        {/* Remito Conditionally Rendered for non-IN types if this form is ever repurposed, or just generally supported */}
                        {(movementType !== 'IN') && handleRemitoChange && setRemitoFile && (
                            <div className="flex items-center gap-2 border-l pl-4 border-slate-100">
                                <label
                                    htmlFor="remito-upload-stock"
                                    className="cursor-pointer text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 focus:outline-none focus:underline"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            document.getElementById('remito-upload-stock')?.click();
                                        }
                                    }}
                                >
                                    {remitoFile ? (
                                        <span className="text-emerald-700 font-bold truncate max-w-[200px]">{remitoFile.name}</span>
                                    ) : (
                                        <span>+ Adjuntar remito</span>
                                    )}
                                </label>
                                <input
                                    id="remito-upload-stock"
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleRemitoChange}
                                    className="hidden"
                                />
                                {remitoFile && (
                                    <button type="button" onClick={() => setRemitoFile(null)} className="text-red-400 hover:text-red-600">
                                        ✕
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <Button
                        type="submit"
                        isLoading={isSubmitting || facturaUploading}
                        className="px-8 bg-emerald-600 hover:bg-emerald-700 w-full sm:w-auto"
                    >
                        {isEditing ? 'Confirmar cambios' : 'Confirmar Compra'}
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
            </form>
        </div>
    );
});

export const StockEntryForm = StockEntryFormInternal;
