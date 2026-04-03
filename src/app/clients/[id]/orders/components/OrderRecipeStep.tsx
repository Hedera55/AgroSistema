'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OrderItem, Product, Warehouse, ProductType, OrderType } from '@/types';
import { kml } from '@tmcw/togeojson';
import { InvestorSelector } from '@/components/InvestorSelector';

interface OrderRecipeStepProps {
    selectedLot: { name: string; hectares: number };
    items: OrderItem[];
    availableProducts: Product[];
    warehouses: Warehouse[];
    contractors: any[];
    partners: any[];
    investors: any[];
    orderType: OrderType;
    typeLabels: Record<ProductType, string>;
    currLoadingOrder: string;
    setCurrLoadingOrder: (val: string) => void;
    isMechanicalLabor: boolean;
    setIsMechanicalLabor: (val: boolean) => void;
    currProdId: string;
    setCurrProdId: (val: string) => void;
    currWarehouseId: string;
    setCurrWarehouseId: (val: string) => void;
    currDosage: string;
    setCurrDosage: (val: string) => void;
    mechanicalLaborName: string;
    setMechanicalLaborName: (val: string) => void;
    plantingSpacing: string;
    setPlantingSpacing: (val: string) => void;
    expectedYield: string;
    setExpectedYield: (val: string) => void;
    fertilizerPlacement?: 'LINE' | 'SIDE';
    setFertilizerPlacement: (val: 'LINE' | 'SIDE' | undefined) => void;
    editingItemId: string | null;
    selectedApplicatorId: string;
    setSelectedApplicatorId: (id: string) => void;
    servicePrice: string;
    setServicePrice: (price: string) => void;
    selectedPartnerName: string;
    setSelectedPartnerName: (name: string) => void;
    selectedInvestors: Array<{ name: string; percentage: number }>;
    setSelectedInvestors: (investors: Array<{ name: string; percentage: number }>) => void;
    showNotes: boolean;
    setShowNotes: (val: boolean) => void;
    notes: string;
    setNotes: (val: string) => void;
    facturaImageUrl: string | null;
    setFacturaImageUrl: (val: string | null) => void;
    remitoImageUrl: string | null;
    setRemitoImageUrl: (val: string | null) => void;
    selectedCampaignId?: string;
    setSelectedCampaignId?: (val: string) => void;
    campaigns?: any[];
    subQuantities: Record<string, string | number>;
    setSubQuantities: (val: Record<string, string | number>) => void;
    stock: any[];
    handleAddItem: () => void;
    handleEditItem: (item: OrderItem) => void;
    handleRemoveItem: (id: string) => void;
    handleCancelEdit: () => void;
    onBack: () => void;
    onNext: () => void;
    kmlData: string | null;
    setKmlData: (val: string | null) => void;
    boundary: any;
    setBoundary: (val: any) => void;
    technicalResponsible: string;
    setTechnicalResponsible: (val: string) => void;
}

export function OrderRecipeStep({
    selectedLot,
    items,
    availableProducts,
    warehouses,
    contractors,
    partners,
    investors,
    orderType,
    typeLabels,
    currLoadingOrder,
    setCurrLoadingOrder,
    isMechanicalLabor,
    setIsMechanicalLabor,
    currProdId,
    setCurrProdId,
    currDosage,
    setCurrDosage,
    mechanicalLaborName,
    setMechanicalLaborName,
    plantingSpacing,
    setPlantingSpacing,
    expectedYield,
    setExpectedYield,
    fertilizerPlacement,
    setFertilizerPlacement,
    editingItemId,
    selectedApplicatorId,
    setSelectedApplicatorId,
    servicePrice,
    setServicePrice,
    selectedPartnerName,
    setSelectedPartnerName,
    selectedInvestors,
    setSelectedInvestors,
    showNotes,
    setShowNotes,
    notes,
    setNotes,
    facturaImageUrl,
    setFacturaImageUrl,
    remitoImageUrl,
    setRemitoImageUrl,
    subQuantities,
    setSubQuantities,
    stock,
    handleAddItem,
    handleEditItem,
    handleRemoveItem,
    handleCancelEdit,
    onBack,
    onNext,
    selectedCampaignId,
    setSelectedCampaignId,
    campaigns,
    kmlData,
    setKmlData,
    boundary,
    setBoundary,
    technicalResponsible,
    setTechnicalResponsible
}: OrderRecipeStepProps) {
    const selectedProduct = availableProducts.find(p => p.id === currProdId);

    // Filter stock for the selected product and group by warehouse
    const productStock = stock.filter(s => s.productId === currProdId && s.quantity > 0);
    const stockByWarehouse = warehouses.map(w => ({
        ...w,
        items: productStock.filter(s => s.warehouseId === w.id)
    })).filter(w => w.items.length > 0);

    const [dosageError, setDosageError] = useState(false);

    const normalizedDosage = currDosage.replace(',', '.');
    const requiredTotal = (parseFloat(normalizedDosage) || 0) * (selectedLot.hectares || 0);

    const selectedTotal = Object.entries(subQuantities).reduce((acc, [stockId, val]) => {
        const s = productStock.find(item => item.id === stockId);
        if (!s) return acc;
        const multiplierStr = typeof val === 'string' ? val.replace(',', '.') : String(val);
        const multiplier = parseFloat(multiplierStr) || 0;
        return acc + (multiplier * (s.presentationContent || 1));
    }, 0);

    const diff = selectedTotal - requiredTotal;
    const containsSeed = items.some(i => i.productType === 'SEED');
    const currentlySelectedProduct = availableProducts.find(p => p.id === currProdId);
    const isSelectingSeed = currentlySelectedProduct?.type === 'SEED';
    const isSowingOrder = containsSeed || isSelectingSeed;
    const showLoadingOrder = !isSowingOrder && !isMechanicalLabor;

    const handleMultiplierChange = (stockId: string, val: string) => {
        // Allow only one separator
        let cleaned = val.replace(/[^\d.,]/g, '');
        const match = cleaned.match(/[.,]/);
        if (match) {
            const sep = match[0];
            const firstIndex = cleaned.indexOf(sep);
            const before = cleaned.substring(0, firstIndex + 1);
            const after = cleaned.substring(firstIndex + 1).replace(/[.,]/g, '');
            cleaned = before + after;
        }
        setSubQuantities({ ...subQuantities, [stockId]: cleaned });
    };

    const isMaiz = selectedProduct?.name.toUpperCase().includes('MAIZ');
    const bagsCount = isMaiz && currDosage ? (parseFloat(currDosage.replace(',', '.')) / 80000).toFixed(2) : null;

    const onAddClick = () => {
        if (!isMechanicalLabor && !currDosage) {
            setDosageError(true);
            return;
        }
        setDosageError(false);
        handleAddItem();
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-50 py-1 px-4 rounded-lg flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">{selectedLot.name}</span>
                <span className="text-emerald-700 bg-emerald-100/50 px-2 rounded font-bold">{selectedLot.hectares} hectáreas</span>
            </div>

            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        {showLoadingOrder && (
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Orden</label>
                                <Input
                                    type="text"
                                    placeholder=""
                                    value={currLoadingOrder}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9]/g, '');
                                        setCurrLoadingOrder(val);
                                    }}
                                    className="h-[46px]"
                                />
                            </div>
                        )}

                        <div className={showLoadingOrder ? "md:col-span-8" : "md:col-span-9"}>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Insumo / Labor</label>
                            <select
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2.5 px-4 text-sm h-[46px]"
                                value={isMechanicalLabor ? 'LABOREO_MECANICO' : currProdId}
                                onChange={e => {
                                    if (e.target.value === 'LABOREO_MECANICO') {
                                        setIsMechanicalLabor(true);
                                        setCurrProdId('');
                                    } else {
                                        setIsMechanicalLabor(false);
                                        setCurrProdId(e.target.value);
                                    }
                                    setSubQuantities({});
                                    setDosageError(false);
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                <optgroup label="Servicios Especiales">
                                    <option value="LABOREO_MECANICO">Laboreo Mecánico</option>
                                </optgroup>
                                <optgroup label="Stock Galpón">
                                    {availableProducts.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.type === 'SEED'
                                                ? `${p.name} - ${p.commercialName || 'Propia'}`
                                                : `${p.commercialName || p.name}${p.activeIngredient ? ` (${p.activeIngredient})` : ''}`} ({typeLabels[p.type]})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {!isMechanicalLabor ? (
                            <div className="md:col-span-3">
                                <div className="flex flex-col">
                                    <label className={`block text-[10px] font-black uppercase tracking-widest mb-1.5 leading-none ${dosageError ? 'text-red-500' : 'text-slate-400'}`}>
                                        {selectedProduct?.type === 'SEED' ? 'Densidad' : 'Dosis'}
                                    </label>
                                    <div className="relative flex items-center h-[46px]">
                                        <Input
                                            type="text"
                                            placeholder={selectedProduct?.type === 'SEED' ? "ej. 80" : "0.00"}
                                            value={currDosage}
                                            onChange={e => {
                                                let cleaned = e.target.value.replace(/[^\d.,]/g, '');
                                                const match = cleaned.match(/[.,]/);
                                                if (match) {
                                                    const sep = match[0];
                                                    const firstIdx = cleaned.indexOf(sep);
                                                    cleaned = cleaned.substring(0, firstIdx + 1) + cleaned.substring(firstIdx + 1).replace(/[.,]/g, '');
                                                }
                                                setCurrDosage(cleaned);
                                                if (cleaned) setDosageError(false);
                                            }}
                                            className={`h-[46px] pr-12 transition-colors ${dosageError ? 'bg-red-50 border-red-500 focus:ring-red-500' : ''}`}
                                        />
                                        {(currProdId) && (
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                <span className={`text-[10px] font-black uppercase ${dosageError ? 'text-red-400' : 'text-slate-400'}`}>
                                                    {isMaiz ? (bagsCount ? `${selectedProduct?.unit || 'sem'}/ha (${bagsCount} bolsas)` : `${selectedProduct?.unit || 'sem'}/ha`) : (selectedProduct?.type === 'SEED' ? 'KG/ha' : `${selectedProduct?.unit || 'u'}/ha`)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {selectedProduct?.type === 'FERTILIZER' && (
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => setFertilizerPlacement(fertilizerPlacement === 'LINE' ? undefined : 'LINE')}
                                                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-bold uppercase tracking-tight transition-all ${fertilizerPlacement === 'LINE' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                            >
                                                En la línea
                                            </button>
                                            <button
                                                onClick={() => setFertilizerPlacement(fertilizerPlacement === 'SIDE' ? undefined : 'SIDE')}
                                                className={`flex-1 py-1 px-2 rounded-md border text-[10px] font-bold uppercase tracking-tight transition-all ${fertilizerPlacement === 'SIDE' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-400'}`}
                                            >
                                                Al costado
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="md:col-span-3 animate-fadeIn">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Tipo de Laboreo</label>
                                <Input
                                    type="text"
                                    placeholder="Ej. Cosecha, Siembra..."
                                    value={mechanicalLaborName}
                                    onChange={e => setMechanicalLaborName(e.target.value)}
                                    className="h-[46px]"
                                />
                            </div>
                        )}

                    </div>


                    {!isMechanicalLabor && currProdId && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 animate-fadeIn space-y-4">
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Selección de Stock por Depósito</h4>
                                <div className="text-right">
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Requerido</div>
                                    <div className="text-sm font-mono font-black text-slate-700">{requiredTotal.toFixed(2)} {selectedProduct?.unit}</div>
                                </div>
                            </div>

                            {stockByWarehouse.length > 0 ? (
                                <div className="space-y-6">
                                    {stockByWarehouse.map(wh => (
                                        <div key={wh.id} className="space-y-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{wh.name}</span>
                                                <div className="h-[1px] flex-1 bg-slate-200"></div>
                                            </div>
                                            <div className="divide-y divide-slate-100">
                                                {wh.items.map(s => (
                                                    <div key={s.id} className="flex items-center justify-between py-2.5 px-1 hover:bg-slate-100/50 transition-colors rounded-md">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">
                                                                {s.presentationLabel || `A granel (${selectedProduct?.unit || ''})`} {s.presentationContent ? `${s.presentationContent}${selectedProduct?.unit || ''}` : ''}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-medium tracking-tight">Disponible: {s.quantity} {selectedProduct?.unit}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">x</span>
                                                            <input
                                                                type="text"
                                                                className="w-16 h-8 rounded-md border-slate-200 text-sm font-bold text-center focus:border-emerald-500 focus:ring-emerald-500"
                                                                value={subQuantities[s.id] || ''}
                                                                onChange={e => handleMultiplierChange(s.id, e.target.value)}
                                                                placeholder="0"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center bg-white rounded-lg border border-dashed border-slate-200">
                                    <span className="text-sm text-slate-400">Sin stock disponible en ningún depósito.</span>
                                </div>
                            )}

                            {/* Verification Summary */}
                            <div className="pt-4 border-t border-slate-200 flex justify-between items-end">
                                <div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Total Seleccionado</div>
                                    <div className={`text-sm font-mono font-black ${selectedTotal > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {selectedTotal.toFixed(2)} {selectedProduct?.unit}
                                    </div>
                                </div>
                                <div className="text-right">
                                    {currDosage && (
                                        <div className={`text-[11px] font-black uppercase tracking-tight py-1 ${diff >= 0 ? 'text-blue-600' : 'text-orange-500'}`}>
                                            {diff === 0 ? '✓ Cantidad Exacta' : (diff > 0 ? `Exceso ${diff.toFixed(2)} ${selectedProduct?.unit}` : `Déficit ${Math.abs(diff).toFixed(2)} ${selectedProduct?.unit}`)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedProduct?.type === 'SEED' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Espaciamiento (cm)</label>
                                <Input type="text" placeholder="ej. 52.5" value={plantingSpacing} onChange={e => {
                                    let cleaned = e.target.value.replace(/[^\d.,]/g, '');
                                    const match = cleaned.match(/[.,]/);
                                    if (match) {
                                        const sep = match[0];
                                        const firstIdx = cleaned.indexOf(sep);
                                        cleaned = cleaned.substring(0, firstIdx + 1) + cleaned.substring(firstIdx + 1).replace(/[.,]/g, '');
                                    }
                                    setPlantingSpacing(cleaned);
                                }} className="h-[46px]" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Rinde esperado (kg/ha)</label>
                                <Input type="text" placeholder="ej. 3500" value={expectedYield} onChange={e => {
                                    let cleaned = e.target.value.replace(/[^\d.,]/g, '');
                                    const match = cleaned.match(/[.,]/);
                                    if (match) {
                                        const sep = match[0];
                                        const firstIdx = cleaned.indexOf(sep);
                                        cleaned = cleaned.substring(0, firstIdx + 1) + cleaned.substring(firstIdx + 1).replace(/[.,]/g, '');
                                    }
                                    setExpectedYield(cleaned);
                                }} className="h-[46px]" />
                            </div>
                        </div>
                    )}

                    {((currProdId && !isMechanicalLabor) || (isMechanicalLabor && mechanicalLaborName)) && (
                        <div className="flex justify-end gap-6 pt-2 animate-fadeIn">
                            <button
                                onClick={handleCancelEdit}
                                className="text-[10px] font-black text-slate-400 hover:text-red-500 transition-all uppercase tracking-widest"
                            >
                                ✕ Cancelar
                            </button>
                            <button
                                onClick={onAddClick}
                                disabled={(!isMechanicalLabor && !currProdId) || (isMechanicalLabor && !mechanicalLaborName)}
                                className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-30 transition-all shadow-sm"
                            >
                                {editingItemId ? '✓ Confirmar Edición' : '+ Agregar'}
                            </button>
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="space-y-4 pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Resumen de Insumos / Labores</label>
                        <div className="space-y-3">
                            {Array.from(new Set(items.map(i => i.groupId || i.id))).map(groupId => {
                                const groupItems = items.filter(i => (i.groupId || i.id) === groupId);
                                const first = groupItems[0];
                                const isLabor = first.productId === 'LABOREO_MECANICO';
                                const totalInGroup = groupItems.reduce((acc, i) => acc + i.totalQuantity, 0);

                                return (
                                    <div key={groupId} className="animate-fadeIn relative pr-8">
                                        <div className="flex flex-col flex-1 min-w-0">
                                            <div className="flex justify-between items-start mb-2 gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    {first.loadingOrder && <span className="text-slate-800 font-black text-xs mt-0.5">#{first.loadingOrder}</span>}
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <div className="flex items-baseline gap-3">
                                                            <span className="font-black text-sm uppercase tracking-tight text-slate-800 truncate">
                                                                {first.productType === 'SEED'
                                                                    ? `${first.productName}${first.brandName ? ` (${first.brandName})` : ''}`
                                                                    : `${first.commercialName || first.productName}${first.activeIngredient ? ` (${first.activeIngredient})` : ''}`}
                                                            </span>
                                                        </div>
                                                        {!isLabor && (first.plantingDensity || first.plantingSpacing || first.expectedYield) && (
                                                            <div className="flex flex-wrap gap-x-2 text-emerald-600/70 font-bold uppercase text-[9px] leading-none mt-[2px]">
                                                                {first.plantingDensity && (
                                                                    <span>
                                                                        densidad: {first.plantingDensity} {first.unit}/ha
                                                                    </span>
                                                                )}
                                                                {first.plantingSpacing && <span>espaciamiento: {first.plantingSpacing} cm</span>}
                                                                {first.expectedYield && <span>rendimiento: {first.expectedYield} kg/ha</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {!isLabor && (
                                                    <div className="flex flex-col items-end shrink-0">
                                                        <span className="text-emerald-700 uppercase font-black text-sm whitespace-nowrap">
                                                            {(first.dosage * selectedLot.hectares).toFixed(1)} {first.unit}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="pl-4 space-y-0.5">
                                                {groupItems.map(item => (
                                                    <div key={item.id} className="space-y-0.5">
                                                        <div className="flex justify-between items-center text-[11px] leading-tight">
                                                            <span className={`font-bold ${item.isVirtualDéficit ? 'text-orange-500' : 'text-slate-500'}`}>
                                                                {item.multiplier ? `${item.multiplier} x ` : ''}
                                                                {item.isVirtualDéficit
                                                                    ? 'Déficit'
                                                                    : (item.presentationLabel || (isLabor ? 'Labor' : `A granel (${item.unit})`))}
                                                                {!item.isVirtualDéficit && item.presentationContent ? ` (${item.presentationContent}${item.unit})` : ''}
                                                                {item.warehouseName && <span className="opacity-60 font-medium ml-1">— {item.warehouseName}</span>}
                                                            </span>
                                                            <span className={`font-mono font-bold ml-2 ${item.isVirtualDéficit ? 'text-orange-500' : 'text-slate-400'}`}>
                                                                {item.totalQuantity.toFixed(2)} {item.unit}
                                                            </span>
                                                        </div>
                                                        {item.fertilizerPlacement && (
                                                            <div className="text-emerald-600/70 font-bold uppercase text-[11px] leading-none mt-1">
                                                                Ubicación: {item.fertilizerPlacement === 'LINE' ? 'En la línea' : 'Al costado'}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {(() => {
                                                const requiredTotal = first.dosage * selectedLot.hectares;
                                                const excess = totalInGroup - requiredTotal;
                                                if (excess > 0.01) {
                                                    return (
                                                        <div className="flex justify-between items-center text-[11px] leading-tight text-blue-600 font-bold mt-1 pl-4">
                                                            <span>EXCESO</span>
                                                            <span className="font-mono">{excess.toFixed(2)} {first.unit}</span>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <div className="absolute top-0 -right-5 flex flex-col items-center gap-1 shrink-0">
                                            <button onClick={() => handleEditItem(first)} className="p-1 text-slate-300 hover:text-emerald-500 transition-colors" title="Editar">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                            </button>
                                            <button onClick={() => handleRemoveItem(first.groupId || first.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors" title="Eliminar">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-4">
                    <div className="sm:col-span-1 xl:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Contratista</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-4 text-sm h-[42px]"
                            value={selectedApplicatorId}
                            onChange={e => setSelectedApplicatorId(e.target.value)}
                        >
                            <option value="">Seleccione Aplicador...</option>
                            {contractors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                        </select>
                    </div>
                    <div className="sm:col-span-1 xl:col-span-3">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Responsable Técnico</label>
                        <Input
                            type="text"
                            placeholder="Nombre..."
                            value={technicalResponsible}
                            onChange={e => setTechnicalResponsible(e.target.value)}
                            className="h-[42px]"
                        />
                    </div>
                    <div className="sm:col-span-1 xl:col-span-4">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Precio Servicio / Ha (USD)</label>
                        <Input
                            type="text"
                            placeholder="0.00"
                            value={servicePrice}
                            onChange={e => {
                                let cleaned = e.target.value.replace(/[^\d.,]/g, '');
                                const match = cleaned.match(/[.,]/);
                                if (match) {
                                    const sep = match[0];
                                    const firstIdx = cleaned.indexOf(sep);
                                    cleaned = cleaned.substring(0, firstIdx + 1) + cleaned.substring(firstIdx + 1).replace(/[.,]/g, '');
                                }
                                setServicePrice(cleaned);
                            }}
                            className="h-[42px]"
                        />
                    </div>
                    <div className="sm:col-span-1 xl:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Campaña</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 px-4 text-sm h-[42px]"
                            value={selectedCampaignId}
                            onChange={e => setSelectedCampaignId?.(e.target.value)}
                        >
                            <option value="">Seleccionar...</option>
                            {campaigns?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="col-span-1 sm:col-span-2 xl:col-span-12 mt-6">
                        <InvestorSelector
                            label="Pagado por (Opcional)"
                            availablePartners={[...(partners || []), ...(investors || [])]}
                            selectedInvestors={selectedInvestors}
                            onChange={setSelectedInvestors}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-6 pt-2 h-5">
                    <button
                        type="button"
                        onClick={() => setShowNotes(!showNotes)}
                        className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest transition-all min-w-[120px] text-emerald-600 hover:text-emerald-700"
                    >
                        {showNotes ? '✕ Cancelar' : (notes ? 'Editar Nota' : '+ Agregar Nota')}
                    </button>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center">
                            <button
                                type="button"
                                onClick={() => document.getElementById('factura-upload')?.click()}
                                className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest transition-all ${facturaImageUrl ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                                {facturaImageUrl ? '✓ Factura Adjunta' : '+ Adjuntar Factura'}
                            </button>
                            <input
                                id="factura-upload"
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => setFacturaImageUrl(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex items-center">
                            <button
                                type="button"
                                onClick={() => document.getElementById('remito-upload')?.click()}
                                className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest transition-all ${remitoImageUrl ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                                {remitoImageUrl ? '✓ Remito Adjunto' : '+ Adjuntar Remito'}
                            </button>
                            <input
                                id="remito-upload"
                                type="file"
                                className="hidden"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onloadend = () => setRemitoImageUrl(reader.result as string);
                                        reader.readAsDataURL(file);
                                    }
                                }}
                            />
                        </div>

                        <div className="flex items-center">
                            <button
                                type="button"
                                onClick={() => document.getElementById('kml-upload')?.click()}
                                className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest transition-all ${kmlData ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                                {kmlData ? '✓ KML adjunto' : '+ Adjuntar KML'}
                            </button>
                            <input
                                id="kml-upload"
                                type="file"
                                className="hidden"
                                accept=".kml"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (event) => {
                                            const kmlText = event.target?.result as string;
                                            try {
                                                const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
                                                const geojson = kml(dom);
                                                setBoundary(geojson);
                                                setKmlData(kmlText);
                                            } catch (err) {
                                                alert('Error al leer KML.');
                                            }
                                        };
                                        reader.readAsText(file);
                                    }
                                }}
                            />
                            {kmlData && (
                                <button
                                    onClick={() => { setKmlData(null); setBoundary(null); }}
                                    className="ml-2 text-[10px] text-red-500 font-bold uppercase"
                                >
                                    [ Eliminar ]
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {showNotes && (
                    <div className="animate-fadeIn flex gap-2 items-start">
                        <textarea
                            className="flex-1 rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2.5 px-4 h-10 resize-none"
                            placeholder="Escriba aquí cualquier observación o detalle adicional..."
                            rows={1}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setShowNotes(false)}
                            className="h-10 w-10 flex-shrink-0 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-sm"
                            title="Confirmar nota"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
                <Button variant="secondary" onClick={onBack}>Volver</Button>
                <Button onClick={onNext} disabled={items.length === 0}>
                    {isSowingOrder ? 'Confirmar Orden de Siembra' : 'Confirmar Orden de Trabajo'}
                </Button>
            </div>
        </div>
    );
}
