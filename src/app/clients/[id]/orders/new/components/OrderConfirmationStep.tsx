'use client';

import { Button } from '@/components/ui/Button';
import { OrderItem, Farm, Lot, Product, ProductType } from '@/types';

interface OrderConfirmationStepProps {
    date: string;
    isDateRange: boolean;
    applicationDate: string;
    appStart: string;
    appEnd: string;
    selectedFarm?: Farm;
    selectedLot?: { name: string; hectares: number };
    items: OrderItem[];
    containsSeeds: boolean;
    availableProducts: Product[];
    stockShortages: (OrderItem & { available: number; missing: number })[];
    contractors: { id: string; username: string }[];
    selectedApplicatorId: string;
    servicePrice: string;
    selectedPartnerName: string;
    campaignName?: string;
    notes: string;
    onBack: () => void;
    onSubmit: () => void;
}

export function OrderConfirmationStep({
    date,
    isDateRange,
    applicationDate,
    appStart,
    appEnd,
    selectedFarm,
    selectedLot,
    items,
    containsSeeds,
    availableProducts,
    stockShortages,
    contractors,
    selectedApplicatorId,
    servicePrice,
    selectedPartnerName,
    campaignName,
    notes,
    onBack,
    onSubmit
}: OrderConfirmationStepProps) {
    const isSowingInvalid = containsSeeds && isDateRange;

    return (
        <div className="space-y-6 animate-fadeIn">
            {isSowingInvalid && (
                <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <h3 className="text-amber-800 font-bold flex items-center gap-2">
                        ⚠️ Error: Fecha de Siembra
                    </h3>
                    <p className="text-sm text-amber-700">
                        Las órdenes de siembra no permiten una "Ventana de aplicación". Por favor, vuelva al **Paso 1** y seleccione una fecha única.
                    </p>
                </div>
            )}

            {stockShortages.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                    <h3 className="text-red-800 font-bold flex items-center gap-2">
                        ⚠️ Alerta: Stock Insuficiente
                    </h3>
                    <p className="text-sm text-red-600 mb-3">El cliente no tiene saldo suficiente para esta orden.</p>
                    <ul className="space-y-1">
                        {stockShortages.map(s => (
                            <li key={s.id} className="text-sm text-red-700 list-disc list-inside">
                                <b>{s.productName}</b>: Necesita {s.totalQuantity} {s.unit}, Tiene {s.available}. (Faltante: {s.missing.toFixed(2)} {s.unit})
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="bg-white p-6 border border-slate-200 rounded-xl shadow-sm space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">Resumen de la Orden de Carga</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-slate-500">Campo/Lote:</span> <span className="font-medium">{selectedFarm?.name} - {selectedLot?.name}</span></div>
                    <div><span className="text-slate-500">Superficie:</span> <span className="font-medium">{selectedLot?.hectares} ha</span></div>
                    <div><span className="text-slate-500">Fecha de emisión:</span> <span className="font-medium">{date}</span></div>
                    <div><span className="text-slate-500">Ventana de aplicación:</span> <span className="font-medium">{appStart} • {appEnd}</span></div>
                    {campaignName && (
                        <div><span className="text-slate-500">Campaña:</span> <span className="font-bold text-emerald-600">{campaignName}</span></div>
                    )}
                    {selectedPartnerName && (
                        <div><span className="text-slate-500">Pagado por:</span> <span className="font-medium">{selectedPartnerName}</span></div>
                    )}

                    {containsSeeds && (() => {
                        const seedItem = items.find(i => availableProducts.find(p => p.id === i.productId)?.type === 'SEED');
                        return seedItem && (
                            <div className="col-span-2 grid grid-cols-2 gap-4 py-2 border-t border-b border-slate-100 mt-2">
                                <div>
                                    <span className="text-slate-500 block text-xs uppercase font-bold tracking-tight">Densidad</span>
                                    <span className="font-medium">
                                        {seedItem.plantingDensity || '-'} {seedItem.plantingDensityUnit === 'PLANTS_HA' ? 'plant/ha' : 'kg/ha'}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs uppercase font-bold tracking-tight">Espaciamiento entre hileras</span>
                                    <span className="font-medium">{seedItem.plantingSpacing ? `${seedItem.plantingSpacing} cm` : '-'}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500 block text-xs uppercase font-bold tracking-tight">Rinde Esperado</span>
                                    <span className="font-medium">{seedItem.expectedYield ? `${seedItem.expectedYield} kg/ha` : '-'}</span>
                                </div>
                            </div>
                        );
                    })()}

                    <div><span className="text-slate-500">Aplicador:</span> <span className="font-medium">{contractors.find(c => c.id === selectedApplicatorId)?.username || 'No asignado'}</span></div>
                    {servicePrice && (
                        <div><span className="text-slate-500">Precio Servicio:</span> <span className="font-medium">USD {servicePrice} / ha</span></div>
                    )}
                    {selectedPartnerName && (
                        <div><span className="text-slate-500">Pagado por:</span> <span className="font-medium">{selectedPartnerName}</span></div>
                    )}
                    {notes && (
                        <div className="col-span-2"><span className="text-slate-500 block">Nota:</span> <p className="text-slate-800 text-sm italic">"{notes}"</p></div>
                    )}
                </div>

                <div className="space-y-4">
                    {Array.from(new Set(items.map(i => i.groupId || i.id))).map(groupId => {
                        const groupItems = items.filter(i => (i.groupId || i.id) === groupId);
                        const first = groupItems[0];
                        const totalInGroup = groupItems.reduce((acc, i) => acc + i.totalQuantity, 0);

                        return (
                            <div key={groupId} className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="font-bold uppercase tracking-tight text-slate-800">
                                        {first.productType === 'SEED'
                                            ? `${first.productName}${first.brandName ? ` (${first.brandName})` : ''}`
                                            : `${first.commercialName || first.productName}${first.activeIngredient ? ` (${first.activeIngredient})` : ''}`}
                                    </span>
                                    <span className="font-mono font-bold text-emerald-600">{totalInGroup.toFixed(2)} {first.unit}</span>
                                </div>
                                <div className="space-y-1 pl-4">
                                    {groupItems.map(item => (
                                        <div key={item.id} className={`flex justify-between items-center text-xs italic ${item.isVirtualDéficit ? 'text-orange-500 border-l-2 border-orange-200 pl-2' : 'text-slate-500'}`}>
                                            <span>
                                                {item.multiplier ? `${item.multiplier} x ` : ''}
                                                {item.isVirtualDéficit
                                                    ? 'Faltan'
                                                    : (item.presentationLabel || (item.productId === 'LABOREO_MECANICO' ? 'Labor' : `A granel (${item.unit})`))}
                                                {!item.isVirtualDéficit && item.presentationContent ? ` (${item.presentationContent}${item.unit})` : ''}
                                                {item.warehouseName && <span className="ml-1 opacity-70">— {item.warehouseName}</span>}
                                            </span>
                                            <span className="font-mono font-bold">{item.totalQuantity.toFixed(2)} {item.unit}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-between pt-4">
                <Button variant="secondary" onClick={onBack}>Volver</Button>
                <Button
                    onClick={onSubmit}
                    variant={stockShortages.length > 0 ? 'danger' : 'primary'}
                    disabled={isSowingInvalid}
                >
                    {stockShortages.length > 0
                        ? 'Confirmar de todas formas (Saldo Negativo)'
                        : (containsSeeds ? 'Confirmar Orden de Siembra' : 'Confirmar Orden de Carga')}
                </Button>
            </div>
        </div>
    );
}
