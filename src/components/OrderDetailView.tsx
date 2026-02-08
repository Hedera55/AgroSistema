'use client';

import React from 'react';
import { Order } from '@/types';

interface OrderDetailViewProps {
    order: Order & { farmName?: string; lotName?: string; hectares?: number };
    onClose: () => void;
    createdBy?: string;
    warehouses?: any[];
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ order, onClose, createdBy, warehouses = [] }) => {
    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full overflow-hidden animate-slideUp flex flex-col border-t-4 border-t-emerald-500 max-h-[800px]">
            {/* Header */}
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded ${order.type === 'SOWING' ? 'bg-emerald-100 text-emerald-700' :
                            order.type === 'HARVEST' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {order.type === 'SOWING' ? 'Siembra' : order.type === 'HARVEST' ? 'Cosecha' : 'Pulverización'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-lg">Orden #{order.orderNumber || '---'}</h3>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">{order.date} {order.time ? `@ ${order.time}` : ''}</p>
                </div>
                <button onClick={onClose} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors" title="Cerrar detalles">✕</button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {/* Location Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Establecimiento</label>
                        <p className="text-slate-800 font-bold">{order.farmName || '---'}</p>
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lote / Superficie</label>
                        <p className="text-slate-800 font-bold">{order.lotName || '---'} ({order.hectares || 0} ha)</p>
                    </div>
                </div>

                {/* Technical Specs */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4 border-b border-slate-200 pb-2">Especificaciones Técnicas</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {order.type === 'SOWING' && (
                            <>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Densidad</label>
                                    <p className="text-sm font-bold text-slate-700">{order.plantingDensity || '---'} {order.plantingDensityUnit === 'KG_HA' ? 'kg/ha' : 'pl/ha'}</p>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Espaciamiento</label>
                                    <p className="text-sm font-bold text-slate-700">{order.plantingSpacing || '---'} cm</p>
                                </div>
                            </>
                        )}
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Contratista</label>
                            <p className="text-sm font-bold text-slate-700">{order.contractorName || order.applicatorName || '---'}</p>
                        </div>
                        {order.type === 'HARVEST' && order.expectedYield && (
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase">Rinde Esperado</label>
                                <p className="text-sm font-bold text-slate-700">{order.expectedYield.toLocaleString()} kg</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Items List */}
                {order.items && order.items.length > 0 && (
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Insumos Planeados / Utilizados</h4>
                        <div className="space-y-2">
                            {order.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-orange-50/50 border-l-4 border-orange-400 rounded-r-md shadow-sm">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-bold text-slate-800 text-sm">
                                            {item.loadingOrder && <span className="text-emerald-600 mr-2">#{item.loadingOrder}</span>}
                                            {item.productName} {item.commercialName ? `| ${item.commercialName}` : ''}
                                        </div>
                                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-x-4 uppercase font-medium">
                                            <span>Dosis: {item.dosage} {item.unit}/ha</span>
                                            {item.plantingDensity && (
                                                <span className="text-blue-600">Densidad: {item.plantingDensity} {item.plantingDensityUnit === 'KG_HA' ? 'kg/ha' : 'pl/ha'}</span>
                                            )}
                                            {item.expectedYield && (
                                                <span className="text-blue-600">Rinde Esperado: {item.expectedYield.toLocaleString()} kg/ha</span>
                                            )}
                                            {item.warehouseId && (
                                                <span className="text-slate-500 font-bold">Galpón: {warehouses.find(w => w.id === item.warehouseId)?.name || '---'}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right ml-4">
                                        <div className="font-mono text-emerald-600 font-bold text-xs whitespace-nowrap">{item.totalQuantity.toLocaleString()} {item.unit}</div>
                                        <div className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Total</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Notes and Invoice */}
                {(order.notes || order.facturaImageUrl) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
                        {order.notes && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Observaciones</label>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-sm text-slate-600 italic">
                                    "{order.notes}"
                                </div>
                            </div>
                        )}
                        {order.facturaImageUrl && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Factura</label>
                                <div className="relative group cursor-zoom-in rounded-xl overflow-hidden border border-slate-200 shadow-sm aspect-video bg-slate-100">
                                    <img
                                        src={order.facturaImageUrl}
                                        alt="Factura"
                                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                                        onClick={() => window.open(order.facturaImageUrl, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/10 transition-colors flex items-center justify-center">
                                        <span className="bg-white/90 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">Ver en tamaño completo</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Financial/Footer */}
                <div className="pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Costo de Labor</label>
                        <p className="text-lg font-black text-emerald-600">
                            USD {(order.servicePrice || 0).toLocaleString()} <span className="text-xs font-bold text-slate-400">/ ha</span>
                            <span className="ml-2 text-slate-900">(USD {((order.servicePrice || 0) * (order.treatedArea || order.hectares || 0)).toLocaleString()} Total)</span>
                        </p>
                    </div>
                    {order.investorName && (
                        <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100">
                            <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block">Pagado por</label>
                            <p className="text-emerald-900 font-bold">{order.investorName}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Footer */}
            <div className="bg-slate-50 px-8 py-4 border-t border-slate-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${order.status === 'DONE' ? 'bg-emerald-500' : 'bg-yellow-500'}`}></div>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                        {order.status === 'DONE' ? 'Aplicada' : order.status === 'PENDING' ? 'Pendiente' : order.status}
                    </span>
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                    Creado por {createdBy || order.createdBy || 'Sistema'}
                </div>
            </div>
        </div>
    );
};
