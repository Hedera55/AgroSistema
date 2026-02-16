import React, { useState } from 'react';
import { Order, Client } from '@/types';
import { usePDF } from '@/hooks/usePDF';

interface OrderDetailViewProps {
    order: Order & { farmName?: string; lotName?: string; hectares?: number };
    client: Client;
    onClose: () => void;
    createdBy?: string;
    warehouses?: any[];
    lots?: any[];
    campaigns?: any[];
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({ order, client, onClose, createdBy, warehouses = [], lots = [], campaigns = [] }) => {
    const [showFullNote, setShowFullNote] = useState(false);
    const { generateOrderPDF, generateRemitoPDF, generateInsumosPDF } = usePDF();

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-AR');
    };

    const getAppDateDisplay = () => {
        if (order.status === 'DONE' && order.appliedAt) {
            return formatDate(order.appliedAt);
        }
        if (order.isDateRange) {
            return `${formatDate(order.applicationStart)} al ${formatDate(order.applicationEnd)}`;
        }
        return formatDate(order.applicationDate);
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 w-full overflow-hidden animate-slideUp flex flex-col border-t-4 border-t-emerald-500 max-h-[800px]">
            {/* Header */}
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-200 flex justify-between items-start">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded ${order.type === 'SOWING' ? 'bg-emerald-100 text-emerald-700' :
                            order.type === 'HARVEST' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                            }`}>
                            {order.type === 'SOWING' ? 'Siembra' : order.type === 'HARVEST' ? 'Cosecha' : 'Pulverización'}
                        </span>
                        <h3 className="font-bold text-slate-900 text-lg">Orden #{order.orderNumber || '---'}</h3>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Emisión</span>
                            <span className="text-xs text-slate-500 font-bold">{formatDate(order.date)}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aplicación</span>
                            <span className="text-xs text-slate-500 font-bold">{getAppDateDisplay()}</span>
                        </div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Carga dato</span>
                            <span className="text-xs text-slate-500 font-bold">{formatDate(order.createdAt)}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => generateInsumosPDF(order, client)}
                            className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center"
                            title="Necesidad de Insumos"
                        >
                            N
                        </button>
                        <button
                            onClick={() => generateRemitoPDF(order, client)}
                            className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center"
                            title="Remito"
                        >
                            R
                        </button>
                        <button
                            onClick={() => generateOrderPDF(order, client)}
                            className="w-7 h-7 bg-white border border-slate-200 text-slate-400 hover:text-emerald-600 hover:border-emerald-200 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center"
                            title="Orden de Carga"
                        >
                            O
                        </button>
                        {order.facturaImageUrl && (
                            <button
                                onClick={() => window.open(order.facturaImageUrl, '_blank')}
                                className="w-7 h-7 bg-white border border-emerald-500 text-emerald-600 hover:bg-emerald-50 rounded-md text-[10px] font-black transition-all shadow-sm flex items-center justify-center"
                                title="Ver Factura"
                            >
                                F
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors" title="Cerrar detalles">✕</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
                {/* 1. Insumos (Top) */}
                {order.items && order.items.length > 0 && (
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest px-1">Resumen de Insumos</h4>
                        <div className="space-y-3">
                            {Array.from(new Set(order.items.map(i => i.groupId || i.id))).map(groupId => {
                                const groupItems = order.items.filter(i => (i.groupId || i.id) === groupId);
                                const first = groupItems[0];
                                const isLabor = first.productId === 'LABOREO_MECANICO';
                                const totalInGroup = groupItems.reduce((acc, i) => acc + i.totalQuantity, 0);

                                return (
                                    <div key={groupId} className="px-4 py-2 space-y-2 border-l-2 border-slate-100 ml-1">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-3">
                                                {first.loadingOrder && <span className="text-emerald-600 font-black text-xs">#{first.loadingOrder}</span>}
                                                <span className="font-medium text-slate-800 text-xs uppercase tracking-tight">
                                                    {first.productType === 'SEED'
                                                        ? `${first.productName}${first.brandName ? ` (${first.brandName})` : ''}`
                                                        : `${first.commercialName || first.productName}${first.activeIngredient ? ` (${first.activeIngredient})` : ''}`}
                                                </span>
                                                {!isLabor && <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{totalInGroup.toLocaleString()} {first.unit} TOTAL</span>}
                                            </div>
                                        </div>
                                        <div className="space-y-2 pl-2">
                                            {groupItems.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-[11px]">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-600">
                                                            {item.multiplier ? `${item.multiplier} x ` : ''}
                                                            {item.presentationLabel || (isLabor ? 'Labor' : `A granel (${item.unit})`)}
                                                            {item.presentationContent ? ` (${item.presentationContent}${item.unit})` : ''}
                                                            {item.warehouseId && <span className="text-slate-400 font-medium ml-2">— {warehouses.find(w => w.id === item.warehouseId)?.name || '---'}</span>}
                                                        </span>
                                                        {item.plantingDensity && <span className="text-blue-500 font-bold uppercase text-[9px]">Densidad: {item.plantingDensity} {item.plantingDensityUnit === 'KG_HA' ? 'kg/ha' : 'pl/ha'}</span>}
                                                    </div>
                                                    <span className="font-mono text-emerald-600 font-black">{item.totalQuantity.toLocaleString()} {item.unit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 2. Specs (Middle) */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest px-1">Especificaciones Técnicas</h4>
                    <div className="px-5 py-2">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
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
                            {order.campaignId && (
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Campaña</label>
                                    <p className="text-sm font-bold text-emerald-700">{campaigns.find(c => c.id === order.campaignId)?.name || '---'}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Location (Bottom) */}
                <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest px-1">Locación</h4>
                    <div className="px-5 py-2">
                        <div className="grid grid-cols-12 gap-4 border-b border-slate-100 pb-2 mb-2">
                            <div className="col-span-4 text-[10px] font-bold text-slate-400 uppercase">Establecimiento</div>
                            <div className="col-span-5 text-[10px] font-bold text-slate-400 uppercase">Lotes</div>
                            <div className="col-span-3 text-[10px] font-bold text-slate-400 uppercase">Total</div>
                        </div>

                        {/* Grouping logic: even if order has one farmName, we group identified lots by farm if they differ */}
                        {(() => {
                            const resolvedLots = (order.lotIds || []).map(id => lots.find(l => l.id === id)).filter(Boolean);
                            const farmGroups = resolvedLots.reduce((acc: any, lot: any) => {
                                const fName = lot.farmName || order.farmName || 'Establecimiento desconocido';
                                if (!acc[fName]) acc[fName] = [];
                                acc[fName].push(lot);
                                return acc;
                            }, {});

                            const farmNames = Object.keys(farmGroups);
                            if (farmNames.length === 0 && order.farmName) {
                                // Fallback if no lot objects resolved but farmName exists
                                return (
                                    <div className="grid grid-cols-12 gap-4 py-1">
                                        <div className="col-span-4 text-sm font-bold text-slate-700">{order.farmName}</div>
                                        <div className="col-span-5 text-sm text-slate-400 italic">Sin lotes cargados</div>
                                        <div className="col-span-3 text-sm font-black text-slate-400 uppercase tracking-[0.2em] text-right">
                                            {order.treatedArea || order.hectares || 0} ha
                                        </div>
                                    </div>
                                );
                            }

                            return farmNames.map((fName, idx) => (
                                <div key={fName} className={`grid grid-cols-12 gap-4 ${idx > 0 ? 'mt-4 pt-4 border-t border-slate-50' : 'py-1'}`}>
                                    <div className="col-span-4 text-sm font-bold text-slate-800">{fName}</div>
                                    <div className="col-span-5 space-y-2">
                                        {farmGroups[fName].map((lot: any) => (
                                            <div key={lot.id} className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700">
                                                    {lot.name} <span className="text-slate-400 font-medium ml-1">({lot.hectares || 0} ha)</span>
                                                </span>
                                                {order.lotObservations?.[lot.id] && (
                                                    <span className="text-[10px] text-slate-400 italic leading-tight">{order.lotObservations[lot.id]}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="col-span-3 text-right">
                                        {/* Show total only for the first farm or if it's the primary one mentioned in the order headers */}
                                        {idx === 0 && (
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] whitespace-nowrap">
                                                {order.treatedArea || order.hectares || 0} ha
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                </div>

                {/* Notes Toggle */}
                {order.notes && (
                    <div className="pt-4">
                        <button
                            onClick={() => setShowFullNote(!showFullNote)}
                            className="text-emerald-600 text-[10px] font-black uppercase tracking-widest hover:text-emerald-700 transition-colors flex items-center gap-1.5"
                        >
                            {showFullNote ? 'Ocultar Nota' : 'Ver Nota'}
                            <svg className={`w-3 h-3 transition-transform ${showFullNote ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {showFullNote && (
                            <div className="mt-2 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-sm text-slate-700 animate-fadeIn leading-relaxed">
                                {order.notes}
                            </div>
                        )}
                    </div>
                )}

                {/* Financial/Footer */}
                <div className="pt-6 border-t border-slate-100 flex justify-between items-start gap-4">
                    <div className="flex flex-col">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Costo de Labor</label>
                        <p className="text-sm font-bold text-emerald-600">
                            USD {((order.servicePrice || 0) * (order.treatedArea || order.hectares || 0)).toLocaleString()} Total
                            <span className="ml-2 text-xs font-bold text-slate-900">(USD {(order.servicePrice || 0).toLocaleString()} / ha)</span>
                        </p>
                    </div>
                    {order.investorName && (
                        <div className="flex flex-col items-end text-right">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pagado por</label>
                            <p className="text-xs font-bold text-slate-800 uppercase tracking-tight">{order.investorName}</p>
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
                <div className="text-[10px] text-slate-400 font-medium tracking-tight">
                    Cargado por <span className="font-bold text-slate-500">{createdBy || order.createdBy || 'Sistema'}</span>
                </div>
            </div>
        </div>
    );
};
