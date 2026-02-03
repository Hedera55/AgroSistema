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
import { Order, OrderItem, Unit, Client } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { ProductType } from '@/types';

const typeLabels: Record<ProductType, string> = {
    HERBICIDE: 'Herbicida',
    FERTILIZER: 'Fertilizante',
    SEED: 'Semilla',
    FUNGICIDE: 'Fungicida',
    INSECTICIDE: 'Insecticida',
    COADYUVANTE: 'Coadyuvante',
    INOCULANTE: 'Inoculante',
    OTHER: 'Otro'
};

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
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        db.get('clients', clientId).then(setClient);
    }, [clientId]);

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
    const [expectedYield, setExpectedYield] = useState('');
    const [servicePrice, setServicePrice] = useState('');
    const [selectedPartnerName, setSelectedPartnerName] = useState('');
    const [notes, setNotes] = useState('');
    const [facturaImageUrl, setFacturaImageUrl] = useState<string | null>(null);
    const [showNotes, setShowNotes] = useState(false);

    // Mechanical Labor State
    const [isMechanicalLabor, setIsMechanicalLabor] = useState(false);
    const [mechanicalLaborName, setMechanicalLaborName] = useState('');
    const [currLoadingOrder, setCurrLoadingOrder] = useState('');

    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Derived Data
    const { lots } = useLots(selectedFarmId);
    const selectedLot = lots.find(l => l.id === selectedLotId);

    const availableProducts = useMemo(() => {
        return products.filter(p => p.clientId === clientId);
    }, [products, clientId]);

    const containsSeeds = useMemo(() => {
        return items.some(item => {
            const prod = availableProducts.find(p => p.id === item.productId);
            return prod?.type === 'SEED';
        });
    }, [items, availableProducts]);

    // Add Item
    const handleAddItem = () => {
        if (!isMechanicalLabor && (!currProdId || !currDosage)) return;
        if (isMechanicalLabor && !mechanicalLaborName) return;

        const product = isMechanicalLabor ? null : products.find(p => p.id === currProdId);

        const item: OrderItem = {
            id: generateId(),
            productId: isMechanicalLabor ? 'LABOREO_MECANICO' : currProdId,
            productName: isMechanicalLabor ? mechanicalLaborName : (product?.name || ''),
            brandName: product?.brandName,
            commercialName: product?.commercialName,
            activeIngredient: product?.activeIngredient,
            dosage: parseFloat(currDosage || '0'),
            unit: product?.unit || 'ha',
            totalQuantity: parseFloat(currDosage || '0') * (selectedLot?.hectares || 0),
            loadingOrder: currLoadingOrder ? parseInt(currLoadingOrder) : undefined,
            plantingDensity: product?.type === 'SEED' ? (currDosage ? parseFloat(currDosage) : undefined) : undefined,
            plantingDensityUnit: product?.type === 'SEED' ? 'KG_HA' : undefined,
            plantingSpacing: product?.type === 'SEED' ? (plantingSpacing ? parseFloat(plantingSpacing) : undefined) : undefined,
            expectedYield: product?.type === 'SEED' ? (expectedYield ? parseFloat(expectedYield) : undefined) : undefined,
        };

        if (editingItemId) {
            setItems(items.map(i => i.id === editingItemId ? { ...item, id: editingItemId } : i));
            setEditingItemId(null);
        } else {
            setItems([...items, item]);
        }

        setCurrProdId('');
        setCurrDosage('');
        setPlantingDensity('');
        setPlantingSpacing('');
        setCurrLoadingOrder('');
        setIsMechanicalLabor(false);
        setMechanicalLaborName('');
    };

    const handleEditItem = (item: OrderItem) => {
        setEditingItemId(item.id);
        if (item.productId === 'LABOREO_MECANICO') {
            setIsMechanicalLabor(true);
            setMechanicalLaborName(item.productName);
        } else {
            setIsMechanicalLabor(false);
            setCurrProdId(item.productId);
        }
        setCurrDosage(String(item.dosage));
        setPlantingDensity(item.plantingDensity ? String(item.plantingDensity) : '');
        setPlantingSpacing(item.plantingSpacing ? String(item.plantingSpacing) : '');
        setCurrLoadingOrder(item.loadingOrder ? String(item.loadingOrder) : '');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setCurrProdId('');
        setCurrDosage('');
        setPlantingDensity('');
        setPlantingSpacing('');
        setCurrLoadingOrder('');
        setIsMechanicalLabor(false);
        setMechanicalLaborName('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
        if (editingItemId === id) {
            setEditingItemId(null);
            setCurrProdId('');
            setCurrDosage('');
            setPlantingDensity('');
            setPlantingSpacing('');
        }
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
                type: containsSeeds ? 'SOWING' : 'APPLICATION',
                status: 'PENDING',
                date: date,
                time: '00:00',
                applicationStart: appStart,
                applicationEnd: appEnd,
                clientId,
                farmId: selectedFarmId,
                lotId: selectedLotId,
                warehouseId: selectedOrderWarehouseId || undefined,
                applicatorId: selectedApplicatorId,
                servicePrice: servicePrice ? parseFloat(servicePrice) : 0,
                expectedYield: items.find(i => i.expectedYield)?.expectedYield,
                treatedArea: selectedLot.hectares,
                items,
                plantingDensity: items.find(i => i.plantingDensity)?.plantingDensity,
                plantingDensityUnit: items.find(i => i.plantingDensityUnit)?.plantingDensityUnit,
                plantingSpacing: items.find(i => i.plantingSpacing)?.plantingSpacing,
                notes: notes,
                facturaImageUrl: facturaImageUrl || undefined,
                investorName: selectedPartnerName,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: displayName || 'Sistema',
                updatedBy: displayName || 'Sistema',
                synced: false
            };

            await addOrder(order, items, displayName || 'Sistema');

            // Lot update is now handled by the order status toggle (Pending -> Done).
            // We do NOT update the lot to SOWED immediately upon creation (Pending).

            router.push(`/clients/${clientId}/orders`);
        } catch (e) {
            console.error(e);
            alert('Failed to save order');
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-slate-900">Nueva Orden</h1>
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
                    <div className="w-full">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de emisión</label>
                        <input type="date" className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500" value={date} onChange={e => setDate(e.target.value)} />
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

                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setStep(2)} disabled={!selectedLotId || !date}>Agregar producto</Button>
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

                    <div className="bg-white p-6 border border-slate-200 rounded-2xl shadow-sm space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50 p-6 rounded-xl border border-slate-100">
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Orden de Carga</label>
                                <Input
                                    type="number"
                                    placeholder="ej. 1"
                                    value={currLoadingOrder}
                                    onChange={e => setCurrLoadingOrder(e.target.value)}
                                    className="h-[46px]"
                                />
                            </div>

                            <div className="md:col-span-5">
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Producto / Labor</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-2.5 px-4 text-sm"
                                    value={isMechanicalLabor ? 'LABOREO_MECANICO' : currProdId}
                                    onChange={e => {
                                        if (e.target.value === 'LABOREO_MECANICO') {
                                            setIsMechanicalLabor(true);
                                            setCurrProdId('');
                                        } else {
                                            setIsMechanicalLabor(false);
                                            setCurrProdId(e.target.value);
                                        }
                                    }}
                                >
                                    <option value="">Seleccione producto...</option>
                                    <optgroup label="Servicios Especiales">
                                        <option value="LABOREO_MECANICO">Laboreo Mecánico</option>
                                    </optgroup>
                                    <optgroup label="Stock Galpón">
                                        {availableProducts.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.activeIngredient || p.name} {p.commercialName ? `| ${p.commercialName}` : ''} {p.brandName ? `(${p.brandName})` : ''} ({typeLabels[p.type]})
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>

                            <div className="md:col-span-3">
                                {isMechanicalLabor ? (
                                    <Input
                                        placeholder="ej. Arada"
                                        value={mechanicalLaborName}
                                        onChange={e => setMechanicalLaborName(e.target.value)}
                                        className="h-[46px]"
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={currDosage}
                                            onChange={e => setCurrDosage(e.target.value)}
                                            className={`${availableProducts.find(p => p.id === currProdId)?.type === 'SEED' ? 'hidden' : ''} h-[46px]`}
                                        />
                                        {!isMechanicalLabor && currProdId && availableProducts.find(p => p.id === currProdId)?.type !== 'SEED' && (
                                            <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">
                                                {availableProducts.find(p => p.id === currProdId)?.unit || 'u'}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-2 flex gap-2">
                                <Button onClick={handleAddItem} disabled={(!isMechanicalLabor && !currProdId) || (isMechanicalLabor && !mechanicalLaborName)} className="w-full">
                                    {editingItemId ? 'Ok' : '+'}
                                </Button>
                                {editingItemId && (
                                    <Button variant="secondary" onClick={handleCancelEdit}>
                                        ✕
                                    </Button>
                                )}
                            </div>
                        </div>

                        {!isMechanicalLabor && currProdId && availableProducts.find(p => p.id === currProdId)?.type === 'SEED' && (
                            <div className="animate-fadeIn grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Densidad (kg/ha)</label>
                                    <Input type="number" step="0.01" placeholder="ej. 80" value={currDosage} onChange={e => setCurrDosage(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Espaciamiento (cm)</label>
                                    <Input type="number" step="0.1" placeholder="ej. 52.5" value={plantingSpacing} onChange={e => setPlantingSpacing(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider mb-1">Rinde esperado (kg/ha)</label>
                                    <Input type="number" placeholder="ej. 3500" value={expectedYield} onChange={e => setExpectedYield(e.target.value)} />
                                </div>
                            </div>
                        )}

                        <div className="w-full">
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Depósito de Origen</label>
                            <select
                                className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm"
                                value={selectedOrderWarehouseId}
                                onChange={e => setSelectedOrderWarehouseId(e.target.value)}
                            >
                                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                            </select>
                        </div>

                        <div className="pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Contratista</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm"
                                    value={selectedApplicatorId}
                                    onChange={e => setSelectedApplicatorId(e.target.value)}
                                >
                                    <option value="">Seleccione Aplicador...</option>
                                    {contractors.map(c => <option key={c.id} value={c.id}>{c.username}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Precio Servicio / Ha (USD)</label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={servicePrice}
                                    onChange={e => setServicePrice(e.target.value)}
                                    className="h-[46px]"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Socio Responsable</label>
                                <select
                                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 text-sm"
                                    value={selectedPartnerName}
                                    onChange={e => setSelectedPartnerName(e.target.value)}
                                >
                                    <option value="">Seleccione Socio...</option>
                                    {client?.partners?.map((p: any) => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-6 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowNotes(!showNotes)}
                                className={`text-[10px] font-bold uppercase tracking-widest transition-all ${showNotes ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                            >
                                {showNotes ? '✓ Nota Agregada' : '+ Agregar Nota'}
                            </button>
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => document.getElementById('factura-upload')?.click()}
                                    className={`text-[10px] font-bold uppercase tracking-widest transition-all ${facturaImageUrl ? 'text-emerald-700' : 'text-emerald-600 hover:text-emerald-700'}`}
                                >
                                    {facturaImageUrl ? '✓ Factura Adjunta' : '+ Adjuntar Factura'}
                                </button>
                                <input
                                    id="factura-upload"
                                    type="file"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onloadend = () => setFacturaImageUrl(reader.result as string);
                                            reader.readAsDataURL(file);
                                        }
                                    }}
                                />
                            </div>
                        </div>

                        {showNotes && (
                            <div className="animate-fadeIn">
                                <textarea
                                    className="w-full rounded-xl border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-sm p-4"
                                    placeholder="Escriba aquí cualquier observación o detalle adicional..."
                                    rows={3}
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                        )}
                    </div>


                    {/* Items List */}
                    <div className="space-y-2">
                        {items.filter(i => i.id !== editingItemId).map((item) => (
                            <div key={item.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                <div>
                                    <div className="font-bold text-slate-800">
                                        {item.loadingOrder && <span className="text-emerald-600 mr-2">[{item.loadingOrder}]</span>}
                                        {item.productName} {item.commercialName ? `| ${item.commercialName}` : ''}
                                    </div>
                                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4">
                                        <span>Dosis: {item.dosage} {item.unit}/ha</span>
                                        {item.plantingDensity && (
                                            <span className="font-medium text-blue-600">Densidad: {item.plantingDensity} {item.plantingDensityUnit === 'PLANTS_HA' ? 'pl/ha' : 'kg/ha'}</span>
                                        )}
                                        {item.plantingSpacing && (
                                            <span className="font-medium text-blue-600">Espaciamiento: {item.plantingSpacing} cm</span>
                                        )}
                                        {item.expectedYield && (
                                            <span className="font-medium text-blue-600">Rinde Esperado: {item.expectedYield} kg/ha</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="font-mono text-emerald-600 font-bold">{item.totalQuantity.toFixed(2)} {item.unit}</div>
                                        <div className="text-xs text-slate-400">Total Requerido</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEditItem(item)}
                                            className="text-slate-400 hover:text-blue-600 transition-colors p-1"
                                            title="Editar producto"
                                        >
                                            ✎
                                        </button>
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                            title="Eliminar producto"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex justify-between pt-6 border-t border-slate-100">
                        <Button variant="secondary" onClick={() => setStep(1)}>Volver</Button>
                        <Button onClick={() => setStep(3)} disabled={items.length === 0}>Confirmar orden</Button>
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
                            <div><span className="text-slate-500">Campo/Lote:</span> <span className="font-medium">{farms.find(f => f.id === selectedFarmId)?.name} - {selectedLot?.name}</span></div>
                            <div><span className="text-slate-500">Superficie:</span> <span className="font-medium">{selectedLot?.hectares} ha</span></div>
                            <div><span className="text-slate-500">Fecha de emisión:</span> <span className="font-medium">{date}</span></div>
                            <div><span className="text-slate-500">Ventana de aplicación:</span> <span className="font-medium">{appStart} • {appEnd}</span></div>
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
                            <div><span className="text-slate-500">Galpón:</span> <span className="font-medium">{warehouses.find(w => w.id === selectedOrderWarehouseId)?.name || 'Cargando...'}</span></div>
                            <div><span className="text-slate-500">Aplicador:</span> <span className="font-medium">{contractors.find(c => c.id === selectedApplicatorId)?.username || 'No asignado'}</span></div>
                            {servicePrice && (
                                <div><span className="text-slate-500">Precio Servicio:</span> <span className="font-medium">USD {servicePrice} / ha</span></div>
                            )}
                            {selectedPartnerName && (
                                <div><span className="text-slate-500">Responsable:</span> <span className="font-medium">{selectedPartnerName}</span></div>
                            )}
                            {notes && (
                                <div className="col-span-2"><span className="text-slate-500 block">Nota:</span> <p className="text-slate-800 text-sm italic">"{notes}"</p></div>
                            )}
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
                                        <td className="py-2">
                                            {item.productName}
                                            {item.commercialName && <span className="text-slate-400 text-xs ml-2">({item.commercialName})</span>}
                                        </td>
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
