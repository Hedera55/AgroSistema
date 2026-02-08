'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFarms, useLots } from '@/hooks/useLocations';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { supabase } from '@/lib/supabase';
import { db } from '@/services/db';
import { Order, OrderItem, Client, ProductType } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';

// Components
import { OrderLocationStep } from './components/OrderLocationStep';
import { OrderRecipeStep } from './components/OrderRecipeStep';
import { OrderConfirmationStep } from './components/OrderConfirmationStep';

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
    const { displayName } = useAuth();

    // Data Hooks
    const { farms } = useFarms(clientId);
    const { products } = useInventory();
    const { stock } = useClientStock(clientId);
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
    const [currWarehouseId, setCurrWarehouseId] = useState('');

    useEffect(() => {
        if (!currWarehouseId && warehouses.length > 0) {
            setCurrWarehouseId(warehouses[0].id);
        }
    }, [warehouses, currWarehouseId]);

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
    const selectedFarm = farms.find(f => f.id === selectedFarmId);

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

        // Auto-shifting logic for loading order
        const requestedOrder = currLoadingOrder ? parseInt(currLoadingOrder) : undefined;
        let otherItems = items.filter(i => i.id !== editingItemId);

        if (requestedOrder !== undefined) {
            const collision = otherItems.some(i => i.loadingOrder === requestedOrder);
            if (collision) {
                otherItems = otherItems.map(i => {
                    if (i.loadingOrder !== undefined && i.loadingOrder >= requestedOrder) {
                        return { ...i, loadingOrder: i.loadingOrder + 1 };
                    }
                    return i;
                });
            }
        }

        const item: OrderItem = {
            id: editingItemId || generateId(),
            productId: isMechanicalLabor ? 'LABOREO_MECANICO' : currProdId,
            productName: isMechanicalLabor ? mechanicalLaborName : (product?.name || ''),
            brandName: product?.brandName,
            commercialName: product?.commercialName,
            activeIngredient: product?.activeIngredient,
            dosage: isMechanicalLabor ? 1 : parseFloat(currDosage || '0'),
            unit: product?.unit || 'ha',
            totalQuantity: isMechanicalLabor
                ? (selectedLot?.hectares || 0)
                : parseFloat(currDosage || '0') * (selectedLot?.hectares || 0),
            loadingOrder: requestedOrder,
            plantingDensity: product?.type === 'SEED' ? (currDosage ? parseFloat(currDosage) : undefined) : undefined,
            plantingDensityUnit: product?.type === 'SEED' ? 'KG_HA' : undefined,
            plantingSpacing: product?.type === 'SEED' ? (plantingSpacing ? parseFloat(plantingSpacing) : undefined) : undefined,
            expectedYield: product?.type === 'SEED' ? (expectedYield ? parseFloat(expectedYield) : undefined) : undefined,
            warehouseId: isMechanicalLabor ? undefined : currWarehouseId,
            warehouseName: isMechanicalLabor ? undefined : warehouses.find(w => w.id === currWarehouseId)?.name,
            productType: product?.type
        };

        const finalItems = [...otherItems, item].sort((a, b) => (a.loadingOrder || 999) - (b.loadingOrder || 999));
        setItems(finalItems);
        setEditingItemId(null);

        setCurrProdId('');
        setCurrDosage('');
        setPlantingSpacing('');
        setExpectedYield('');
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
        setPlantingSpacing(item.plantingSpacing ? String(item.plantingSpacing) : '');
        setCurrLoadingOrder(item.loadingOrder ? String(item.loadingOrder) : '');
        setCurrWarehouseId(item.warehouseId || '');
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setCurrProdId('');
        setCurrDosage('');
        setPlantingSpacing('');
        setExpectedYield('');
        setCurrLoadingOrder('');
        setIsMechanicalLabor(false);
        setMechanicalLaborName('');
        if (warehouses.length > 0) setCurrWarehouseId(warehouses[0].id);
    };

    const handleRemoveItem = (id: string) => {
        setItems(items.filter(i => i.id !== id));
        if (editingItemId === id) handleCancelEdit();
    };

    // Stock Validation
    const stockShortages = useMemo(() => {
        return items.map(item => {
            const stockItem = stock.find(s => s.productId === item.productId);
            const available = stockItem?.quantity || 0;
            const needed = item.totalQuantity;
            const missing = needed > available ? needed - available : 0;
            return { ...item, available, missing };
        }).filter(i => i.missing > 0 && i.productId !== 'LABOREO_MECANICO');
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

        if (containsSeeds && selectedLot.status === 'SOWED') {
            alert('Este lote ya posee una siembra aplicada. Debe reiniciarlo antes de cargar una nueva siembra.');
            return;
        }

        try {
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
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                applicationStart: appStart,
                applicationEnd: appEnd,
                clientId,
                farmId: selectedFarmId,
                lotId: selectedLotId,
                applicatorId: selectedApplicatorId,
                applicatorName: contractors.find(c => c.id === selectedApplicatorId)?.username,
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

            {step === 1 && (
                <OrderLocationStep
                    date={date} setDate={setDate}
                    appStart={appStart} setAppStart={setAppStart}
                    appEnd={appEnd} setAppEnd={setAppEnd}
                    selectedFarmId={selectedFarmId} setSelectedFarmId={setSelectedFarmId}
                    selectedLotId={selectedLotId} setSelectedLotId={setSelectedLotId}
                    farms={farms} lots={lots}
                    onNext={() => setStep(2)}
                />
            )}

            {step === 2 && selectedLot && (
                <OrderRecipeStep
                    selectedLot={selectedLot}
                    items={items}
                    availableProducts={availableProducts}
                    warehouses={warehouses}
                    contractors={contractors}
                    typeLabels={typeLabels}
                    currLoadingOrder={currLoadingOrder} setCurrLoadingOrder={setCurrLoadingOrder}
                    isMechanicalLabor={isMechanicalLabor} setIsMechanicalLabor={setIsMechanicalLabor}
                    currProdId={currProdId} setCurrProdId={setCurrProdId}
                    currWarehouseId={currWarehouseId} setCurrWarehouseId={setCurrWarehouseId}
                    currDosage={currDosage} setCurrDosage={setCurrDosage}
                    mechanicalLaborName={mechanicalLaborName} setMechanicalLaborName={setMechanicalLaborName}
                    plantingSpacing={plantingSpacing} setPlantingSpacing={setPlantingSpacing}
                    expectedYield={expectedYield} setExpectedYield={setExpectedYield}
                    editingItemId={editingItemId}
                    selectedApplicatorId={selectedApplicatorId} setSelectedApplicatorId={setSelectedApplicatorId}
                    servicePrice={servicePrice} setServicePrice={setServicePrice}
                    selectedPartnerName={selectedPartnerName} setSelectedPartnerName={setSelectedPartnerName}
                    showNotes={showNotes} setShowNotes={setShowNotes}
                    notes={notes} setNotes={setNotes}
                    facturaImageUrl={facturaImageUrl} setFacturaImageUrl={setFacturaImageUrl}
                    handleAddItem={handleAddItem}
                    handleEditItem={handleEditItem}
                    handleRemoveItem={handleRemoveItem}
                    handleCancelEdit={handleCancelEdit}
                    onBack={() => setStep(1)}
                    onNext={() => setStep(3)}
                    clientPartners={client?.partners}
                />
            )}

            {step === 3 && (
                <OrderConfirmationStep
                    date={date}
                    appStart={appStart}
                    appEnd={appEnd}
                    selectedFarm={selectedFarm}
                    selectedLot={selectedLot}
                    items={items}
                    availableProducts={availableProducts}
                    stockShortages={stockShortages}
                    contractors={contractors}
                    selectedApplicatorId={selectedApplicatorId}
                    servicePrice={servicePrice}
                    selectedPartnerName={selectedPartnerName}
                    notes={notes}
                    onBack={() => setStep(2)}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
}
