'use client';

import { Observation, Order, InventoryMovement, Product, ClientStock } from '@/types';
import { ObservationsSection } from '@/components/ObservationsSection';
import { LotHistory } from '@/components/LotHistory';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface SidePanelsProps {
    clientId: string;
    activePanel: {
        type: 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details';
        id: string;
        farmId: string;
        lotId?: string;
        name: string;
        subtitle?: string;
    } | null;
    onClose: () => void;
    obsSectionRef: React.RefObject<HTMLDivElement>;
    // Data props
    products: Product[];
    client: any;
    isReadOnly: boolean;
    // Sowing details
    sowingOrder: Order | null;
    // Harvest details
    harvestMovement: InventoryMovement | null;
    isEditingHarvestPanel: boolean;
    setIsEditingHarvestPanel: (val: boolean) => void;
    selectedHarvestInvestor: string;
    setSelectedHarvestInvestor: (val: string) => void;
    // Actions
    handleUpdateLot: (data: any) => Promise<void>;
    handleUpdateHarvest: (originalHarvest: InventoryMovement, newDate: string, newYield: number, newPrice: number, newContractor: string, newInvestor?: string) => Promise<void>;
}

export function SidePanels({
    clientId,
    activePanel,
    onClose,
    obsSectionRef,
    products,
    client,
    isReadOnly,
    sowingOrder,
    harvestMovement,
    isEditingHarvestPanel,
    setIsEditingHarvestPanel,
    selectedHarvestInvestor,
    setSelectedHarvestInvestor,
    handleUpdateLot,
    handleUpdateHarvest
}: SidePanelsProps) {
    if (!activePanel) return null;

    return (
        <div ref={obsSectionRef} className="pt-8 border-t border-slate-200 animate-fadeIn bg-slate-50/50 -mx-4 px-4 pb-8 rounded-b-2xl">
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                {/* Panel Header */}
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                    <div>
                        <h3 className="font-bold tracking-tight">
                            {activePanel.type === 'observations' && 'Observaciones'}
                            {activePanel.type === 'crop_assign' && 'Asignar Cultivo'}
                            {activePanel.type === 'history' && 'Historial de Lote'}
                            {activePanel.type === 'sowing_details' && 'Detalles de Siembra'}
                            {activePanel.type === 'harvest_details' && 'Detalles de Cosecha'}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium">
                            {activePanel.name} {activePanel.subtitle && `• ${activePanel.subtitle}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-800 hover:bg-slate-700 transition-colors text-white"
                        title="Cerrar Panel"
                    >
                        ✕
                    </button>
                </div>

                {/* Panel Content */}
                <div>
                    {activePanel.type === 'observations' && (
                        <div className="p-4">
                            <ObservationsSection
                                clientId={clientId}
                                farmId={activePanel.farmId}
                                lotId={activePanel.lotId}
                            />
                        </div>
                    )}

                    {activePanel.type === 'crop_assign' && (
                        <div className="p-6 bg-white animate-fadeIn">
                            {(() => {
                                const lotId = activePanel.lotId;
                                // We need the lot object here, but we'll try to get it from state if possible or passed as prop
                                // For now, we'll assume we might need a separate component for this if it gets too complex
                                return (
                                    <form
                                        onSubmit={async (e) => {
                                            e.preventDefault();
                                            const fd = new FormData(e.currentTarget);
                                            const species = fd.get('species') as string;
                                            const yieldVal = fd.get('yield') as string;
                                            if (!species) return alert('Seleccione una especie');

                                            // Call the parent update function
                                            await handleUpdateLot({
                                                id: lotId,
                                                cropSpecies: species,
                                                yield: parseFloat(yieldVal) || 0,
                                                status: 'SOWED'
                                            });
                                            onClose();
                                        }}
                                        className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
                                    >
                                        <div className="md:col-span-1">
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Especie de Cultivo</label>
                                            <select
                                                name="species"
                                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                                required
                                            >
                                                <option value="">Seleccione...</option>
                                                <option value="Soja">Soja</option>
                                                <option value="Maíz">Maíz</option>
                                                <option value="Trigo">Trigo</option>
                                                <option value="Girasol">Girasol</option>
                                                <option value="Sorgo">Sorgo</option>
                                                <option value="Cebada">Cebada</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <Input
                                                name="yield"
                                                label="Rinde Esperado (kg/ha)"
                                                type="number"
                                                placeholder="0"
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <Button type="submit" className="w-full">Guardar Asignación</Button>
                                        </div>
                                    </form>
                                );
                            })()}
                        </div>
                    )}

                    {activePanel.type === 'history' && (
                        <div className="p-6 bg-white max-h-[600px] overflow-y-auto">
                            <LotHistory clientId={clientId} lotId={activePanel.id} />
                        </div>
                    )}

                    {activePanel.type === 'sowing_details' && (
                        <div className="p-6 bg-white animate-fadeIn">
                            {sowingOrder ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Fecha de Siembra</div>
                                            <div className="font-mono text-slate-800">{new Date(sowingOrder.date).toLocaleDateString()}</div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="font-bold text-slate-800 text-xs uppercase tracking-widest pl-2 border-l-4 border-emerald-500">
                                                RINDE TOTAL (kg)
                                            </div>
                                        </div>
                                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className="text-xs text-slate-500 uppercase font-bold mb-1">Estado</div>
                                            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                                                {sowingOrder.status === 'DONE' ? 'REALIZADA' : 'CONFIRMADA'}
                                            </span>
                                        </div>
                                        {sowingOrder.applicatorId && (
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Responsable</div>
                                                <div className="text-sm text-slate-800 truncate">Contratista</div>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wide">Insumos de Siembra</h3>
                                        <div className="space-y-2">
                                            {sowingOrder.items.filter(i => {
                                                const prod = products.find(p => p.id === i.productId);
                                                return prod?.type === 'SEED';
                                            }).map(item => (
                                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-emerald-50/50 rounded-lg border border-emerald-100">
                                                    <div>
                                                        <div className="font-bold text-emerald-900">{item.productName}</div>
                                                        <div className="text-xs text-emerald-600">Semilla</div>
                                                    </div>
                                                    <div className="flex gap-4 mt-2 sm:mt-0">
                                                        <div className="text-right">
                                                            <div className="text-xs text-emerald-600 font-bold uppercase">Densidad</div>
                                                            <div className="font-mono text-emerald-800">
                                                                {item.plantingDensity ? `${item.plantingDensity} ${item.plantingDensityUnit === 'PLANTS_HA' ? 'pl/ha' : 'kg/ha'}` : '-'}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <div className="text-xs text-emerald-600 font-bold uppercase">Espaciamiento</div>
                                                            <div className="font-mono text-emerald-800">
                                                                {item.plantingSpacing ? `${item.plantingSpacing} cm` : '-'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {sowingOrder.items.filter(i => {
                                                const prod = products.find(p => p.id === i.productId);
                                                return prod?.type !== 'SEED';
                                            }).length > 0 && (
                                                    <div className="mt-4 pt-4 border-t border-slate-100">
                                                        <div className="text-xs text-slate-400 font-bold uppercase mb-2">Otros Insumos Aplicados</div>
                                                        {sowingOrder.items.filter(i => {
                                                            const prod = products.find(p => p.id === i.productId);
                                                            return prod?.type !== 'SEED';
                                                        }).map(item => (
                                                            <div key={item.id} className="flex justify-between items-center text-sm py-1">
                                                                <span className="text-slate-600">{item.productName}</span>
                                                                <span className="font-mono text-slate-500">{item.dosage} {item.unit}/ha</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <p>No se encontró la orden de siembra asociada.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {activePanel.type === 'harvest_details' && (
                        <div className="p-6 bg-white animate-fadeIn">
                            {harvestMovement ? (
                                !isEditingHarvestPanel ? (
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Fecha de Cosecha</div>
                                                <div className="font-mono text-slate-800">{new Date(harvestMovement.date).toLocaleDateString()}</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Rinde Total</div>
                                                <div className="font-mono text-slate-800 font-bold">{harvestMovement.quantity.toLocaleString()} {harvestMovement.unit}</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Contratista</div>
                                                <div className="text-sm text-slate-800 truncate">{harvestMovement.contractorName || '-'}</div>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Costo Labor Total</div>
                                                <div className="font-mono text-slate-800">
                                                    {harvestMovement.harvestLaborCost
                                                        ? `USD ${harvestMovement.harvestLaborCost.toLocaleString()}`
                                                        : '-'}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="text-xs text-slate-500 uppercase font-bold mb-1">Pagado por</div>
                                                <div className="text-sm text-slate-800 truncate">{harvestMovement.investorName || '-'}</div>
                                            </div>
                                        </div>

                                        {!isReadOnly && (
                                            <div className="flex justify-end pt-4 border-t border-slate-100">
                                                <Button size="sm" variant="secondary" onClick={() => setIsEditingHarvestPanel(true)}>
                                                    Editar Datos
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <form
                                        onSubmit={(e) => {
                                            e.preventDefault();
                                            const fd = new FormData(e.currentTarget);
                                            handleUpdateHarvest(
                                                harvestMovement!,
                                                fd.get('date') as string,
                                                parseFloat(fd.get('yield') as string),
                                                parseFloat(fd.get('price') as string),
                                                fd.get('contractor') as string,
                                                selectedHarvestInvestor
                                            );
                                        }}
                                        className="space-y-4"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <Input
                                                name="date"
                                                label="Fecha"
                                                type="date"
                                                defaultValue={harvestMovement.date}
                                                required
                                            />
                                            <Input
                                                name="contractor"
                                                label="Contratista"
                                                defaultValue={harvestMovement.contractorName || ''}
                                            />
                                            <Input
                                                name="yield"
                                                label="Rinde Total (kg)"
                                                type="number"
                                                defaultValue={harvestMovement.quantity}
                                                required
                                            />
                                            <Input
                                                name="price"
                                                label="Precio Labor (USD/ha)"
                                                type="number"
                                                defaultValue={harvestMovement.harvestLaborPricePerHa || 0}
                                            />
                                            <div className="w-full">
                                                <label className="block text-sm font-medium text-slate-700 mb-1">Pagado por:</label>
                                                <select
                                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-[42px]"
                                                    value={selectedHarvestInvestor}
                                                    onChange={e => setSelectedHarvestInvestor(e.target.value)}
                                                >
                                                    <option value="">Seleccione un socio...</option>
                                                    {client?.partners?.map((p: any) => (
                                                        <option key={p.name} value={p.name}>{p.name}</option>
                                                    ))}
                                                    {(!client?.partners || client.partners.length === 0) && client?.investors?.map((inv: any) => (
                                                        <option key={inv.name} value={inv.name}>{inv.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                                            <Button type="button" variant="ghost" onClick={() => setIsEditingHarvestPanel(false)}>Cancelar</Button>
                                            <Button type="submit">Guardar Cambios</Button>
                                        </div>
                                    </form>
                                )
                            ) : (
                                <div className="text-center py-8 text-slate-400">
                                    <p>No se encontró información de la cosecha.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
