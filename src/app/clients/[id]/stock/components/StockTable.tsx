'use client';

import React from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Warehouse, ProductType, Product } from '@/types';

interface EnrichedStockItem {
    id: string;
    productId: string;
    productName: string;
    warehouseName: string;
    productType: ProductType;
    unit: string;
    price: number;
    quantity: number;
    productBrand?: string;
    productCommercialName?: string;
    presentationLabel?: string;
    presentationContent?: number;
    presentationAmount?: number;
    breakdown?: any[];
}

interface StockTableProps {
    activeWarehouseIds: string[];
    warehouses: Warehouse[];
    stockLoading: boolean;
    productsLoading: boolean;
    enrichedStock: EnrichedStockItem[];
    toggleStockSelection: (id: string, e: React.MouseEvent) => void;
    selectedStockIds: string[];
    handleEditBrand: (stockId: string, currentBrand: string) => void;
    typeLabels: Record<ProductType, string>;
    sellingStockId: string | null;
    handleSaleSubmit: (e: React.FormEvent) => Promise<void>;
    saleQuantity: string;
    setSaleQuantity: (val: string) => void;
    salePrice: string;
    setSalePrice: (val: string) => void;
    isSubmitting: boolean;
    facturaUploading: boolean;
    saleTruckDriver: string;
    setSaleTruckDriver: (val: string) => void;
    salePlateNumber: string;
    setSalePlateNumber: (val: string) => void;
    saleDestination: string;
    setSaleDestination: (val: string) => void;
    showSaleNote: boolean;
    setShowSaleNote: (val: boolean) => void;
    saleNote: string;
    setSaleNote: (val: string) => void;
    saleFacturaFile: File | null;
    setSaleFacturaFile: (val: File | null) => void;
    saleTrailerPlate: string;
    setSaleTrailerPlate: (val: string) => void;
    saleHumidity: string;
    setSaleHumidity: (val: string) => void;
    saleDischargeNumber: string;
    setSaleDischargeNumber: (val: string) => void;
    saleTransportCompany: string;
    setSaleTransportCompany: (val: string) => void;
    saleHectoliterWeight: string;
    setSaleHectoliterWeight: (val: string) => void;
    saleGrossWeight: string;
    setSaleGrossWeight: (val: string) => void;
    saleTareWeight: string;
    setSaleTareWeight: (val: string) => void;
    products: Product[];
    clearSelection: () => void;
}

export function StockTable({
    activeWarehouseIds,
    warehouses,
    stockLoading,
    productsLoading,
    enrichedStock,
    toggleStockSelection,
    selectedStockIds,
    handleEditBrand,
    typeLabels,
    sellingStockId,
    handleSaleSubmit,
    saleQuantity,
    setSaleQuantity,
    salePrice,
    setSalePrice,
    isSubmitting,
    facturaUploading,
    saleTruckDriver,
    setSaleTruckDriver,
    salePlateNumber,
    setSalePlateNumber,
    saleDestination,
    setSaleDestination,
    showSaleNote,
    setShowSaleNote,
    saleNote,
    setSaleNote,
    saleFacturaFile,
    setSaleFacturaFile,
    saleTrailerPlate,
    setSaleTrailerPlate,
    saleHumidity,
    setSaleHumidity,
    saleDischargeNumber,
    setSaleDischargeNumber,
    saleTransportCompany,
    setSaleTransportCompany,
    saleHectoliterWeight,
    setSaleHectoliterWeight,
    saleGrossWeight,
    setSaleGrossWeight,
    saleTareWeight,
    setSaleTareWeight,
    products,
    clearSelection
}: StockTableProps) {
    const [expandedRows, setExpandedRows] = React.useState<string[]>([]);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (target.closest('button')) return;
            if (target.closest('form')) return;
            if (target.closest('.stock-row')) return;

            clearSelection();
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [clearSelection]);

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('.chevron-area')) return;

        const isSelected = selectedStockIds.includes(id);
        const isExpanded = expandedRows.includes(id);

        if (!isSelected) {
            toggleStockSelection(id, e);
            if (!isExpanded) {
                setExpandedRows(prev => [...prev, id]);
            }
        } else {
            toggleStockSelection(id, e);
            if (isExpanded) {
                setExpandedRows(prev => prev.filter(rowId => rowId !== id));
            }
        }
    };

    const handleChevronClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedRows(prev =>
            prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
        );
    };
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                    {activeWarehouseIds.length === 1
                        ? `Inventario - ${warehouses.find(w => w.id === activeWarehouseIds[0])?.name || 'Galpón'}`
                        : 'Inventario'
                    }
                </h3>
            </div>
            {activeWarehouseIds.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    <h3 className="text-lg font-medium text-slate-900">Seleccione uno o más galpones</h3>
                    <p>elija galpones para ver su inventario</p>
                </div>
            ) : stockLoading || productsLoading ? (
                <div className="p-8 text-center text-slate-500">Cargando stock...</div>
            ) : enrichedStock.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    <h3 className="text-lg font-medium text-slate-900">Sin inventario</h3>
                    <p>No hay productos cargados en los galpones seleccionados.</p>
                </div>
            ) : (
                <div
                    className="overflow-x-auto"
                    onWheel={(e) => {
                        if (e.deltaY !== 0) {
                            e.preventDefault();
                            e.currentTarget.scrollLeft += e.deltaY;
                        }
                    }}
                >
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left"></th>
                                <th className="px-2 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre Comercial</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A. / Cultivo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Precio PPP</th>
                                {!(activeWarehouseIds.length === 1 && warehouses.find(w => w.id === activeWarehouseIds[0])?.name === 'Acopio de Granos') && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total (USD)</th>
                                )}
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Stock Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {enrichedStock.map((item) => (
                                <React.Fragment key={item.id}>
                                    <tr
                                        onClick={(e) => handleRowClick(item.id, e)}
                                        className={`stock-row transition-colors cursor-pointer group ${selectedStockIds.includes(item.id) ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-400 chevron-area" onClick={(e) => handleChevronClick(item.id, e)}>
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16" height="16"
                                                viewBox="0 0 24 24" fill="none"
                                                stroke="currentColor" strokeWidth="2.5"
                                                strokeLinecap="round" strokeLinejoin="round"
                                                className={`transition-transform duration-200 cursor-pointer hover:text-emerald-500 ${expandedRows.includes(item.id) ? 'rotate-90 text-emerald-500' : ''}`}
                                            >
                                                <polyline points="9 18 15 12 9 6"></polyline>
                                            </svg>
                                        </td>
                                        <td className="px-2 py-4 whitespace-nowrap text-sm text-slate-900 font-bold">
                                            {item.productCommercialName || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                            {products.find(p => p.id === item.productId)?.activeIngredient || item.productName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {item.productBrand || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {typeLabels[item.productType as ProductType] || item.productType}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium text-slate-400">
                                            USD {(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {!(activeWarehouseIds.length === 1 && warehouses.find(w => w.id === activeWarehouseIds[0])?.name === 'Acopio de Granos') && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-500">
                                                USD {(item.quantity * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600">
                                            {item.quantity} <span className="text-slate-400 text-xs ml-1 font-normal group-hover:text-emerald-300 transition-colors uppercase tracking-tight">{item.unit}</span>
                                        </td>
                                    </tr>

                                    {/* Breakdown Rows */}
                                    {expandedRows.includes(item.id) && item.breakdown && item.breakdown.length > 0 && (
                                        <tr className="bg-slate-50/50">
                                            <td colSpan={10} className="px-6 py-3">
                                                <div className="flex flex-col gap-1 pl-8 border-l-2 border-slate-200">
                                                    {item.breakdown
                                                        .filter(b => b.presentationLabel || b.presentationContent)
                                                        .map((b, bIdx) => (
                                                            <div key={bIdx} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest min-w-[100px] text-left">
                                                                        {b.presentationLabel || 'S/P'}
                                                                    </span>
                                                                    <span className="text-sm font-bold text-slate-700">
                                                                        {b.presentationContent || '-'}{item.unit} <span className="text-slate-400 font-normal mx-1">x</span>
                                                                        <span className="text-emerald-600 font-black">{b.presentationAmount || '-'}</span>
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm font-black text-slate-800">
                                                                    {b.quantity} <span className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    {item.breakdown.filter(b => !b.presentationLabel && !b.presentationContent).map((b, bIdx) => (
                                                        <div key={`generic-${bIdx}`} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0 opacity-60">
                                                            <div className="flex items-center gap-3 italic text-slate-400">
                                                                <span className="text-[11px] font-medium uppercase tracking-widest min-w-[100px] text-left">Granel / Otros</span>
                                                            </div>
                                                            <div className="text-sm font-bold text-slate-400">
                                                                {b.quantity} <span className="text-[10px] uppercase">{item.unit}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                    {sellingStockId === item.id && (
                                        <tr className="bg-emerald-50/50 animate-fadeIn">
                                            <td colSpan={10} className="px-6 py-4">
                                                <form onSubmit={handleSaleSubmit} className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-emerald-200 shadow-sm" onClick={e => e.stopPropagation()}>
                                                    <div className="flex flex-wrap items-end gap-4">
                                                        <div className="flex-1 min-w-[120px]">
                                                            <Input
                                                                label="Cantidad a Vender (Tons)"
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={saleQuantity}
                                                                onChange={e => setSaleQuantity(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-[120px]">
                                                            <Input
                                                                label="Precio de Venta (USD/Tons)"
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={salePrice}
                                                                onChange={e => setSalePrice(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex gap-2 mb-1">
                                                            <Button type="submit" size="sm" disabled={isSubmitting || facturaUploading}>Confirmar Venta</Button>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                        <Input
                                                            label="Chofer (Transportista)"
                                                            value={saleTruckDriver}
                                                            onChange={e => setSaleTruckDriver(e.target.value)}
                                                            placeholder="Nombre Completo"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="Patente Camión"
                                                            value={salePlateNumber}
                                                            onChange={e => setSalePlateNumber(e.target.value)}
                                                            placeholder="AAA 123"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="Patente Acoplado"
                                                            value={saleTrailerPlate}
                                                            onChange={e => setSaleTrailerPlate(e.target.value)}
                                                            placeholder="BBB 456"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="Destino"
                                                            value={saleDestination}
                                                            onChange={e => setSaleDestination(e.target.value)}
                                                            placeholder="Localidad"
                                                            className="bg-white h-9"
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                        <Input
                                                            label="Emb. Transportista"
                                                            value={saleTransportCompany}
                                                            onChange={e => setSaleTransportCompany(e.target.value)}
                                                            placeholder="Empresa"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="Nro de descarga"
                                                            value={saleDischargeNumber}
                                                            onChange={e => setSaleDischargeNumber(e.target.value)}
                                                            placeholder="0001"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="Humedad (%)"
                                                            value={saleHumidity}
                                                            onChange={e => setSaleHumidity(e.target.value)}
                                                            placeholder="14.5"
                                                            className="bg-white h-9"
                                                        />
                                                        <Input
                                                            label="P. Hectolítrico"
                                                            value={saleHectoliterWeight}
                                                            onChange={e => setSaleHectoliterWeight(e.target.value)}
                                                            placeholder="78"
                                                            className="bg-white h-9"
                                                        />
                                                        <div className="grid grid-cols-2 gap-2 flex-grow sm:col-span-1 min-w-[150px]">
                                                            <Input
                                                                label="Peso Bruto"
                                                                value={saleGrossWeight}
                                                                onChange={e => setSaleGrossWeight(e.target.value)}
                                                                placeholder="30000"
                                                                className="bg-white h-9"
                                                            />
                                                            <Input
                                                                label="Peso Tara"
                                                                value={saleTareWeight}
                                                                onChange={e => setSaleTareWeight(e.target.value)}
                                                                placeholder="10000"
                                                                className="bg-white h-9"
                                                            />
                                                        </div>
                                                    </div>

                                                    {showSaleNote && (
                                                        <div className="animate-fadeIn w-full mt-2 flex gap-2">
                                                            <div className="flex-1">
                                                                <label className="block text-xs font-medium text-slate-500 mb-1">Nota de Venta</label>
                                                                <textarea
                                                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3"
                                                                    rows={2}
                                                                    placeholder="Escribe una nota para este movimiento..."
                                                                    value={saleNote}
                                                                    onChange={(e) => setSaleNote(e.target.value)}
                                                                    autoFocus
                                                                />
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setShowSaleNote(false);
                                                                }}
                                                                className="h-[68px] mt-5 w-12 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
                                                                title="Confirmar nota"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                    <line x1="5" y1="12" x2="19" y2="12"></line>
                                                                    <polyline points="12 5 19 12 12 19"></polyline>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col sm:flex-row items-center justify-start gap-4 mt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowSaleNote(!showSaleNote)}
                                                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                                                        >
                                                            {showSaleNote ? 'Quitar Nota' : (saleNote ? 'Editar Nota' : '+ Agregar Nota')}
                                                        </button>

                                                        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                                                            <label htmlFor={`factura-upload-sale-${item.id}`} className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">
                                                                {saleFacturaFile ? (
                                                                    <span className="text-emerald-700 font-bold truncate max-w-[120px]">{saleFacturaFile.name}</span>
                                                                ) : (
                                                                    <span>+ Adjuntar factura</span>
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
    );
}
