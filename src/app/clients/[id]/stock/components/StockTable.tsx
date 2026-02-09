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
}

interface StockTableProps {
    activeWarehouseId: string | null;
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
    products: Product[];
}

export function StockTable({
    activeWarehouseId,
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
    products
}: StockTableProps) {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">
                    Existencias - {warehouses.find(w => w.id === activeWarehouseId)?.name || 'seleccione un galpón'}
                </h3>
            </div>
            {!activeWarehouseId ? (
                <div className="p-12 text-center text-slate-500">
                    <h3 className="text-lg font-medium text-slate-900">Seleccione un galpón</h3>
                    <p>elija un galpón para ver su inventario</p>
                </div>
            ) : stockLoading || productsLoading ? (
                <div className="p-8 text-center text-slate-500">Cargando stock...</div>
            ) : enrichedStock.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                    <h3 className="text-lg font-medium text-slate-900">Galpón vacío</h3>
                    <p>No hay productos cargados todavía.</p>
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
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">P.A. / Cultivo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre Comercial</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Marca</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Precio PPP</th>
                                {warehouses.find(w => w.id === activeWarehouseId)?.name !== 'Acopio de Granos' && (
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Valor Total (USD)</th>
                                )}
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Actual</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {enrichedStock.map((item) => (
                                <React.Fragment key={item.id}>
                                    <tr
                                        onClick={(e) => toggleStockSelection(item.id, e)}
                                        className={`transition-colors cursor-pointer group ${selectedStockIds.includes(item.id) ? 'bg-blue-50/80' : 'hover:bg-slate-50'}`}
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-900">
                                            {products.find(p => p.id === item.productId)?.activeIngredient || item.productName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                                            {item.productCommercialName || '-'}
                                        </td>
                                        <td
                                            className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 hover:bg-slate-100 transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditBrand(item.id, item.productBrand || '');
                                            }}
                                        >
                                            {item.productBrand || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                            {typeLabels[item.productType] || item.productType}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-medium text-slate-400">
                                            USD {(item.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </td>
                                        {warehouses.find(w => w.id === activeWarehouseId)?.name !== 'Acopio de Granos' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-500">
                                                USD {(item.quantity * (item.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold text-emerald-600">
                                            {item.quantity} <span className="text-slate-400 text-xs ml-1 font-normal group-hover:text-emerald-300 transition-colors uppercase tracking-tight">{item.unit}</span>
                                        </td>
                                    </tr>
                                    {sellingStockId === item.id && (
                                        <tr className="bg-emerald-50/50 animate-fadeIn">
                                            <td colSpan={7} className="px-6 py-4">
                                                <form onSubmit={handleSaleSubmit} className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-emerald-200 shadow-sm" onClick={e => e.stopPropagation()}>
                                                    <div className="flex flex-wrap items-end gap-4">
                                                        <div className="flex-1 min-w-[120px]">
                                                            <Input
                                                                label="Cantidad a Vender"
                                                                type="text"
                                                                inputMode="decimal"
                                                                value={saleQuantity}
                                                                onChange={e => setSaleQuantity(e.target.value)}
                                                                required
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-[120px]">
                                                            <Input
                                                                label={`Precio de Venta (USD/${item.unit})`}
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

                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
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
                                                            label="Destino / Entrega"
                                                            value={saleDestination}
                                                            onChange={e => setSaleDestination(e.target.value)}
                                                            placeholder="Localidad / Acopio"
                                                            className="bg-white h-9"
                                                        />
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
