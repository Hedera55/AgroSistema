'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { OrderLocationStep } from './OrderLocationStep';
import { OrderRecipeStep } from './OrderRecipeStep';
import { OrderConfirmationStep } from './OrderConfirmationStep';

const typeLabels: Record<ProductType, string> = {
    HERBICIDE: 'Herbicida',
    FERTILIZER: 'Fertilizante',
    SEED: 'Semilla',
    FUNGICIDE: 'Fungicida',
    INSECTICIDE: 'Insecticida',
    COADYUVANTE: 'Coadyuvante',
    INOCULANTE: 'Inoculante',
    GRAIN: 'Grano',
    OTHER: 'Otro'
};

interface OrderWizardProps {
    clientId: string;
    editId?: string | null;
    onClose: () => void;
    onOrderCreated?: () => void;
}

export function OrderWizard({ clientId, editId, onClose, onOrderCreated }: OrderWizardProps) {
    const { displayName, user: authUser, role, assignedClients } = useAuth();

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

    // Form State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [selectedFarmId, setSelectedFarmId] = useState('');
    const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);
    const [lotHectares, setLotHectares] = useState<Record<string, number>>({});
    const [lotObservations, setLotObservations] = useState<Record<string, string>>({});
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [currWarehouseId, setCurrWarehouseId] = useState('');

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
    const [selectedInvestors, setSelectedInvestors] = useState<Array<{ name: string; percentage: number }>>([]);
    const [selectedPartnerName, setSelectedPartnerName] = useState(''); 
    const [notes, setNotes] = useState('');
    const [facturaImageUrl, setFacturaImageUrl] = useState<string | null>(null);
    const [remitoImageUrl, setRemitoImageUrl] = useState<string | null>(null);
    const [technicalResponsible, setTechnicalResponsible] = useState('');
    const [showNotes, setShowNotes] = useState(false);
    const [kmlData, setKmlData] = useState<string | null>(null);
    const [boundary, setBoundary] = useState<any>(null);

    // Mechanical Labor State
    const [isMechanicalLabor, setIsMechanicalLabor] = useState(false);
    const [mechanicalLaborName, setMechanicalLaborName] = useState('');
    const [currLoadingOrder, setCurrLoadingOrder] = useState('');
    const [preloadedOrder, setPreloadedOrder] = useState<Order | null>(null);
    const [fertilizerPlacement, setFertilizerPlacement] = useState<'LINE' | 'SIDE' | undefined>(undefined);

    const [editingItemId, setEditingItemId] = useState<string | null>(null);

    // Initial warehouse selection
    useEffect(() => {
        if (!currWarehouseId && warehouses.length > 0) {
            setCurrWarehouseId(warehouses[0].id);
        }
    }, [warehouses, currWarehouseId]);

    // Preload Order for Edit
    useEffect(() => {
        if (!editId) {
            // Reset for new creation
            setPreloadedOrder(null);
            setStep(1);
            setSelectedFarmId('');
            setSelectedLotIds([]);
            setLotHectares({});
            setLotObservations({});
            setItems([]);
            return;
        }

        const preloadOrder = async () => {
            const order = await db.get('orders', editId) as Order;
            if (!order) return;

            setPreloadedOrder(order);
            setSelectedFarmId(order.farmId || '');
            setSelectedLotIds(order.lotIds || (order.lotId ? [order.lotId] : []));
            setLotHectares(order.lotHectares || {});
            setLotObservations(order.lotObservations || {});

            setDate(order.date || new Date().toISOString().split('T')[0]);
            setIsDateRange(order.isDateRange ?? true);
            if (order.applicationDate) setApplicationDate(order.applicationDate);
            if (order.applicationStart) setAppStart(order.applicationStart);
            if (order.applicationEnd) setAppEnd(order.applicationEnd);

            setItems(order.items || []);
            setSelectedApplicatorId(order.applicatorId || '');
            setServicePrice(order.servicePrice ? String(order.servicePrice) : '');
            setSelectedInvestors(order.investors || (order.investorName ? [{ name: order.investorName, percentage: 100 }] : []));
            setSelectedPartnerName(order.investorName || '');
            setSelectedCampaignId(order.campaignId || '');

            setNotes(order.notes || '');
            setFacturaImageUrl(order.facturaImageUrl || null);
            setRemitoImageUrl(order.remitoImageUrl || null);
            setTechnicalResponsible(order.technicalResponsible || '');
            setKmlData(order.kmlData || null);
            setBoundary(order.boundary || null);
            if (order.notes) setShowNotes(true);
        };

        preloadOrder();
    }, [editId]);

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

    // Item Handlers
    const handleAddItem = () => {
        if (!isMechanicalLabor && (!currProdId || !currDosage)) return;
        if (isMechanicalLabor && !mechanicalLaborName) return;

        const product = isMechanicalLabor ? null : products.find(p => p.id === currProdId);
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
            productType: product?.type,
            fertilizerPlacement: product?.type === 'FERTILIZER' ? fertilizerPlacement : undefined
        };

        const newItemGroupId = generateId();
        const newItems: OrderItem[] = [];

        if (isMechanicalLabor) {
            newItems.push({ ...item, groupId: newItemGroupId });
        } else {
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
                        warehouseId: undefined,
                        warehouseName: undefined
                    });
                }
            } else {
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

        const newSubQs: Record<string, number> = {};
        groupItems.forEach(i => {
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
            const totalAvailable = stock
                .filter(s => s.productId === item.productId)
                .reduce((acc, s) => acc + (s.quantity || 0), 0);
            const needed = item.totalQuantity;
            const missing = needed > totalAvailable ? needed - totalAvailable : 0;
            return { ...item, available: totalAvailable, missing };
        }).filter(i => i.missing > 0 && i.productId !== 'LABOREO_MECANICO');
    }, [items, stock]);


    useEffect(() => {
        const fetchContractors = async () => {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, email, role, assigned_clients')
                    .eq('role', 'CONTRATISTA');

                if (error) {
                    console.error('Error fetching contractors:', error);
                    return;
                }

                const assignedToThisClient = (data || []).filter(p => {
                    const assigned = p.assigned_clients;
                    if (!assigned) return false;
                    const assignedArray = Array.isArray(assigned) ? assigned : JSON.parse(String(assigned));
                    return assignedArray.includes(clientId);
                });

                let finalContractors = assignedToThisClient.map(p => ({
                    id: p.id,
                    username: p.username || p.email || `Usuario ${p.id.slice(0, 5)}`
                }));

                if (role === 'CONTRATISTA' && assignedClients && assignedClients.includes(clientId)) {
                    const alreadyIn = finalContractors.some(c => c.id === authUser?.id);
                    if (!alreadyIn) {
                        finalContractors.push({
                            id: authUser?.id || '',
                            username: displayName || 'Yo'
                        });
                    }
                }

                setContractors(finalContractors);
            } catch (err) {
                console.error('Unexpected error in fetchContractors:', err);
            }
        };
        fetchContractors();
    }, [clientId, authUser?.id, role, assignedClients, displayName]);

    const enhancedCampaigns = useMemo(() => {
        if (!campaigns) return [];
        let list = [...campaigns];
        if (selectedCampaignId && !list.find(c => c.id === selectedCampaignId)) {
            list.push({
                id: selectedCampaignId,
                name: 'Campaña guardada',
                clientId: clientId,
                mode: 'MONEY'
            });
        }
        return list;
    }, [campaigns, selectedCampaignId, clientId]);

    const enhancedPartners = useMemo(() => {
        let partners = client?.partners || [];
        if (selectedPartnerName && !partners.find(p => p.name === selectedPartnerName)) {
            partners = [...partners, { name: selectedPartnerName }];
        }
        return partners;
    }, [client?.partners, selectedPartnerName]);

    const handleSubmit = async () => {
        const containsSeeds = items.some(i => i.productType === 'SEED');
        if (containsSeeds) {
            const allOrders = await db.getAll('orders') as Order[];
            for (const lotId of selectedLotIds) {
                const lot = lots.find(l => l.id === lotId);
                if (!lot) continue;
                if (lot.status === 'EMPTY' || lot.status === 'HARVESTED') continue;

                const previousSowings = allOrders.filter(o =>
                    o.clientId === clientId &&
                    !o.deleted &&
                    o.campaignId === selectedCampaignId &&
                    (o.lotIds?.includes(lotId) || o.lotId === lotId) &&
                    o.type === 'SOWING' &&
                    o.id !== editId
                );

                const sownArea = previousSowings.reduce((acc, o) => {
                    const isMultiLot = (o.lotIds?.length || 0) > 1;
                    const ha = o.lotHectares?.[lotId] ?? (isMultiLot ? 0 : o.treatedArea);
                    return acc + (ha || 0);
                }, 0);

                const currentArea = lotHectares[lotId] ?? lot.hectares;
                if (sownArea + currentArea > lot.hectares + 0.1) {
                    alert(`El lote "${lot.name}" ya tiene ${sownArea.toFixed(1)} ha sembradas en esta campaña. Sumando las ${currentArea.toFixed(1)} ha actuales, supera el total de ${lot.hectares} ha.`);
                    return;
                }
            }
        }

        try {
            let nextOrderNumber = undefined;
            if (editId) {
                nextOrderNumber = preloadedOrder?.orderNumber;
                if (nextOrderNumber === undefined) {
                    const existingOrder = await db.get('orders', editId) as Order;
                    nextOrderNumber = existingOrder?.orderNumber;
                }
            }
            
            if (nextOrderNumber === undefined) {
                const allOrders = await db.getAll('orders');
                const clientOrders = allOrders.filter((o: Order) => o.clientId === clientId && !o.deleted);
                nextOrderNumber = clientOrders.length > 0
                    ? Math.max(...clientOrders.map((o: Order) => typeof o.orderNumber === 'string' ? parseInt(o.orderNumber) : o.orderNumber || 0)) + 1
                    : 1;
            }

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
                lotId: selectedLotIds[0] || '',
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
                remitoImageUrl: remitoImageUrl || undefined,
                technicalResponsible: technicalResponsible || undefined,
                boundary: boundary || undefined,
                kmlData: kmlData || undefined,
                investorName: selectedInvestors.length > 0 ? selectedInvestors[0].name : '',
                investors: selectedInvestors,
                campaignId: selectedCampaignId || undefined,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                createdBy: displayName || 'Sistema',
                updatedBy: displayName || 'Sistema',
                synced: false
            };

            await addOrder(order, items, displayName || 'Sistema');
            if (onOrderCreated) onOrderCreated();
            onClose();
        } catch (e) {
            console.error(e);
            alert('Failed to save order');
        }
    };

    return (
        <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-xl space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                    <h2 className="text-lg font-bold text-slate-900">{editId ? 'Editar' : 'Nueva'} Orden</h2>
                </div>
                
                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-4">
                        {[
                            { num: 1, label: 'Ubicación' },
                            { num: 2, label: 'Insumos' },
                            { num: 3, label: 'Confirmar' }
                        ].map(s => (
                            <div key={s.num} className={`flex items-center gap-2 ${step === s.num ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s.num ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                                    {s.num}
                                </div>
                                <span className={`text-sm ${step === s.num ? 'font-bold' : 'font-medium opacity-70'}`}>
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400 transition-colors"
                        title="Cancelar y cerrar"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto">
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
                        currLoadingOrder={currLoadingOrder}
                        setCurrLoadingOrder={setCurrLoadingOrder}
                        isMechanicalLabor={isMechanicalLabor}
                        setIsMechanicalLabor={setIsMechanicalLabor}
                        currProdId={currProdId}
                        setCurrProdId={setCurrProdId}
                        currDosage={currDosage}
                        setCurrDosage={(val) => setCurrDosage(val.replace(',', '.'))}
                        mechanicalLaborName={mechanicalLaborName}
                        setMechanicalLaborName={setMechanicalLaborName}
                        plantingSpacing={plantingSpacing}
                        setPlantingSpacing={(val) => setPlantingSpacing(val.replace(',', '.'))}
                        expectedYield={expectedYield}
                        setExpectedYield={(val) => setExpectedYield(val.replace(',', '.'))}
                        fertilizerPlacement={fertilizerPlacement}
                        setFertilizerPlacement={setFertilizerPlacement}
                        editingItemId={editingItemId}
                        selectedApplicatorId={selectedApplicatorId}
                        setSelectedApplicatorId={setSelectedApplicatorId}
                        servicePrice={servicePrice}
                        setServicePrice={(val) => setServicePrice(val.replace(',', '.'))}
                        selectedPartnerName={selectedPartnerName}
                        selectedInvestors={selectedInvestors}
                        setSelectedInvestors={setSelectedInvestors}
                        setSelectedPartnerName={setSelectedPartnerName}
                        showNotes={showNotes}
                        setShowNotes={setShowNotes}
                        notes={notes}
                        setNotes={setNotes}
                        facturaImageUrl={facturaImageUrl}
                        setFacturaImageUrl={setFacturaImageUrl}
                        remitoImageUrl={remitoImageUrl}
                        setRemitoImageUrl={setRemitoImageUrl}
                        kmlData={kmlData}
                        setKmlData={setKmlData}
                        boundary={boundary}
                        setBoundary={setBoundary}
                        technicalResponsible={technicalResponsible}
                        setTechnicalResponsible={setTechnicalResponsible}
                        subQuantities={subQuantities}
                        setSubQuantities={setSubQuantities}
                        stock={stock}
                        handleAddItem={handleAddItem}
                        handleEditItem={handleEditItem}
                        handleRemoveItem={handleRemoveItem}
                        handleCancelEdit={handleCancelEdit}
                        onBack={() => setStep(1)}
                        onNext={() => setStep(3)}
                        partners={client?.partners || []}
                        investors={client?.investors || []}
                        orderType={selectedFarmId ? 'APPLICATION' : 'SOWING'}
                        selectedCampaignId={selectedCampaignId}
                        setSelectedCampaignId={setSelectedCampaignId}
                        campaigns={enhancedCampaigns}
                        currWarehouseId={currWarehouseId}
                        setCurrWarehouseId={setCurrWarehouseId}
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
                        selectedInvestors={selectedInvestors}
                        campaignName={campaigns.find(c => c.id === selectedCampaignId)?.name}
                        notes={notes}
                        onBack={() => setStep(2)}
                        onSubmit={handleSubmit}
                    />
                )}
            </div>
        </div>
    );
}
