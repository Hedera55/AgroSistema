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
    salePrimarySaleCuit: string;
    setSalePrimarySaleCuit: (val: string) => void;
    saleDepartureDateTime: string;
    setSaleDepartureDateTime: (val: string) => void;
    saleDistanceKm: string;
    setSaleDistanceKm: (val: string) => void;
    saleFreightTariff: string;
    setSaleFreightTariff: (val: string) => void;
    saleDestinationCompany: string;
    setSaleDestinationCompany: (val: string) => void;
    saleDestinationAddress: string;
    setSaleDestinationAddress: (val: string) => void;
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
    salePrimarySaleCuit,
    setSalePrimarySaleCuit,
    saleDepartureDateTime,
    setSaleDepartureDateTime,
    saleDistanceKm,
    setSaleDistanceKm,
    saleFreightTariff,
    setSaleFreightTariff,
    saleDestinationCompany,
    setSaleDestinationCompany,
    saleDestinationAddress,
    setSaleDestinationAddress,
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
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total (USD)</th>
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
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-500">
                                            USD {(item.quantity * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
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
                                                <form onSubmit={handleSaleSubmit} className="flex flex-col gap-4 bg-white p-6 rounded-xl border border-emerald-200 shadow-lg relative" onClick={e => e.stopPropagation()}>
                                                    <button
                                                        type="button"
                                                        onClick={() => clearSelection()}
                                                        className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors"
                                                    >
                                                        ✕
                                                    </button>

                                                    <h4 className="text-xs font-black text-emerald-800 uppercase tracking-[0.2em] mb-2">Registrar Detalle de Venta</h4>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2">
                                                        <Input
                                                            label="Cantidad a Vender (Tons)"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={saleQuantity}
                                                            onChange={e => setSaleQuantity(e.target.value)}
                                                            required
                                                            className="h-11 font-bold text-lg"
                                                        />
                                                        <Input
                                                            label="Precio de Venta (USD/Tons)"
                                                            type="text"
                                                            inputMode="decimal"
                                                            value={salePrice}
                                                            onChange={e => setSalePrice(e.target.value)}
                                                            required
                                                            className="h-11 font-bold text-lg"
                                                        />
                                                    </div>

                                                    <div className="space-y-4">
                                                        {/* Logistics Section 1 */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                            <Input
                                                                label="Empresa de Destino"
                                                                value={saleDestinationCompany}
                                                                onChange={e => setSaleDestinationCompany(e.target.value)}
                                                                placeholder="Planta / Acopio..."
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="Dirección / Localidad"
                                                                value={saleDestinationAddress}
                                                                onChange={e => setSaleDestinationAddress(e.target.value)}
                                                                placeholder="Ruta, Localidad..."
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="CUIT Venta Primaria"
                                                                value={salePrimarySaleCuit}
                                                                onChange={e => setSalePrimarySaleCuit(e.target.value)}
                                                                placeholder="..."
                                                                className="bg-white h-10"
                                                            />
                                                        </div>

                                                        {/* Logistics Section 2 */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                            <Input
                                                                label="Chofer"
                                                                value={saleTruckDriver}
                                                                onChange={e => setSaleTruckDriver(e.target.value)}
                                                                placeholder="Nombre..."
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="Patente Camión"
                                                                value={salePlateNumber}
                                                                onChange={e => setSalePlateNumber(e.target.value)}
                                                                placeholder="..."
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="Patente Acoplado"
                                                                value={saleTrailerPlate}
                                                                onChange={e => setSaleTrailerPlate(e.target.value)}
                                                                placeholder="..."
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="Empresa Transporte"
                                                                value={saleTransportCompany}
                                                                onChange={e => setSaleTransportCompany(e.target.value)}
                                                                placeholder="..."
                                                                className="bg-white h-10"
                                                            />
                                                        </div>

                                                        {/* Logistics Section 3 */}
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                                            <Input
                                                                label="Nro Descarga"
                                                                value={saleDischargeNumber}
                                                                onChange={e => setSaleDischargeNumber(e.target.value)}
                                                                className="bg-white h-10 text-center"
                                                            />
                                                            <Input
                                                                label="Humedad (%)"
                                                                value={saleHumidity}
                                                                onChange={e => setSaleHumidity(e.target.value)}
                                                                className="bg-white h-10 text-center"
                                                            />
                                                            <Input
                                                                label="P. Hectolítrico"
                                                                value={saleHectoliterWeight}
                                                                onChange={e => setSaleHectoliterWeight(e.target.value)}
                                                                className="bg-white h-10 text-center"
                                                            />
                                                            <Input
                                                                label="Peso Bruto"
                                                                value={saleGrossWeight}
                                                                onChange={e => setSaleGrossWeight(e.target.value)}
                                                                className="bg-white h-10 text-right font-mono"
                                                            />
                                                            <Input
                                                                label="Peso Tara"
                                                                value={saleTareWeight}
                                                                onChange={e => setSaleTareWeight(e.target.value)}
                                                                className="bg-white h-10 text-right font-mono"
                                                            />
                                                            <Input
                                                                label="Km Recorridos"
                                                                value={saleDistanceKm}
                                                                onChange={e => setSaleDistanceKm(e.target.value)}
                                                                className="bg-white h-10 text-center"
                                                            />
                                                        </div>

                                                        {/* Logistics Section 4 */}
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                            <Input
                                                                label="Fecha y Hora Partida"
                                                                type="datetime-local"
                                                                value={saleDepartureDateTime}
                                                                onChange={e => setSaleDepartureDateTime(e.target.value)}
                                                                className="bg-white h-10"
                                                            />
                                                            <Input
                                                                label="Tarifa Flete (USD)"
                                                                value={saleFreightTariff}
                                                                onChange={e => setSaleFreightTariff(e.target.value)}
                                                                className="bg-white h-10 text-right"
                                                                placeholder="0.00"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 pt-6 border-t border-slate-100">
                                                        <div className="flex items-center gap-6">
                                                            <div className="min-w-[120px]">
                                                                {!showSaleNote ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setShowSaleNote(true)}
                                                                        className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2"
                                                                    >
                                                                        + Agregar Nota
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 animate-fadeIn">
                                                                        <Input
                                                                            placeholder="Nota..."
                                                                            value={saleNote}
                                                                            onChange={e => setSaleNote(e.target.value)}
                                                                            className="h-10 text-sm bg-white border-slate-200 shadow-sm w-48 focus:border-emerald-500 focus:ring-emerald-500"
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => setShowSaleNote(false)}
                                                                            className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center hover:bg-emerald-100 transition-colors border border-emerald-100"
                                                                            title="Quitar Nota"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-3">
                                                                <label htmlFor={`factura-upload-sale-${item.id}`} className="cursor-pointer text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2">
                                                                    {saleFacturaFile ? (
                                                                        <span className="text-emerald-700 truncate max-w-[150px]">{saleFacturaFile.name}</span>
                                                                    ) : (
                                                                        <>
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                                            Adjuntar Factura
                                                                        </>
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
                                                                        className="text-red-500 hover:bg-red-50 p-1 rounded transition-colors"
                                                                    >
                                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        <Button
                                                            type="submit"
                                                            disabled={isSubmitting || facturaUploading}
                                                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 shadow-md"
                                                        >
                                                            {isSubmitting ? 'Procesando...' : 'Confirmar Venta'}
                                                        </Button>
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
