import React from 'react';
import { InventoryMovement, Order, Client, Warehouse } from '@/types';

interface MovementDetailsViewProps {
    movement: InventoryMovement;
    client: Client;
    order?: Order & { farmName?: string; lotName?: string };
    originName?: string;
    destName?: string;
    onClose: () => void;
    typeLabel: string;
}

export function MovementDetailsView({ movement, client, order, originName, destName, onClose, typeLabel, campaigns }: MovementDetailsViewProps) {
    const logistics = movement as any;
    const hasLogistics =
        logistics.truckDriver ||
        logistics.plateNumber ||
        logistics.trailerPlate ||
        logistics.destinationCompany ||
        logistics.destinationAddress ||
        logistics.deliveryLocation ||
        logistics.transportCompany ||
        logistics.dischargeNumber ||
        logistics.humidity !== undefined ||
        logistics.hectoliterWeight !== undefined ||
        logistics.grossWeight !== undefined ||
        logistics.tareWeight !== undefined ||
        logistics.primarySaleCuit ||
        logistics.departureDateTime ||
        logistics.distanceKm !== undefined ||
        logistics.freightTariff !== undefined;

    const getBadgeColors = () => {
        if (typeLabel.includes('COMPRA')) return 'bg-orange-100 text-orange-700 border-orange-200';
        if (typeLabel.includes('VENTA')) return 'bg-lime-100 text-lime-700 border-lime-200';
        if (typeLabel.includes('TRANSFERENCIA')) return 'bg-indigo-100 text-indigo-700 border-indigo-200';
        if (typeLabel.includes('RETIRO') || typeLabel.includes('EGRESO') || typeLabel.includes('COSECHA')) return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-slate-100 text-slate-700 border-slate-200';
    };

    const getBorderColor = () => {
        if (typeLabel.includes('COMPRA')) return 'border-t-orange-500';
        if (typeLabel.includes('VENTA')) return 'border-t-lime-500';
        if (typeLabel.includes('TRANSFERENCIA')) return 'border-t-indigo-500';
        return 'border-t-blue-500';
    };

    return (
        <div className={`bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp border-t-4 ${getBorderColor()}`}>
            {/* Header */}
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                <div className="flex flex-col">
                    <h3 className="font-black text-slate-900 text-xl tracking-tight">
                        Detalles de {typeLabel.replace('I-', '').replace('E-', '').toLowerCase()}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                    title="Cerrar Detalles"
                >
                    ✕
                </button>
            </div>

            <div className="p-8">
                <div className="space-y-8">
                    {/* Section 1: General Info */}
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Información General</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
                            <div>
                                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Fecha / Hora</span>
                                <span className="text-sm font-bold text-slate-700">{movement.createdAt ? new Date(movement.createdAt).toLocaleString() : (movement.date || '-')}</span>
                            </div>
                            {(movement as any).isTransfer ? (
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Trayecto</span>
                                    <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        {originName || '...'} <span className="text-slate-300">→</span> {destName || '...'}
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">
                                        {movement.type === 'IN' ? 'Galpón de destino' : 'Galpón'}
                                    </span>
                                    <span className="text-sm font-bold text-slate-700">{destName || originName || 'Galpón'}</span>
                                </div>
                            )}

                            {movement.campaignId && campaigns && (
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Campaña</span>
                                    <span className="text-sm font-bold text-emerald-600">
                                        {campaigns.find(c => c.id === movement.campaignId)?.name || 'Campaña Desconocida'}
                                    </span>
                                </div>
                            )}

                            {movement.sellerName && (
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Vendedor</span>
                                    <span className="text-sm font-bold text-blue-600">{movement.sellerName}</span>
                                </div>
                            )}

                            {movement.investors && movement.investors.length > 0 && (
                                <div className="sm:col-span-2 lg:col-span-3">
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Pagado Por</span>
                                    <div className="flex flex-wrap gap-2">
                                        {movement.investors.map(inv => (
                                            <span key={inv.name} className="px-3 py-1 bg-indigo-50 text-indigo-700 text-[10px] font-black rounded-lg border border-indigo-100 uppercase">
                                                {inv.name} ({inv.percentage}%)
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {movement.receiverName && (
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Retirado Por</span>
                                    <span className="px-3 py-1 bg-orange-50 text-orange-700 text-[10px] font-black rounded-lg border border-orange-100 uppercase">
                                        {movement.receiverName}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    
                    {/* Section: Product List (Detalles de compra/venta) */}
                    {(movement.items && movement.items.length > 0) && (
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                {typeLabel.includes('COMPRA') ? 'Insumos Comprados' : 
                                 typeLabel.includes('VENTA') ? 'Productos Vendidos' : 'Detalle de Items'}
                            </h3>
                            <div className="bg-slate-50/50 rounded-2xl border border-slate-100 overflow-hidden">
                                <table className="min-w-full divide-y divide-slate-200">
                                    <thead className="bg-slate-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Insumo / Marca</th>
                                            <th className="px-6 py-3 text-left text-[10px] font-bold text-slate-400 uppercase">Presentación</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Cantidad</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Precio Unit.</th>
                                            <th className="px-6 py-3 text-right text-[10px] font-bold text-slate-400 uppercase">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {movement.items.map((it, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="text-sm font-bold text-slate-800">{it.productName}</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{it.productBrand || '-'}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {it.presentationLabel && it.presentationContent ? (
                                                        <span className="text-xs font-medium text-slate-600">
                                                            {it.presentationLabel} {it.presentationContent}{it.unit || movement.unit} x {it.presentationAmount}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400 italic">Sin detalle</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-bold text-slate-700">
                                                    {Math.abs(it.quantity)} {it.unit || movement.unit}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-mono text-slate-500">
                                                    USD {it.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-6 py-4 text-right text-sm font-mono font-bold text-slate-900">
                                                    USD {(it.quantity * (it.price || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Section 2: Logistics Info */}
                    {movement.type !== 'IN' && (
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Datos Logísticos</h3>
                            {hasLogistics ? (
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8">
                                    {[
                                        { label: 'Chofer', value: logistics.truckDriver },
                                        { label: 'Patente Camión', value: logistics.plateNumber },
                                        { label: 'Patente Acoplado', value: logistics.trailerPlate },
                                        { label: 'Empresa Transp.', value: logistics.transportCompany },
                                        { label: 'Empresa Destino', value: logistics.destinationCompany || logistics.deliveryLocation },
                                        { label: 'Dirección Destino', value: logistics.destinationAddress },
                                        { label: 'CUIT Venta Primaria', value: logistics.primarySaleCuit },
                                        { label: 'Fecha Partida', value: logistics.departureDateTime ? new Date(logistics.departureDateTime).toLocaleString() : null },
                                        { label: 'Distancia (Km)', value: logistics.distanceKm !== undefined ? `${logistics.distanceKm} Km` : null },
                                        { label: 'Tarifa Flete', value: (logistics.freightTariff !== undefined && logistics.freightTariff !== null) ? `USD ${logistics.freightTariff.toLocaleString()}` : null },
                                        { label: 'Nº Descarga', value: logistics.dischargeNumber },
                                        { label: 'Humedad', value: logistics.humidity !== undefined ? `${logistics.humidity} %` : null },
                                        { label: 'P. Hectolítrico', value: logistics.hectoliterWeight !== undefined ? logistics.hectoliterWeight : null },
                                        { label: 'Peso Bruto', value: logistics.grossWeight !== undefined ? `${logistics.grossWeight.toLocaleString()} Kg` : null },
                                        { label: 'Peso Tara', value: logistics.tareWeight !== undefined ? `${logistics.tareWeight.toLocaleString()} Kg` : null },
                                    ].filter(row => row.value).map((row, idx) => (
                                        <div key={idx}>
                                            <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">{row.label}</span>
                                            <span className="text-sm font-bold text-slate-700">{row.value}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-slate-400 text-sm font-bold italic py-2">
                                    No se registraron datos logísticos para este movimiento.
                                </div>
                            )}
                        </div>
                    )}

                    {/* Section 3: Notes */}
                    {movement.notes && (
                        <div>
                            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Notas</h3>
                            <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100 text-sm text-slate-700 font-medium leading-relaxed italic">
                                "{movement.notes}"
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
