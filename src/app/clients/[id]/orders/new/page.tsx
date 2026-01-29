'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFarms, useLots } from '@/hooks/useLocations';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { Order, OrderItem, Unit } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';

export default function NewOrderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const router = useRouter();
    const { profile, displayName } = useAuth();

    // Data Hooks
    const { farms } = useFarms(clientId);
    const { products } = useInventory();
    const { stock, refresh: refreshStock } = useClientStock(clientId);
    const { warehouses } = useWarehouses(clientId);
    const { addOrder } = useOrders(clientId);

    // Form State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedFarmId, setSelectedFarmId] = useState('');
    const [selectedLotId, setSelectedLotId] = useState('');
    const [selectedOrderWarehouseId, setSelectedOrderWarehouseId] = useState('');
    useEffect(() => {
        if (!selectedOrderWarehouseId && warehouses.length > 0) {
            setSelectedOrderWarehouseId(warehouses[0].id);
        }
    }, [warehouses, selectedOrderWarehouseId]);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [time, setTime] = useState(new Date().toTimeString().split(' ')[0].substring(0, 5));
    const [appStart, setAppStart] = useState(new Date().toISOString().split('T')[0]);
    const [appEnd, setAppEnd] = useState(new Date().toISOString().split('T')[0]);

    // Order Items
    const [items, setItems] = useState<OrderItem[]>([]);

    // Current Item Input
    const [currProdId, setCurrProdId] = useState('');
    const [currDosage, setCurrDosage] = useState('');

    // Contractors
    const [contractors, setContractors] = useState<{ id: string, username: string }[]>([]);
    const [selectedApplicatorId, setSelectedApplicatorId] = useState('');

    // Planting Fields
    const [plantingDensity, setPlantingDensity] = useState('');
    const [plantingDensityUnit, setPlantingDensityUnit] = useState<'PLANTS_HA' | 'KG_HA'>('PLANTS_HA');
    const [plantingSpacing, setPlantingSpacing] = useState('');

    // Derived Data
    const { lots } = useLots(selectedFarmId);
    const selectedLot = lots.find(l => l.id === selectedLotId);

    const containsSeeds = useMemo(() => {
        return items.some(item => {
            const prod = products.find(p => p.id === item.productId);
            return prod?.type === 'SEED';
        });
    }, [items, products]);

    // Add Item
    const handleAddItem = () => {
        if (!currProdId || !currDosage) return;
        const product = products.find(p => p.id === currProdId);
        if (!product) return;

        const item: OrderItem = {
            id: generateId(),
            productId: currProdId,
            productName: product.name,
            brandName: product.brandName,
            activeIngredient: product.activeIngredient,
            dosage: parseFloat(currDosage),
            unit: product.unit,
            totalQuantity: parseFloat(currDosage) * (selectedLot?.hectares || 0),
            plantingDensity: product.type === 'SEED' ? (plantingDensity ? parseFloat(plantingDensity) : undefined) : undefined,
            plantingDensityUnit: product.type === 'SEED' ? (plantingDensity ? plantingDensityUnit : undefined) : undefined,
            plantingSpacing: product.type === 'SEED' ? (plantingSpacing ? parseFloat(plantingSpacing) : undefined) : undefined,
        };

        setItems([...items, item]);
        setCurrProdId('');
        setCurrDosage('');
        setPlantingDensity('');
        setPlantingSpacing('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
    };

    // Stock Validation
    const stockShortages = useMemo(() => {
        return items.map(item => {
            const stockItem = stock.find(s => s.productId === item.productId);
            const available = stockItem?.quantity || 0;
            const needed = item.totalQuantity;
            const missing = needed > available ? needed - available : 0;
            return { ...item, available, missing };
        }).filter(i => i.missing > 0);
    }, [items, stock]);


    useEffect(() => {
        const fetchContractors = async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('role', 'CONTRATISTA');
            if (data) setContractors(data);
        };
        fetchContractors();
    }, []);

    const handleSubmit = async () => {
        if (!selectedLot || items.length === 0) return;

        try {
            // Get current orders to determine sequence number
            const allOrders = await db.getAll('orders');
            const clientOrders = allOrders.filter((o: Order) => o.clientId === clientId);
            const nextOrderNumber = clientOrders.length > 0
                ? Math.max(...clientOrders.map((o: Order) => o.orderNumber || 0)) + 1
                : 1;

            const order: Order = {
                id: generateId(),
                orderNumber: nextOrderNumber,
                type: 'SPRAYING',
                status: 'PENDING',
                date: date,
                time: time,
                applicationStart: appStart,
                applicationEnd: appEnd,
                clientId,
                farmId: selectedFarmId,
                lotId: selectedLotId,
                warehouseId: selectedOrderWarehouseId || undefined,
                applicatorId: selectedApplicatorId,
                treatedArea: selectedLot.hectares,
                items,
                // Order level summary fields if needed (optional since items have them)
                plantingDensity: items.find(i => products.find(p => p.id === i.productId)?.type === 'SEED')?.plantingDensity,
                plantingDensityUnit: items.find(i => products.find(p => p.id === i.productId)?.type === 'SEED')?.plantingDensityUnit,
                plantingSpacing: items.find(i => products.find(p => p.id === i.productId)?.type === 'SEED')?.plantingSpacing,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: displayName || 'Sistema',
                updatedBy: displayName || 'Sistema',
                synced: false
            };

            await addOrder(order, items, displayName || 'Sistema');

            // Update Lot crop if seeds were added
            if (containsSeeds && selectedLot) {
                const seedNames = items
                    .filter(item => products.find(p => p.id === item.productId)?.type === 'SEED')
                    .map(item => item.productName)
                    .join(' + ');

                await db.put('lots', {
                    ...selectedLot,
                    cropSpecies: seedNames,
                    status: 'SOWED',
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            }

            router.push(`/clients/${clientId}/orders`);
        } catch (e) {
            console.error(e);
            alert('Failed to save order');
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Nueva Orden de Pulverización</h1>
                <p className="text-slate-500">Crear una prescripción para aplicación de insumos.</p>
            </div>

            {/* Stepper */}
            <div className="flex justify-between items-center border-b border-slate-200 pb-4">
                <div className="flex gap-4">
                    {[1, 2, 3].map(s => (
                        <div key={s} className={`flex items-center gap-2 ${step === s ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-emerald-100' : 'bg-slate-100'}`}>{s}</div>
                            <span>{s === 1 ? 'Ubicación' : s === 2 ? 'Productos' : 'Confirmar'}</span>
                        </div>
                    ))}
                </div>
                <button
                    onClick={() => router.back()}
                    className="text-sm font-bold text-slate-400 hover:text-red-500 transition-colors uppercase tracking-wider"
                >
                    Cancelar
                </button>
            </div>

            {/* Step 1: Location */}
            {step === 1 && (
                <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de emisión</label>
                            <input type="date" className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                        <div className="w-full">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                            <input type="time" className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" value={time} onChange={e => setTime(e.target.value)} />
                        </div>
                    </div>

                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 grid grid-cols-2 gap-4">
                        <div className="w-full">
                            <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Inicio de ventana de aplicación</label>
                            <input type="date" className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm" value={appStart} onChange={e => setAppStart(e.target.value)} />
                        </div>
                        <div className="w-full">
                            <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Fin de ventana de aplicación</label>
                            <input type="date" className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm" value={appEnd} onChange={e => setAppEnd(e.target.value)} />
                        </div>
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Campo</label>
                        <select className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4" value={selectedFarmId} onChange={e => setSelectedFarmId(e.target.value)}>
                            <option value="">Seleccione Campo...</option>
                            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Lote</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                            value={selectedLotId}
                            onChange={e => setSelectedLotId(e.target.value)}
                            disabled={!selectedFarmId}
                        >
                            <option value="">Seleccione Lote...</option>
                            {lots.map(l => <option key={l.id} value={l.id}>{l.name} ({l.hectares} ha)</option>)}
                        </select>
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Origen (Galpón)</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                            value={selectedOrderWarehouseId}
                            onChange={e => setSelectedOrderWarehouseId(e.target.value)}
                        >
                            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>

                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Aplicador (Contratista)</label>
                        <select
                            className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                            value={selectedApplicatorId}
                            onChange={e => setSelectedApplicatorId(e.target.value)}
                        >
                            <option value="">Seleccione Aplicador...</option>
                            {contractors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                        </select>
                    </div>

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setStep(2)} disabled={!selectedLotId || !date}>Agregar productos</Button>
                    </div>
                </div>
            )}

            {/* Step 2: Recipe */}
            {step === 2 && selectedLot && (
                <div className="space-y-6 animate-fadeIn">
                    <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center text-sm">
                        <span className="font-bold text-slate-700">{selectedLot.name}</span>
                        <span className="text-emerald-700 bg-emerald-100 px-2 py-1 rounded">{selectedLot.hectares} hectáreas</span>
                    </div>

                    <div className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm space-y-4">
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Producto</label>
                                <select className="block w-full rounded-md border-slate-300 shadow-sm text-sm" value={currProdId} onChange={e => setCurrProdId(e.target.value)}>
                                    <option value="">Seleccione producto...</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div className="w-32">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                    {products.find(p => p.id === currProdId)?.type === 'SEED' ? 'kg / ha' : 'Dosis / ha'}
                                </label>
                                <input type="number" step="0.01" className="block w-full rounded-md border-slate-300 shadow-sm text-sm" placeholder="0.0" value={currDosage} onChange={e => setCurrDosage(e.target.value)} />
                            </div>
                            {products.find(p => p.id === currProdId)?.type !== 'SEED' && (
                                <Button onClick={handleAddItem} disabled={!currProdId || !currDosage}>Agregar</Button>
                            )}
                        </div>

                        {products.find(p => p.id === currProdId)?.type === 'SEED' && (
                            <div className="animate-fadeIn grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 items-end">
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-400">Densidad de siembra</label>
                                    <div className="flex">
                                        <input
                                            type="number"
                                            className="block w-full rounded-l-md border-slate-300 shadow-sm text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                            placeholder="0.0"
                                            value={plantingDensity}
                                            onChange={e => setPlantingDensity(e.target.value)}
                                        />
                                        <select
                                            className="bg-slate-100 border-y border-r border-slate-300 rounded-r-md px-2 text-xs font-medium focus:outline-none"
                                            value={plantingDensityUnit}
                                            onChange={e => setPlantingDensityUnit(e.target.value as any)}
                                        >
                                            <option value="PLANTS_HA">pl/ha</option>
                                            <option value="KG_HA">kg/ha</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider text-slate-400">Espaciamiento (cm)</label>
                                    <input
                                        type="number"
                                        className="block w-full rounded-md border-slate-300 shadow-sm text-sm focus:ring-emerald-500 focus:border-emerald-500"
                                        placeholder="ej. 52.5"
                                        value={plantingSpacing}
                                        onChange={e => setPlantingSpacing(e.target.value)}
                                    />
                                </div>
                                <Button onClick={handleAddItem} disabled={!currProdId || !currDosage} className="w-full">Agregar</Button>
                            </div>
                        )}
                    </div>


                    {/* Items List */}
                    <div className="space-y-2">
                        {items.map((item) => (
                            <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800">{item.productName}</div>
                                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4">
                                        <span>Dosis: {item.dosage} {item.unit}/ha</span>
                                        {item.plantingDensity && (
                                            <span className="font-medium text-blue-600">Densidad: {item.plantingDensity} {item.plantingDensityUnit === 'PLANTS_HA' ? 'pl/ha' : 'kg/ha'}</span>
                                        )}
                                        {item.plantingSpacing && (
                                            <span className="font-medium text-blue-600">Espaciamiento: {item.plantingSpacing} cm</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-mono text-emerald-600 font-bold">{item.totalQuantity.toFixed(2)} {item.unit}</div>
                                        <div className="text-xs text-slate-400">Total Requerido</div>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveItem(item.id)}
                                        className="text-slate-400 hover:text-black transition-colors p-1"
                                        title="Eliminar producto"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between pt-6 border-t border-slate-100">
                        <Button variant="secondary" onClick={() => setStep(1)}>Volver</Button>
                        <Button onClick={() => setStep(3)} disabled={items.length === 0}>Revisar stock</Button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirmation */}
            {step === 3 && (
                <div className="space-y-6 animate-fadeIn">
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
                        <h3 className="font-bold text-lg border-b pb-2">Resumen de la Orden</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-slate-500">Campo/Lote:</span> <span className="font-medium">{selectedLot?.name}</span></div>
                            <div><span className="text-slate-500">Superficie:</span> <span className="font-medium">{selectedLot?.hectares} ha</span></div>
                            <div><span className="text-slate-500">Fecha de emisión:</span> <span className="font-medium">{date}</span></div>
                            <div><span className="text-slate-500">Hora:</span> <span className="font-medium">{time}</span></div>
                            <div className="col-span-2 bg-emerald-50 px-3 py-1 rounded text-emerald-800 border border-emerald-100">
                                <span className="font-bold opacity-60">Ventana:</span> {appStart} • {appEnd}
                            </div>
                            {containsSeeds && plantingDensity && (
                                <>
                                    <div className="col-span-2 grid grid-cols-2 gap-4 py-2 border-t border-b border-slate-100 mt-2">
                                        <div>
                                            <span className="text-slate-500 block text-xs uppercase font-bold tracking-tight">Densidad</span>
                                            <span className="font-medium">{plantingDensity} {plantingDensityUnit === 'PLANTS_HA' ? 'plant/ha' : 'kg/ha'}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 block text-xs uppercase font-bold tracking-tight">Espaciamiento</span>
                                            <span className="font-medium">{plantingSpacing ? `${plantingSpacing} cm` : '-'}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            <div><span className="text-slate-500">Galpón:</span> <span className="font-medium">{warehouses.find(w => w.id === selectedOrderWarehouseId)?.name || 'Cargando...'}</span></div>
                            <div><span className="text-slate-500">Aplicador:</span> <span className="font-medium">{contractors.find(c => c.id === selectedApplicatorId)?.username || 'No asignado'}</span></div>
                        </div>

                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 border-b">
                                    <th className="font-medium py-2">Producto</th>
                                    <th className="font-medium py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id} className="border-b last:border-0 border-slate-50">
                                        <td className="py-2">{item.productName}</td>
                                        <td className="py-2 text-right font-mono">{item.totalQuantity.toFixed(2)} {item.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex justify-between pt-4">
                        <Button variant="secondary" onClick={() => setStep(2)}>Volver</Button>
                        <Button
                            onClick={handleSubmit}
                            variant={stockShortages.length > 0 ? 'danger' : 'primary'}
                        >
                            {stockShortages.length > 0 ? 'Confirmar de todas formas (Saldo Negativo)' : 'Confirmar Orden'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
