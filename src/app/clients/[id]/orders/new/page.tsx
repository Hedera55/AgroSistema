'use client';

import { use, useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useFarms, useLots } from '@/hooks/useLocations';
import { useClientStock, useInventory } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCampaigns } from '@/hooks/useCampaigns';
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
    const searchParams = useSearchParams();
    const editId = searchParams.get('editId');
    const { displayName } = useAuth();

    // Data Hooks
    const { farms } = useFarms(clientId);
    const { products } = useInventory();
    const { stock } = useClientStock(clientId);
    const { warehouses } = useWarehouses(clientId);
    const { addOrder } = useOrders(clientId);
    const { campaigns, loading: campaignsLoading } = useCampaigns(clientId);
    const [client, setClient] = useState<Client | null>(null);

    useEffect(() => {
        db.get('clients', clientId).then(setClient);
    }, [clientId]);

    // Preload Order for Edit
    useEffect(() => {
        if (!editId) return;

        const preloadOrder = async () => {
            const order = await db.get('orders', editId) as Order;
            if (!order) return;

            // Basic Info
            setSelectedFarmId(order.farmId || '');
            setSelectedLotIds(order.lotIds || (order.lotId ? [order.lotId] : []));
            setLotObservations(order.lotObservations || {});

            // Dates
            setDate(order.date || new Date().toISOString().split('T')[0]);
            setIsDateRange(order.isDateRange ?? true);
            if (order.applicationDate) setApplicationDate(order.applicationDate);
            if (order.applicationStart) setAppStart(order.applicationStart);
            if (order.applicationEnd) setAppEnd(order.applicationEnd);

            // Recipe & Items
            setItems(order.items || []);

            // Contractor & Partners
            setSelectedApplicatorId(order.applicatorId || '');
            setServicePrice(order.servicePrice ? String(order.servicePrice) : '');
            setSelectedPartnerName(order.investorName || '');
            setSelectedCampaignId(order.campaignId || '');

            // Notes & Extra
            setNotes(order.notes || '');
            setFacturaImageUrl(order.facturaImageUrl || null);
            if (order.notes) setShowNotes(true);
        };

        preloadOrder();
    }, [editId]);

    // Form State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedFarmId, setSelectedFarmId] = useState('');
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
    const [lotHectares, setLotHectares] = useState<Record<string, number>>({});
    const [lotObservations, setLotObservations] = useState<Record<string, string>>({});
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [currWarehouseId, setCurrWarehouseId] = useState('');

    useEffect(() => {
        if (!currWarehouseId && warehouses.length > 0) {
            setCurrWarehouseId(warehouses[0].id);
        }
    }, [warehouses, currWarehouseId]);

    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [isDateRange, setIsDateRange] = useState(true);
    const [applicationDate, setApplicationDate] = useState(new Date().toISOString().split('T')[0]);
    const [appStart, setAppStart] = useState(new Date().toISOString().split('T')[0]);
    const [appEnd, setAppEnd] = useState(new Date().toISOString().split('T')[0]);

    // Order Items
    const [items, setItems] = useState<OrderItem[]>([]);

    // Current Item Input
    const [currProdId, setCurrProdId] = useState('');
    const [currDosage, setCurrDosage] = useState('');
    const [subQuantities, setSubQuantities] = useState<Record<string, number>>({});

    // Contractors
    const [contractors, setContractors] = useState<{ id: string, username: string, assigned_clients?: string[] }[]>([]);
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
    const selectedLots = lots.filter(l => selectedLotIds.includes(l.id));
    const selectedFarm = farms.find(f => f.id === selectedFarmId);

    const totalTreatedArea = useMemo(() => {
        return selectedLots.reduce((acc, l) => acc + (lotHectares[l.id] ?? (l.hectares || 0)), 0);
    }, [selectedLots, lotHectares]);

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
        let otherItems = items.filter(i => (i.groupId || i.id) !== editingItemId);

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
                ? totalTreatedArea
                : parseFloat(currDosage || '0') * totalTreatedArea,
            loadingOrder: requestedOrder,
            plantingDensity: product?.type === 'SEED' ? (currDosage ? parseFloat(currDosage) : undefined) : undefined,
            plantingDensityUnit: product?.type === 'SEED' ? 'KG_HA' : undefined,
            plantingSpacing: product?.type === 'SEED' ? (plantingSpacing ? parseFloat(plantingSpacing) : undefined) : undefined,
            expectedYield: product?.type === 'SEED' ? (expectedYield ? parseFloat(expectedYield) : undefined) : undefined,
            warehouseId: isMechanicalLabor ? undefined : currWarehouseId,
            warehouseName: isMechanicalLabor ? undefined : warehouses.find(w => w.id === currWarehouseId)?.name,
            productType: product?.type
        };

        const newItemGroupId = generateId();
        const newItems: OrderItem[] = [];

        // If it's mechanical labor, just one item
        if (isMechanicalLabor) {
            newItems.push({ ...item, groupId: newItemGroupId });
        } else {
            // Check if we have subQuantities (presentations selected)
            const selectedStockIds = Object.entries(subQuantities).filter(([_, qty]) => qty > 0);

            if (selectedStockIds.length > 0) {
                let selectedTotalFromSubQuantities = 0;
                selectedStockIds.forEach(([stockId, multiplier]) => {
                    const stockItem = stock.find(s => s.id === stockId);
                    if (!stockItem) return;

                    const wh = warehouses.find(w => w.id === stockItem.warehouseId);
                    const absoluteQty = multiplier * (stockItem.presentationContent || 1);
                    selectedTotalFromSubQuantities += absoluteQty;

                    newItems.push({
                        ...item,
                        id: generateId(),
                        groupId: newItemGroupId,
                        warehouseId: stockItem.warehouseId,
                        warehouseName: wh?.name || 'Desconocido',
                        presentationLabel: stockItem.presentationLabel,
                        presentationContent: stockItem.presentationContent,
                        multiplier: multiplier,
                        totalQuantity: absoluteQty
                    });
                });

                // Check for deficit
                const requiredTotal = item.totalQuantity;
                if (selectedTotalFromSubQuantities < requiredTotal - 0.001) {
                    const deficitQty = requiredTotal - selectedTotalFromSubQuantities;
                    newItems.push({
                        ...item,
                        id: generateId(),
                        groupId: newItemGroupId,
                        productName: `Déficit de ${item.productName}`,
                        commercialName: `Déficit de ${item.productName}`,
                        presentationLabel: 'Déficit',
                        multiplier: undefined,
                        totalQuantity: deficitQty,
                        isVirtualDéficit: true,
                        warehouseId: undefined, // Deficits are global to the order
                        warehouseName: undefined
                    });
                }
            } else {
                // Fallback: mark as deficit if no stock selected
                newItems.push({
                    ...item,
                    groupId: newItemGroupId,
                    isVirtualDéficit: true,
                    presentationLabel: 'Faltante',
                    warehouseId: undefined,
                    warehouseName: undefined
                });
            }
        }

        const finalItems = [...otherItems, ...newItems].sort((a, b) => (a.loadingOrder || 999) - (b.loadingOrder || 999));
        setItems(finalItems);
        setEditingItemId(null);

        setCurrProdId('');
        setCurrDosage('');
        setSubQuantities({});
        setPlantingSpacing('');
        setExpectedYield('');
        setCurrLoadingOrder('');
        setIsMechanicalLabor(false);
        setMechanicalLaborName('');
    };

    const handleEditItem = (item: OrderItem) => {
        setEditingItemId(item.groupId || item.id);
        const groupItems = items.filter(i => (i.groupId || i.id) === (item.groupId || item.id));
        const first = groupItems[0];

        if (first.productId === 'LABOREO_MECANICO') {
            setIsMechanicalLabor(true);
            setMechanicalLaborName(first.productName);
        } else {
            setIsMechanicalLabor(false);
            setCurrProdId(first.productId);
        }

        setCurrDosage(String(first.dosage));
        setPlantingSpacing(first.plantingSpacing ? String(first.plantingSpacing) : '');
        setExpectedYield(first.expectedYield ? String(first.expectedYield) : '');
        setCurrLoadingOrder(first.loadingOrder ? String(first.loadingOrder) : '');

        // Repopulate subQuantities
        const newSubQs: Record<string, number> = {};
        groupItems.forEach(i => {
            // We need to find the stockId. 
            // Since we don't store stockId in OrderItem, we have to match by productId, warehouseId, and presentation details.
            const s = stock.find(st =>
                st.productId === i.productId &&
                st.warehouseId === i.warehouseId &&
                (st.presentationLabel || '') === (i.presentationLabel || '') &&
                (st.presentationContent || 0) === (i.presentationContent || 0)
            );
            if (s) {
                newSubQs[s.id] = i.multiplier || 0;
            }
        });
        setSubQuantities(newSubQs);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setCurrProdId('');
        setCurrDosage('');
        setSubQuantities({});
        setPlantingSpacing('');
        setExpectedYield('');
        setCurrLoadingOrder('');
        setIsMechanicalLabor(false);
        setMechanicalLaborName('');
    };

    const handleRemoveItem = (idOrGroupId: string) => {
        setItems(items.filter(i => (i.groupId || i.id) !== idOrGroupId));
        if (editingItemId === idOrGroupId) handleCancelEdit();
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
                .select('id, username, assigned_clients')
                .eq('role', 'CONTRATISTA');
            if (data) {
                // Whitelist: Only show contractors assigned to this client
                const filtered = data.filter((p: any) =>
                    p.assigned_clients && Array.isArray(p.assigned_clients) && p.assigned_clients.includes(clientId)
                );
                setContractors(filtered);
            }
        };
        fetchContractors();
    }, [clientId]);

    const handleSubmit = async () => {
        // Smart Sowing Validation
        const containsSeeds = items.some(i => i.productType === 'SEED');
        if (containsSeeds) {
            const allOrders = await db.getAll('orders') as Order[];
            for (const lotId of selectedLotIds) {
                const lot = lots.find(l => l.id === lotId);
                if (!lot) continue;

                const previousSowings = allOrders.filter(o =>
                    o.clientId === clientId &&
                    !o.deleted &&
                    (o.lotIds?.includes(lotId) || o.lotId === lotId) &&
                    o.type === 'SOWING' &&
                    o.id !== editId
                );

                const sownArea = previousSowings.reduce((acc, o) => {
                    const ha = o.lotHectares?.[lotId] ?? o.treatedArea; // Fallback to treatedArea for single-lot legacy orders
                    return acc + ha;
                }, 0);

                const currentArea = lotHectares[lotId] ?? lot.hectares;

                if (sownArea + currentArea > lot.hectares + 0.01) { // 0.01 tolerance for float precision
                    alert(`El lote "${lot.name}" ya tiene ${sownArea.toFixed(1)} ha sembradas. Sumando las ${currentArea.toFixed(1)} ha actuales, supera el total de ${lot.hectares} ha. Por favor, ajuste el recorte.`);
                    return;
                }
            }
        }

        try {
            const allOrders = await db.getAll('orders');
            const clientOrders = allOrders.filter((o: Order) => o.clientId === clientId);
            const nextOrderNumber = clientOrders.length > 0
                ? Math.max(...clientOrders.map((o: Order) => o.orderNumber || 0)) + 1
                : 1;

            const order: Order = {
                id: editId || generateId(),
                orderNumber: nextOrderNumber,
                type: containsSeeds ? 'SOWING' : 'APPLICATION',
                status: 'PENDING',
                date: date,
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                applicationDate: isDateRange ? undefined : applicationDate,
                applicationStart: isDateRange ? appStart : undefined,
                applicationEnd: isDateRange ? appEnd : undefined,
                isDateRange,
                clientId,
                farmId: selectedFarmId,
                lotId: selectedLotIds[0] || '', // Legacy compatibility for NOT NULL constraint
                lotIds: selectedLotIds,
                lotHectares,
                lotObservations,
                applicatorId: selectedApplicatorId,
                applicatorName: contractors.find(c => c.id === selectedApplicatorId)?.username,
                servicePrice: servicePrice ? parseFloat(servicePrice) : 0,
                expectedYield: items.find(i => i.expectedYield)?.expectedYield,
                treatedArea: totalTreatedArea,
                items,
                plantingDensity: items.find(i => i.plantingDensity)?.plantingDensity,
                plantingDensityUnit: items.find(i => i.plantingDensityUnit)?.plantingDensityUnit,
                plantingSpacing: items.find(i => i.plantingSpacing)?.plantingSpacing,
                notes: notes,
                facturaImageUrl: facturaImageUrl || undefined,
                investorName: selectedPartnerName,
                campaignId: selectedCampaignId || undefined,
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
                    isDateRange={isDateRange} setIsDateRange={setIsDateRange}
                    applicationDate={applicationDate} setApplicationDate={setApplicationDate}
                    appStart={appStart} setAppStart={setAppStart}
                    appEnd={appEnd} setAppEnd={setAppEnd}
                    selectedFarmId={selectedFarmId} setSelectedFarmId={setSelectedFarmId}
                    selectedLotIds={selectedLotIds} setSelectedLotIds={setSelectedLotIds}
                    lotHectares={lotHectares} setLotHectares={setLotHectares}
                    lotObservations={lotObservations} setLotObservations={setLotObservations}
                    farms={farms} lots={lots}
                    onNext={() => setStep(2)}
                />
            )}

            {step === 2 && selectedLots.length > 0 && (
                <OrderRecipeStep
                    selectedLot={{
                        name: selectedLots.length === 1 ? selectedLots[0].name : 'Varios lotes',
                        hectares: totalTreatedArea
                    }}
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
                    selectedCampaignId={selectedCampaignId} setSelectedCampaignId={setSelectedCampaignId}
                    campaigns={campaigns}
                    showNotes={showNotes} setShowNotes={setShowNotes}
                    notes={notes} setNotes={setNotes}
                    facturaImageUrl={facturaImageUrl} setFacturaImageUrl={setFacturaImageUrl}
                    subQuantities={subQuantities} setSubQuantities={setSubQuantities}
                    stock={stock}
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
                    isDateRange={isDateRange}
                    applicationDate={applicationDate}
                    appStart={appStart}
                    appEnd={appEnd}
                    selectedFarm={selectedFarm}
                    selectedLot={{
                        name: selectedLots.length === 1 ? selectedLots[0].name : 'Varios lotes',
                        hectares: totalTreatedArea
                    }}
                    items={items}
                    containsSeeds={containsSeeds}
                    availableProducts={availableProducts}
                    stockShortages={stockShortages}
                    contractors={contractors}
                    selectedApplicatorId={selectedApplicatorId}
                    servicePrice={servicePrice}
                    selectedPartnerName={selectedPartnerName}
                    campaignName={campaigns.find(c => c.id === selectedCampaignId)?.name}
                    notes={notes}
                    onBack={() => setStep(2)}
                    onSubmit={handleSubmit}
                />
            )}
        </div>
    );
}
