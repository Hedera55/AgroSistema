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

export function MovementDetailsView({ movement, client, order, originName, destName, onClose, typeLabel }: MovementDetailsViewProps) {
    const logistics = movement.logistics || (movement as any);
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

    return (
        <div className="bg-white p-6 relative">
            <div className="space-y-5">
                {/* Section 1: General Info */}
                <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Información General</h3>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8 px-2 py-4">
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
                                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Galpón</span>
                                <span className="text-sm font-bold text-slate-700">{destName || originName || 'Desconocido'}</span>
                            </div>
                        )}

                        {movement.sellerName && (
                            <div>
                                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Comercial / Vendedor</span>
                                <span className="text-sm font-bold text-blue-600">{movement.sellerName}</span>
                            </div>
                        )}

                        {movement.investors && movement.investors.length > 0 && (
                            <div className="sm:col-span-2 lg:col-span-3">
                                <span className="block text-[10px] uppercase text-slate-400 font-bold mb-2">Socios Involucrados</span>
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

                {/* Section 2: Logistics Info */}
                <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Datos Logísticos</h3>
                    {hasLogistics ? (
                        <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <tbody className="divide-y divide-slate-50">
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
                                        { label: 'Tarifa Flete', value: logistics.freightTariff !== undefined ? `USD ${logistics.freightTariff.toLocaleString()}` : null },
                                        { label: 'Nº Descarga', value: logistics.dischargeNumber },
                                        { label: 'Humedad', value: logistics.humidity !== undefined ? `${logistics.humidity} %` : null },
                                        { label: 'P. Hectolítrico', value: logistics.hectoliterWeight !== undefined ? logistics.hectoliterWeight : null },
                                        { label: 'Peso Bruto', value: logistics.grossWeight !== undefined ? `${logistics.grossWeight.toLocaleString()} Kg` : null },
                                        { label: 'Peso Tara', value: logistics.tareWeight !== undefined ? `${logistics.tareWeight.toLocaleString()} Kg` : null },
                                    ].filter(row => row.value).map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/3">{row.label}</td>
                                            <td className="py-3 px-6 text-slate-800 font-bold">{row.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="bg-slate-50 border border-slate-100 border-dashed rounded-2xl p-8 flex items-center justify-center text-center">
                            <span className="text-slate-400 text-sm font-bold">No se registraron datos logísticos para este movimiento.</span>
                        </div>
                    )}
                </div>

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

            <div className="mt-4 flex justify-end">
            </div>
        </div>
    );
}
