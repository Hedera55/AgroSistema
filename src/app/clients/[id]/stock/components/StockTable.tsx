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
    products,
    clearSelection
}: StockTableProps) {
    const [expandedRows, setExpandedRows] = React.useState<string[]>([]);


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
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
