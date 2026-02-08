'use client';

import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { OrderItem, Product, Warehouse, ProductType } from '@/types';

interface OrderRecipeStepProps {
    selectedLot: { name: string; hectares: number };
    items: OrderItem[];
    availableProducts: Product[];
    warehouses: Warehouse[];
    contractors: { id: string; username: string }[];
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
    editingItemId: string | null;
    selectedApplicatorId: string;
    setSelectedApplicatorId: (val: string) => void;
    servicePrice: string;
    setServicePrice: (val: string) => void;
    selectedPartnerName: string;
    setSelectedPartnerName: (val: string) => void;
    showNotes: boolean;
    setShowNotes: (val: boolean) => void;
    notes: string;
    setNotes: (val: string) => void;
    facturaImageUrl: string | null;
    setFacturaImageUrl: (val: string | null) => void;
    handleAddItem: () => void;
    handleEditItem: (item: OrderItem) => void;
    handleRemoveItem: (id: string) => void;
    handleCancelEdit: () => void;
    onBack: () => void;
    onNext: () => void;
}

export function OrderRecipeStep({
    selectedLot,
    items,
    availableProducts,
    warehouses,
    contractors,
    typeLabels,
    currLoadingOrder,
    setCurrLoadingOrder,
    isMechanicalLabor,
    setIsMechanicalLabor,
    currProdId,
    setCurrProdId,
    currWarehouseId,
    setCurrWarehouseId,
    currDosage,
    setCurrDosage,
    mechanicalLaborName,
    setMechanicalLaborName,
    plantingSpacing,
    setPlantingSpacing,
    expectedYield,
    setExpectedYield,
    editingItemId,
    selectedApplicatorId,
    setSelectedApplicatorId,
    servicePrice,
    setServicePrice,
    selectedPartnerName,
    setSelectedPartnerName,
    showNotes,
    setShowNotes,
    notes,
    setNotes,
    facturaImageUrl,
    setFacturaImageUrl,
    handleAddItem,
    handleEditItem,
    handleRemoveItem,
    handleCancelEdit,
    onBack,
    onNext,
    clientPartners
}: OrderRecipeStepProps & { clientPartners?: any[] }) {
    const selectedProduct = availableProducts.find(p => p.id === currProdId);

    return (
        <div className="space-y-6 animate-fadeIn">
            <div className="bg-slate-50 py-1 px-4 rounded-lg flex justify-between items-center text-sm">
                <span className="font-bold text-slate-700">{selectedLot.name}</span>
                <span className="text-emerald-700 bg-emerald-100/50 px-2 rounded font-bold">{selectedLot.hectares} hectáreas</span>
            </div>

            <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                <div className="flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-1">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Orden de Carga</label>
                            <Input
                                type="number"
                                placeholder=""
                                value={currLoadingOrder}
                                onChange={e => setCurrLoadingOrder(e.target.value)}
                                className="h-[46px]"
                            />
                        </div>

                        <div className="md:col-span-4">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Producto / Labor</label>
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
                                }}
                            >
                                <option value="">Seleccionar...</option>
                                <optgroup label="Servicios Especiales">
                                    <option value="LABOREO_MECANICO">Laboreo Mecánico</option>
                                </optgroup>
                                <optgroup label="Stock Galpón">
                                    {availableProducts.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.activeIngredient || p.name} {p.commercialName ? `| ${p.commercialName}` : (p.brandName === 'Propia' ? '| Propia' : '')} ({typeLabels[p.type]})
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {!isMechanicalLabor && (
                            <div className="md:col-span-3">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Depósito</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2.5 px-4 text-sm h-[46px]"
                                    value={currWarehouseId}
                                    onChange={e => setCurrWarehouseId(e.target.value)}
                                >
                                    <option value="">Seleccione...</option>
                                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                                </select>
                            </div>
                        )}

                        {!isMechanicalLabor ? (
                            <div className="md:col-span-3">
                                <div className="flex flex-col">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Dosis</label>
                                    <div className="relative flex items-center h-[46px]">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder={selectedProduct?.type === 'SEED' ? "ej. 80" : "0.00"}
                                            value={currDosage}
                                            onChange={e => setCurrDosage(e.target.value)}
                                            className="h-[46px] pr-12"
                                        />
                                        {(currProdId) && (
                                            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                                                <span className="text-[10px] font-black text-slate-400 uppercase">
                                                    {selectedProduct?.type === 'SEED'
                                                        ? 'KG/ha'
                                                        : `${selectedProduct?.unit || 'u'}/ha`}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="md:col-span-6 animate-fadeIn">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Tipo de Laboreo</label>
                                <Input
                                    type="text"
                                    placeholder="Ej. Cosecha, Siembra, Pulverización..."
                                    value={mechanicalLaborName}
                                    onChange={e => setMechanicalLaborName(e.target.value)}
                                    className="h-[46px]"
                                />
                            </div>
                        )}

                        {selectedProduct?.type === 'SEED' ? (
                            <>
                                <div className="md:col-span-3 animate-fadeIn">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Espaciamiento (cm)</label>
                                    <Input type="number" step="0.1" placeholder="ej. 52.5" value={plantingSpacing} onChange={e => setPlantingSpacing(e.target.value)} className="h-[46px]" />
                                </div>
                                <div className="md:col-span-3 animate-fadeIn">
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">Rinde esperado (kg/ha)</label>
                                    <Input type="number" placeholder="ej. 3500" value={expectedYield} onChange={e => setExpectedYield(e.target.value)} className="h-[46px]" />
                                </div>
                                <div className="md:col-span-5 hidden md:block"></div>
                                <div className="md:col-span-1">
                                    <button
                                        onClick={handleAddItem}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-[46px] rounded-lg shadow-sm flex items-center justify-center text-white disabled:opacity-50 transition-colors"
                                        title={editingItemId ? 'Actualizar' : 'Agregar'}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="md:col-span-1 md:col-start-12">
                                <button
                                    onClick={handleAddItem}
                                    disabled={(!isMechanicalLabor && !currProdId) || (isMechanicalLabor && !mechanicalLaborName)}
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-[46px] rounded-lg shadow-sm flex items-center justify-center text-white disabled:opacity-50 transition-colors"
                                    title={editingItemId ? 'Actualizar' : 'Agregar'}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
                                </button>
                            </div>
                        )}
                    </div>

                    {editingItemId && (
                        <div className="flex justify-end pt-2">
                            <button
                                onClick={handleCancelEdit}
                                className="text-xs font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1"
                            >
                                <span>✕ Cancelar edición</span>
                            </button>
                        </div>
                    )}
                </div>

                {items.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-slate-100">
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Productos en la Orden de Carga</label>
                        <div className="space-y-2">
                            {items.map((item) => (
                                <div key={item.id} className="flex justify-between items-center p-3 hover:bg-orange-100 bg-orange-50/50 transition-colors border-l-4 border-orange-400 mb-1 rounded-r-md">
                                    <div>
                                        <div className="font-bold text-slate-800 text-sm">
                                            {item.productName} {item.commercialName ? `| ${item.commercialName}` : (item.brandName === 'Propia' ? '| Propia' : '')}
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 uppercase font-medium">
                                            {!item.plantingDensity && item.productId !== 'LABOREO_MECANICO' && (
                                                <span>Dosis: {item.dosage} {item.unit}/ha</span>
                                            )}
                                            {item.plantingDensity && (
                                                <span className="text-blue-600">Densidad: {item.plantingDensity} kg/ha</span>
                                            )}
                                            {item.plantingSpacing && (
                                                <span className="text-blue-600">Espaciamiento: {item.plantingSpacing} cm</span>
                                            )}
                                            {item.expectedYield && (
                                                <span className="text-blue-600">Rinde: {item.expectedYield} kg/ha</span>
                                            )}
                                            {item.warehouseName && (
                                                <span className="text-purple-600 font-bold">Depósito: {item.warehouseName}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <div className="font-mono text-emerald-600 font-bold text-xs whitespace-nowrap">{item.totalQuantity.toFixed(2)} {item.unit}</div>
                                            <div className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Total</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => handleEditItem(item)} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors" title="Editar">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                            </button>
                                            <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 text-slate-300 hover:text-red-400 transition-colors" title="Eliminar">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contratista</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm"
                            value={selectedApplicatorId}
                            onChange={e => setSelectedApplicatorId(e.target.value)}
                        >
                            <option value="">Seleccione Aplicador...</option>
                            {contractors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Precio Servicio / Ha (USD)</label>
                        <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={servicePrice}
                            onChange={e => setServicePrice(e.target.value)}
                            className="h-[46px]"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Socio que paga</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm"
                            value={selectedPartnerName}
                            onChange={e => setSelectedPartnerName(e.target.value)}
                        >
                            <option value="">Seleccione Socio...</option>
                            {clientPartners?.map((p: any) => (
                                <option key={p.name} value={p.name}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex items-center gap-6 pt-2 h-5">
                    <button
                        type="button"
                        onClick={() => setShowNotes(!showNotes)}
                        className={`inline-flex items-center text-[10px] font-bold uppercase tracking-widest transition-all ${showNotes ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                    >
                        {showNotes ? '✓ Nota Agregada' : '+ Agregar Nota'}
                    </button>
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
                </div>

                {showNotes && (
                    <div className="animate-fadeIn">
                        <textarea
                            className="w-full rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-sm p-4"
                            placeholder="Escriba aquí cualquier observación o detalle adicional..."
                            rows={3}
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="flex justify-between pt-6 border-t border-slate-100">
                <Button variant="secondary" onClick={onBack}>Volver</Button>
                <Button onClick={onNext} disabled={items.length === 0}>Confirmar Orden de Carga</Button>
            </div>
        </div>
    );
}
