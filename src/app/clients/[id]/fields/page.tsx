'use client';

import { use, useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useFarms, useLots } from '@/hooks/useLocations';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useInventory, useClientStock } from '@/hooks/useInventory';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Farm, Lot, Order, OrderItem, InventoryMovement, Warehouse, ClientStock } from '@/types';
import DynamicMap from '@/components/DynamicMap';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { kml } from '@tmcw/togeojson';
import { ObservationsSection } from '@/components/ObservationsSection';
import { LotHistory } from '@/components/LotHistory';
import { db } from '@/services/db';
import { syncService } from '@/services/sync';
import { supabase } from '@/lib/supabase';

export default function FieldsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { farms, addFarm, updateFarm, deleteFarm, loading: farmsLoading } = useFarms(id);
    const { warehouses } = useWarehouses(id);
    const { products, addProduct } = useInventory();
    const { stock, updateStock } = useClientStock(id);
    const { orders, refreshOrders } = useOrders(id);

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showFarmForm, setShowFarmForm] = useState(false);
    const [newFarmName, setNewFarmName] = useState('');
    const [editingFarmId, setEditingFarmId] = useState<string | null>(null);

    // Selected Farm for adding lots
    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
    const [showLotForm, setShowLotForm] = useState(false);

    // Hoisted Lots State
    const { lots, addLot, updateLot, deleteLot, loading: lotsLoading } = useLots(selectedFarmId || '');
    const [editingLotId, setEditingLotId] = useState<string | null>(null);
    const [lotName, setLotName] = useState('');
    const [lotHectares, setLotHectares] = useState('');
    const [lotCropSpecies, setLotCropSpecies] = useState('');
    const [lotYield, setLotYield] = useState('');
    const [isHarvesting, setIsHarvesting] = useState(false);
    const [observedYield, setObservedYield] = useState('');
    const [harvestLaborPrice, setHarvestLaborPrice] = useState('');
    const [harvestContractor, setHarvestContractor] = useState('');
    const [harvestDate, setHarvestDate] = useState('');
    const [sowingOrder, setSowingOrder] = useState<Order | null>(null);
    const [harvestMovement, setHarvestMovement] = useState<InventoryMovement | null>(null);
    const [harvestPlanOrder, setHarvestPlanOrder] = useState<Order | null>(null);
    const [isEditingHarvestPanel, setIsEditingHarvestPanel] = useState(false);
    const [contractors, setContractors] = useState<{ id: string, username: string }[]>([]);
    const [client, setClient] = useState<any>(null);
    const [selectedHarvestInvestor, setSelectedHarvestInvestor] = useState('');

    // Compute harvest plans map for efficiently checking status per lot
    const harvestPlansByLot = useMemo(() => {
        const map = new Map<string, Order>();
        if (!orders) return map;
        for (const o of orders) {
            if (o.type === 'HARVEST' && o.status === 'CONFIRMED') {
                if (!map.has(o.lotId)) {
                    map.set(o.lotId, o);
                }
            }
        }
        return map;
    }, [orders]);

    useEffect(() => {
        const fetchExtras = async () => {
            const { data: contractorsData } = await supabase
                .from('profiles')
                .select('id, username')
                .eq('role', 'CONTRATISTA');
            if (contractorsData) setContractors(contractorsData);

            const clientData = await db.get('clients', id);
            setClient(clientData);
        };
        fetchExtras();
    }, [id]);


    // Unified Panel State (Observations, Crop Assignment, History)
    const [activePanel, setActivePanel] = useState<{
        type: 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details';
        id: string; // The specific lot or farm ID
        farmId: string;
        lotId?: string;
        name: string;
        subtitle?: string;
    } | null>(null);

    const obsSectionRef = useRef<HTMLDivElement>(null);

    // Auto-close panel when parent context is deselected
    useEffect(() => {
        if (!activePanel) return;

        // If the farm associated with the panel is no longer selected, close it
        if (activePanel.farmId && activePanel.farmId !== selectedFarmId) {
            setActivePanel(null);
            return;
        }

        // If the lot associated with the panel is no longer selected, close it
        if (activePanel.lotId && activePanel.lotId !== selectedLotId) {
            setActivePanel(null);
            return;
        }
    }, [selectedFarmId, selectedLotId, activePanel]);

    const openPanel = (type: 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details', id: string, farmId: string, lotId: string | undefined, name: string, subtitle?: string) => {
        // Toggle if already open with same type and ID
        if (activePanel?.type === type && activePanel?.id === id) {
            setActivePanel(null);
            return;
        }

        setActivePanel({ type, id, farmId, lotId, name, subtitle });
        // Smooth scroll to section
        setTimeout(() => {
            obsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleAddLot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lotName || !lotHectares) return;
        if (!selectedFarmId) return;

        if (editingLotId) {
            // Update
            const lotToUpdate = lots.find(l => l.id === editingLotId);
            if (lotToUpdate) {
                await updateLot({
                    ...lotToUpdate,
                    name: lotName,
                    hectares: parseFloat(lotHectares),
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }
            setEditingLotId(null);
        } else {
            // Create
            await addLot({
                id: generateId(),
                farmId: selectedFarmId,
                name: lotName,
                hectares: parseFloat(lotHectares),
                status: 'EMPTY',
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }

        setLotName('');
        setLotHectares('');
        setShowLotForm(false);
    };

    const handleMarkHarvested = async (lot: Lot) => {
        if (!harvestDate) return alert('Ingrese la fecha de cosecha');

        // Mode 1: Creating a Plan
        if (!harvestPlanOrder) {
            try {
                // Find the latest active sowing order for this lot to link it
                const lastSowing = orders
                    .filter(o => o.lotId === lot.id && o.type === 'SOWING' && (o.status === 'DONE' || o.status === 'PENDING' || o.status === 'CONFIRMED') && !o.deleted)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                await db.put('orders', {
                    id: generateId(),
                    clientId: id,
                    farmId: lot.farmId,
                    lotId: lot.id,
                    type: 'HARVEST',
                    status: 'CONFIRMED',
                    date: harvestDate,
                    expectedYield: observedYield ? parseFloat(observedYield) : 0,
                    servicePrice: harvestLaborPrice ? parseFloat(harvestLaborPrice) : 0,
                    contractorName: harvestContractor,
                    investorName: selectedHarvestInvestor,
                    applicatorId: contractors.find(c => c.username === harvestContractor)?.id,
                    items: [],
                    treatedArea: lot.hectares,
                    plantingDensity: 0,
                    plantingSpacing: 0,
                    sowingOrderId: lastSowing?.id, // Link established here
                    createdBy: displayName || 'Sistema',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    synced: false
                });

                // Trigger refresh 
                await refreshOrders();
                setIsHarvesting(false);
                setObservedYield('');
                setHarvestLaborPrice('');
                setHarvestContractor('');
                setHarvestDate('');
                setSelectedHarvestInvestor('');
            } catch (error) {
                console.error('Error creating harvest plan:', error);
                alert('Error al crear el plan.');
            }
            return;
        }

        // Mode 2: Executing the Plan (Confirming Harvest)
        if (!observedYield) return alert('Ingrese el rinde observado');
        const yieldVal = parseFloat(observedYield);

        const grainName = lot.cropSpecies || 'Granos';
        let product = products.find(p => p.name === grainName && p.type === 'SEED' && p.clientId === id);

        // Fix for legacy bad IDs
        if (product && !/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(product.id)) {
            try {
                await db.delete('products', product.id);
                product = undefined;
            } catch (e) { }
        }

        if (!product && lot.cropSpecies) {
            product = await addProduct({
                clientId: id,
                name: grainName,
                type: 'SEED',
                unit: 'kg',
                price: 0,
                createdAt: new Date().toISOString(),
                synced: false
            });
        }

        if (!product) {
            alert('No se pudo identificar el cultivo del lote.');
            return;
        }

        const allWarehouses = await db.getAll('warehouses') as Warehouse[];
        // Filter by client ID to avoid picking standard warehouses from other clients
        const clientWarehouses = allWarehouses.filter(w => w.clientId === id);
        const harvestWarehouse = clientWarehouses.find((w: Warehouse) => w.name === 'Acopio de Granos');
        if (!harvestWarehouse) {
            alert('No hay un depósito de Cosecha configurado.');
            return;
        }

        try {
            // 1. Update Lot Status
            await updateLot({
                ...lot,
                status: 'HARVESTED',
                observedYield: yieldVal,
                lastUpdatedBy: displayName || 'Sistema'
            });

            // 2. Update Stock (IN)
            const allStock = await db.getAll('stock') as ClientStock[];
            const clientStock = allStock.filter((s: ClientStock) => s.clientId === id);
            const existingStock = clientStock.find((s: ClientStock) => s.productId === product.id && s.warehouseId === harvestWarehouse.id);
            const currentQty = existingStock?.quantity || 0;

            await updateStock({
                id: existingStock?.id,
                clientId: id,
                warehouseId: harvestWarehouse.id,
                productId: product.id,
                quantity: currentQty + yieldVal,
                lastUpdated: new Date().toISOString()
            });

            const movementDate = harvestDate || new Date().toISOString().split('T')[0];

            // 3. Record Movement: HARVEST (Consolidated)
            const farm = farms.find(f => f.id === lot.farmId);
            const pricePerHa = harvestLaborPrice ? parseFloat(harvestLaborPrice) : 0;
            const totalCost = pricePerHa * lot.hectares;

            await db.put('movements', {
                id: generateId(),
                clientId: id,
                warehouseId: harvestWarehouse.id,
                productId: product.id,
                productName: product.name,
                type: 'HARVEST',
                quantity: yieldVal,
                unit: product.unit,
                date: movementDate,
                // Fixed 24h format to avoid "Invalid Date"
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                referenceId: lot.id,
                notes: `Cosecha de lote ${lot.name} (${farm?.name || 'Campo desconocido'})`,
                contractorName: harvestContractor || undefined,
                harvestLaborPricePerHa: pricePerHa || undefined,
                harvestLaborCost: totalCost || undefined,
                investorName: selectedHarvestInvestor || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: new Date().toISOString(),
                synced: false
            });

            // Step 4 (Labor movement) was removed to avoid physical stock confusion

            // 5. Update Order Status
            if (harvestPlanOrder) {
                await db.put('orders', {
                    ...harvestPlanOrder,
                    status: 'DONE',
                    appliedAt: new Date().toISOString(),
                    appliedBy: displayName || 'Sistema',
                    investorName: selectedHarvestInvestor || undefined,
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            } else {
                const lastSowing = orders
                    .filter(o => o.lotId === lot.id && o.type === 'SOWING' && (o.status === 'DONE' || o.status === 'PENDING' || o.status === 'CONFIRMED') && !o.deleted)
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

                await db.put('orders', {
                    id: generateId(),
                    clientId: id,
                    farmId: lot.farmId,
                    lotId: lot.id,
                    type: 'HARVEST',
                    status: 'DONE',
                    date: movementDate,
                    expectedYield: yieldVal,
                    servicePrice: harvestLaborPrice ? parseFloat(harvestLaborPrice) : 0,
                    contractorName: harvestContractor,
                    investorName: selectedHarvestInvestor,
                    applicatorId: contractors.find(c => c.username === harvestContractor)?.id,
                    items: [],
                    treatedArea: lot.hectares,
                    plantingDensity: 0,
                    plantingSpacing: 0,
                    sowingOrderId: lastSowing?.id,
                    createdBy: displayName || 'Sistema',
                    appliedBy: displayName || 'Sistema',
                    appliedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            }

            await refreshOrders(); // Fixed: ensuring state refresh
            syncService.pushChanges();
            setIsHarvesting(false);
            setObservedYield('');
            setHarvestLaborPrice('');
            setHarvestContractor('');
            setHarvestDate('');
            setHarvestPlanOrder(null);
            setSelectedHarvestInvestor('');
        } catch (error) {
            console.error('Error marking harvested:', error);
            alert('Error al registrar la cosecha.');
        }
    };

    const handleCancelHarvest = async (lot: Lot) => {
        if (!confirm('¿Está seguro de cancelar la cosecha de este lote? El lote volverá al estado "Sembrado" y se restará el stock de granos.')) return;

        try {
            // 1. Revert Lot Status to SOWED
            await updateLot({
                ...lot,
                status: 'SOWED',
                observedYield: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });

            // 2. Find and delete Movements
            const allMovements = await db.getAll('movements') as InventoryMovement[];
            const harvestMovements = allMovements.filter(m => m.referenceId === lot.id && m.type === 'HARVEST' && !m.deleted);

            let totalYieldToSubtract = 0;
            let harvestWarehouseId = '';
            let productId = '';

            for (const m of harvestMovements) {
                totalYieldToSubtract += m.quantity;
                harvestWarehouseId = m.warehouseId || harvestWarehouseId;
                productId = m.productId || productId;
                // Soft delete movement
                await db.put('movements', { ...m, deleted: true, updatedAt: new Date().toISOString(), synced: false });
            }

            // Also delete OUT movement for harvest labor if any
            const outMovements = allMovements.filter(m => m.referenceId === lot.id && m.type === 'OUT' && (m.notes?.includes('Labor de cosecha') || m.productId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11') && !m.deleted);
            for (const m of outMovements) {
                await db.put('movements', { ...m, deleted: true, updatedAt: new Date().toISOString(), synced: false });
            }

            // 3. Subtract Stock
            if (harvestWarehouseId && productId) {
                const allStock = await db.getAll('stock') as ClientStock[];
                const existingStock = allStock.find(s => s.productId === productId && s.warehouseId === harvestWarehouseId);
                if (existingStock) {
                    await updateStock({
                        ...existingStock,
                        quantity: existingStock.quantity - totalYieldToSubtract,
                        lastUpdated: new Date().toISOString()
                    });
                }
            }

            // 4. Update Order (Mark HARVEST order as DRAFT or revert it)
            const allOrders = await db.getAll('orders') as Order[];
            const harvestOrders = allOrders.filter(o => o.lotId === lot.id && o.type === 'HARVEST' && o.status === 'DONE' && !o.deleted);
            for (const o of harvestOrders) {
                // Option A: Soft delete the order
                await db.put('orders', { ...o, deleted: true, updatedAt: new Date().toISOString(), synced: false });
                // Option B: Revert to CONFIRMED (if it was a plan)
                // Actually best is to just soft-delete so it can be re-planned
            }

            await refreshOrders();
            syncService.pushChanges();
            alert('Cosecha cancelada correctamente.');
        } catch (error) {
            console.error('Error cancelling harvest:', error);
            alert('Error al cancelar la cosecha.');
        }
    };

    const handleEditLot = (lot: Lot) => {
        setLotName(lot.name);
        setLotHectares(lot.hectares.toString());
        setEditingLotId(lot.id);
        setShowLotForm(true);
        // Clear farm editing
        setEditingFarmId(null);
        setShowFarmForm(false);
    };

    const handleDeleteLot = async (lotId: string) => {
        if (confirm('¿Está seguro de eliminar este lote?')) {
            await deleteLot(lotId, displayName || 'Sistema');
        }
    };

    const handleKmlUpload = async (lot: Lot, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const kmlText = event.target?.result as string;
            try {
                const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
                const geojson = kml(dom);

                await updateLot({
                    ...lot,
                    boundary: geojson as any,
                    kmlData: kmlText,
                    lastUpdatedBy: displayName || 'Sistema'
                });
                alert('KML cargado correctamente.');
            } catch (error) {
                console.error('Error parsing KML:', error);
                alert('Error al procesar el archivo KML. Asegúrese de que sea un archivo válido.');
            }
        };
        reader.readAsText(file);
    };

    const handleFarmKmlUpload = async (farm: Farm, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const kmlText = event.target?.result as string;
            try {
                const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
                const geojson = kml(dom);

                await updateFarm({
                    ...farm,
                    boundary: geojson as any,
                    kmlData: kmlText,
                    lastUpdatedBy: displayName || 'Sistema'
                });
                alert('KML cargado correctamente.');
            } catch (error) {
                console.error('Error parsing KML:', error);
                alert('Error al procesar el archivo KML. Asegúrese de que sea un archivo válido.');
            }
        };
        reader.readAsText(file);
    };

    const handleRemoveFarmKml = async (farm: Farm) => {
        if (!confirm('¿Está seguro de eliminar el KML de este campo?')) return;

        try {
            await updateFarm({
                ...farm,
                boundary: undefined,
                kmlData: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
            alert('KML eliminado correctamente.');
        } catch (error) {
            console.error('Error removing KML:', error);
            alert('Error al eliminar el KML.');
        }
    };

    const handleRemoveLotKml = async (lot: Lot) => {
        if (!confirm('¿Está seguro de eliminar el KML de este lote?')) return;

        try {
            await updateLot({
                ...lot,
                boundary: undefined,
                kmlData: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
            alert('KML eliminado correctamente.');
        } catch (error) {
            console.error('Error removing KML:', error);
            alert('Error al eliminar el KML.');
        }
    };

    const handleClearCrop = async (lot: Lot) => {
        if (!confirm('¿Está seguro de limpiar los datos del cultivo de este lote?')) return;

        try {
            await updateLot({
                ...lot,
                status: 'EMPTY',
                cropSpecies: undefined,
                yield: undefined,
                observedYield: undefined,
                lastUpdatedBy: displayName || 'Sistema'
            });
        } catch (error) {
            console.error('Error clearing crop:', error);
            alert('Error al limpiar el cultivo.');
        }
    };

    const fetchSowingDetails = async (lotId: string) => {
        try {
            const allOrders = await db.getAll('orders') as Order[];
            const sowingOrders = allOrders
                .filter(o => o.clientId === id && o.lotId === lotId && o.type === 'SOWING' && (o.status === 'CONFIRMED' || o.status === 'DONE'))
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Fetch potential harvest plan
            const harvestPlans = allOrders
                .filter(o => o.clientId === id && o.lotId === lotId && o.type === 'HARVEST' && o.status === 'CONFIRMED')
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            if (sowingOrders.length > 0) {
                setSowingOrder(sowingOrders[0]);
            } else {
                setSowingOrder(null);
            }

            if (harvestPlans.length > 0) {
                setHarvestPlanOrder(harvestPlans[0]);
            } else {
                setHarvestPlanOrder(null);
            }
        } catch (error) {
            console.error('Error fetching sowing details:', error);
            setSowingOrder(null);
            setHarvestPlanOrder(null);
        }
    };

    const fetchHarvestDetails = async (lotId: string) => {
        try {
            const allMovements = await db.getAll('movements') as InventoryMovement[];
            const harvestMovements = allMovements
                .filter(m => m.referenceId === lotId && m.type === 'HARVEST')
                .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime());

            if (harvestMovements.length > 0) {
                // Find associated expense movement if any (same date/time or reference logic)
                // Actually we just need to display the harvest movement which contains some metadata, 
                // but wait, we didn't store cost in HARVEST movement, we stored it in OUT movement.
                // BUT we added harvestLaborCost to InventoryMovement, so maybe we SHOULD store it in the HARVEST one too for easier display?
                // In my previous edit I removed line 189 `harvestLaborCost` from HARVEST movement and put it in OUT movement.
                // This makes fetching harder. 
                // Let's modify the fetch to find the OUT movement too, OR fix the previous edit to store metadata in HARVEST too.
                // Storing metadata in HARVEST is redundant but easier for UI.
                // Let's look for the OUT movement with same referenceId.
                const outMovements = allMovements.filter(m => m.referenceId === lotId && m.type === 'OUT' && m.productId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

                const harvest = harvestMovements[0];
                const expense = outMovements.find(m => m.date === harvest.date); // rough matching

                // Combine for display
                setHarvestMovement({
                    ...harvest,
                    harvestLaborCost: expense?.purchasePrice || 0,
                    harvestLaborPricePerHa: expense?.harvestLaborPricePerHa || 0
                });
            } else {
                setHarvestMovement(null);
            }
        } catch (error) {
            console.error('Error fetching harvest details:', error);
            setHarvestMovement(null);
        }
    };

    const handleUpdateHarvest = async (originalHarvest: InventoryMovement, newDate: string, newYield: number, newPrice: number, newContractor: string, newInvestor?: string) => {
        try {
            // 1. Calculate yield difference to adjust stock
            const yieldDiff = newYield - originalHarvest.quantity;

            // 2. Fetch Stock to update
            const stockItem = stock.find(s => s.productId === originalHarvest.productId && s.warehouseId === originalHarvest.warehouseId);
            if (stockItem) {
                await updateStock({
                    ...stockItem,
                    quantity: stockItem.quantity + yieldDiff,
                    lastUpdated: new Date().toISOString()
                });
            }

            // 3. Update HARVEST movement
            await db.put('movements', {
                ...originalHarvest,
                date: newDate,
                quantity: newYield,
                contractorName: newContractor,
                investorName: newInvestor,
                updatedAt: new Date().toISOString(),
                synced: false
            });

            // 4. Update or Create EXPENSE movement
            // Find existing OUT movement
            const allMovements = await db.getAll('movements') as InventoryMovement[];
            const expenseMovement = allMovements.find(m => m.referenceId === originalHarvest.referenceId && m.type === 'OUT' && m.productId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

            const lot = lots.find(l => l.id === originalHarvest.referenceId);
            const totalCost = newPrice * (lot?.hectares || 0);

            if (expenseMovement) {
                await db.put('movements', {
                    ...expenseMovement,
                    date: newDate,
                    purchasePrice: totalCost,
                    harvestLaborPricePerHa: newPrice,
                    harvestLaborCost: totalCost,
                    contractorName: newContractor,
                    investorName: newInvestor,
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            } else if (newPrice > 0) {
                // Create new if it didn't exist but now we have a price
                // We need harvestWarehouseId which is in originalHarvest
                await db.put('movements', {
                    id: generateId(),
                    clientId: id,
                    warehouseId: originalHarvest.warehouseId,
                    productId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
                    productName: 'Egresos de Cosecha (Labor)',
                    type: 'OUT',
                    quantity: 1,
                    unit: 'UN',
                    date: newDate,
                    time: originalHarvest.time,
                    referenceId: originalHarvest.referenceId,
                    purchasePrice: totalCost,
                    harvestLaborPricePerHa: newPrice,
                    harvestLaborCost: totalCost,
                    contractorName: newContractor,
                    notes: `Labor de cosecha - Lote ${lot?.name}`,
                    createdBy: displayName || 'Sistema',
                    createdAt: new Date().toISOString(),
                    synced: false
                });
            }

            // 5. Update Lot observed yield if it matches
            if (lot && lot.status === 'HARVESTED') {
                await updateLot({
                    ...lot,
                    observedYield: newYield,
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }

            syncService.pushChanges();
            alert('Cosecha actualizada correctamente.');
            setIsEditingHarvestPanel(false);
            fetchHarvestDetails(originalHarvest.referenceId); // Refresh
        } catch (error) {
            console.error('Error updating harvest:', error);
            alert('Error al actualizar la cosecha.');
        }
    };

    const handleAddFarm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFarmName) return;

        if (editingFarmId) {
            // Update
            const farmToUpdate = farms.find(f => f.id === editingFarmId);
            if (farmToUpdate) {
                await updateFarm({
                    ...farmToUpdate,
                    name: newFarmName,
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }
            setEditingFarmId(null);
        } else {
            // Create
            await addFarm({
                id: generateId(),
                clientId: id,
                name: newFarmName,
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }
        setNewFarmName('');
        setShowFarmForm(false);
    };

    const handleEditFarm = (farm: Farm) => {
        setNewFarmName(farm.name);
        setEditingFarmId(farm.id);
        setShowFarmForm(true);
        // Clear lot editing
        setEditingLotId(null);
        setShowLotForm(false);
    };

    const handleDeleteFarm = async (farmId: string) => {
        if (confirm('¿Está seguro de eliminar este campo? Se eliminarán también sus lotes.')) {
            await deleteFarm(farmId, displayName || 'Sistema');
            if (selectedFarmId === farmId) setSelectedFarmId(null);
        }
    };

    const cancelEdit = () => {
        setShowFarmForm(false);
        setEditingFarmId(null);
        setNewFarmName('');
    };

    if (role === 'CONTRATISTA') {
        return (
            <div className="p-12 text-center bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="text-4xl mb-4">🚫</div>
                <h2 className="text-xl font-bold text-slate-800">Acceso Denegado</h2>
                <p className="text-slate-500 mt-2">Los contratistas solo tienen acceso a la sección de órdenes asignadas.</p>
                <Link href={`/clients/${id}/orders`} className="inline-block mt-6 text-emerald-600 font-bold hover:underline font-mono">Ir a Mis Órdenes →</Link>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Campos y Lotes</h1>
                    <p className="text-slate-500 mt-1">Administre los campos y sus respectivos lotes.</p>
                </div>
                {!isReadOnly && (
                    <Button onClick={() => {
                        if (showFarmForm) cancelEdit();
                        else setShowFarmForm(true);
                    }}>
                        {showFarmForm ? 'Cancelar' : 'Agregar campo'}
                    </Button>
                )}
            </div>

            {showFarmForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 animate-fadeIn relative">
                    <button
                        onClick={cancelEdit}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        title="Cancelar edición"
                    >
                        ✕
                    </button>
                    <h2 className="text-lg font-semibold text-slate-800 mb-4">{editingFarmId ? 'Editar Campo' : 'Nuevo Campo'}</h2>
                    <form onSubmit={handleAddFarm} className="space-y-4">
                        <div className="flex gap-4 items-end">
                            <Input
                                label="Nombre del Campo"
                                placeholder="ej. La Estelita"
                                value={newFarmName}
                                onChange={e => setNewFarmName(e.target.value)}
                                required
                            />
                            <Button type="submit">{editingFarmId ? '➜' : 'Guardar Campo'}</Button>
                        </div>

                        {editingFarmId && (
                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
                                    {farms.find(f => f.id === editingFarmId)?.boundary ? 'Cambiar KML' : 'Cargar KML'}
                                    <input
                                        type="file"
                                        accept=".kml"
                                        className="hidden"
                                        onChange={(e) => {
                                            const farm = farms.find(f => f.id === editingFarmId);
                                            if (farm) handleFarmKmlUpload(farm, e);
                                        }}
                                    />
                                </label>
                                {farms.find(f => f.id === editingFarmId)?.boundary && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const farm = farms.find(f => f.id === editingFarmId);
                                            if (farm) handleRemoveFarmKml(farm);
                                        }}
                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                        title="Eliminar KML"
                                    >
                                        Eliminar KML
                                    </button>
                                )}
                            </div>
                        )}
                    </form>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-bold text-slate-800">Campos</h2>
                    {farmsLoading ? (
                        <div>Cargando campos...</div>
                    ) : farms.length === 0 ? (
                        <div className="p-8 bg-slate-50 rounded-lg text-center text-slate-500">No hay campos agregados todavía.</div>
                    ) : (
                        farms.map(farm => (
                            <div
                                key={farm.id}
                                className={`p-4 bg-white rounded-xl shadow-sm border cursor-pointer transition-all ${selectedFarmId === farm.id ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300'}`}
                                onClick={() => {
                                    setSelectedFarmId(selectedFarmId === farm.id ? null : farm.id);
                                    setSelectedLotId(null);
                                    setEditingLotId(null);
                                    setShowLotForm(false);
                                }}
                            >
                                <div className="flex flex-col gap-3">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-900 truncate">{farm.name}</h3>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            {farm.boundary && (
                                                <Link
                                                    href={`/clients/${id}/map?selected=${farm.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-1 px-2 text-xs font-semibold bg-emerald-50 text-emerald-700 rounded border border-emerald-100 hover:bg-emerald-100 transition-colors"
                                                >
                                                    Ver mapa
                                                </Link>
                                            )}
                                            {!isReadOnly && (
                                                <>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleEditFarm(farm); }}
                                                        className="p-1 px-2 text-xs font-semibold bg-white text-slate-500 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDeleteFarm(farm.id); }}
                                                        className="p-1 px-2 text-xs font-semibold bg-white text-slate-500 rounded border border-slate-200 hover:border-red-300 hover:text-red-700 transition-colors"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {selectedFarmId === farm.id && (
                                        <div className="flex justify-end pt-2 border-t border-slate-200/50 animate-fadeIn">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    openPanel('observations', farm.id, farm.id, undefined, farm.name);
                                                }}
                                                className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'observations' && activePanel?.id === farm.id
                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                                    }`}
                                            >
                                                Observaciones
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800">Lotes</h2>
                        {!isReadOnly && selectedFarmId && (
                            <Button size="sm" variant="secondary" onClick={() => {
                                // If we are already adding a new lot (form open, no editing ID), toggle off
                                if (showLotForm && !editingLotId) {
                                    setShowLotForm(false);
                                } else {
                                    // Otherwise reset to Add mode
                                    setEditingLotId(null);
                                    setLotName('');
                                    setLotHectares('');
                                    setShowLotForm(true);
                                }
                            }}>
                                {(showLotForm && !editingLotId) ? 'Cancelar' : 'Agregar Lote'}
                            </Button>
                        )}
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 min-h-[400px]">
                        {selectedFarmId ? (
                            <div className="space-y-6">
                                {showLotForm && (
                                    <form onSubmit={handleAddLot} className="space-y-4 bg-slate-50 p-4 rounded-lg animate-fadeIn relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-sm font-semibold text-slate-700">{editingLotId ? 'Editar Lote' : 'Nuevo Lote'}</span>
                                            <div className="flex gap-2">
                                                <Button type="submit" size="sm" className="!p-1 !h-8 !w-8 flex items-center justify-center rounded-full">➜</Button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowLotForm(false);
                                                        setEditingLotId(null);
                                                        setLotName('');
                                                        setLotHectares('');
                                                    }}
                                                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                                    title="Cancelar"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                        <Input
                                            label="Nombre del Lote"
                                            placeholder="ej. Lote 3B"
                                            value={lotName}
                                            onChange={e => setLotName(e.target.value)}
                                            required
                                        />
                                        <Input
                                            label="Hectáreas"
                                            type="number"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={lotHectares}
                                            onChange={e => setLotHectares(e.target.value)}
                                            required
                                        />

                                        {editingLotId && (
                                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
                                                    {lots.find(l => l.id === editingLotId)?.boundary ? 'Cambiar KML' : 'Cargar KML'}
                                                    <input
                                                        type="file"
                                                        accept=".kml"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const lot = lots.find(l => l.id === editingLotId);
                                                            if (lot) handleKmlUpload(lot, e);
                                                        }}
                                                    />
                                                </label>
                                                {lots.find(l => l.id === editingLotId)?.boundary && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const lot = lots.find(l => l.id === editingLotId);
                                                            if (lot) handleRemoveLotKml(lot);
                                                        }}
                                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                                        title="Eliminar KML"
                                                    >
                                                        Eliminar KML
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </form>
                                )}

                                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                                    {lotsLoading ? (
                                        <div className="text-center text-sm text-slate-500">Cargando lotes...</div>
                                    ) : lots.length === 0 ? (
                                        <div className="text-center text-sm text-slate-500 py-4">No hay lotes para este campo.</div>
                                    ) : (
                                        lots
                                            .filter(lot => lot.id !== editingLotId)
                                            .map(lot => {
                                                const lotHarvestPlan = harvestPlansByLot.get(lot.id);
                                                return (
                                                    <div key={lot.id}>
                                                        <div
                                                            className={`flex flex-col gap-3 p-3 rounded-xl border-2 transition-all group cursor-pointer ${selectedLotId === lot.id ? 'border-emerald-500 bg-slate-50' : 'bg-slate-50 border-slate-100'}`}
                                                            onClick={() => setSelectedLotId(selectedLotId === lot.id ? null : lot.id)}
                                                        >
                                                            {/* Line 1: Identity & Admin Actions */}
                                                            <div className="flex justify-between items-center">
                                                                <div className="flex items-center gap-2 overflow-hidden">
                                                                    <span className="font-bold text-slate-900 truncate">{lot.name}</span>
                                                                    <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase tracking-widest flex-shrink-0">{lot.hectares} ha</span>
                                                                </div>

                                                                {!isReadOnly && (
                                                                    <div className="flex gap-2 flex-shrink-0 mt-0.5">
                                                                        <Link
                                                                            href={`/clients/${id}/map?selected=${lot.id}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className={`text-xs font-semibold px-2 py-1 rounded border transition-colors ${lot.boundary
                                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed hidden'}`}
                                                                        >
                                                                            Ver mapa
                                                                        </Link>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleEditLot(lot);
                                                                            }}
                                                                            className="text-xs font-semibold bg-white text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                                                                        >
                                                                            Editar
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeleteLot(lot.id);
                                                                            }}
                                                                            className="text-xs font-semibold bg-white text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-red-300 hover:text-red-700 transition-colors"
                                                                        >
                                                                            Eliminar
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Selected View: 3-Line Layout */}
                                                            {selectedLotId === lot.id && (
                                                                <div className="flex flex-col gap-2 pt-2 border-t border-slate-200/50 animate-fadeIn">
                                                                    {/* Line 2: Status & Action Buttons */}
                                                                    <div className="flex justify-between items-center">
                                                                        <div>
                                                                            {lot.status && (
                                                                                <div className="flex items-center gap-2">
                                                                                    <span
                                                                                        title={lot.status === 'SOWED' ? 'Sembrado' :
                                                                                            lot.status === 'HARVESTED' ? 'Cosechado' :
                                                                                                lot.status === 'NOT_SOWED' ? 'Asignado' : 'Vacío'}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            e.preventDefault();
                                                                                            if (lot.status === 'SOWED') {
                                                                                                await fetchSowingDetails(lot.id);
                                                                                                openPanel('sowing_details', lot.id, selectedFarmId!, lot.id, lot.name, `Datos de Siembra - ${lot.name}`);
                                                                                            } else if (lot.status === 'HARVESTED') {
                                                                                                await fetchHarvestDetails(lot.id);
                                                                                                openPanel('harvest_details', lot.id, selectedFarmId!, lot.id, lot.name);
                                                                                            }
                                                                                        }}
                                                                                        className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-lg border shadow-sm transition-all relative z-10 ${lot.status === 'SOWED'
                                                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200 hover:scale-110'
                                                                                            : lot.status === 'HARVESTED' ? 'bg-blue-100 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-200 hover:scale-110' :
                                                                                                lot.status === 'NOT_SOWED' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                                                                    'bg-slate-100 text-slate-500 border-slate-200'
                                                                                            }`}
                                                                                    >
                                                                                        {lot.status === 'SOWED' ? 'S' :
                                                                                            lot.status === 'HARVESTED' ? 'C' :
                                                                                                lot.status === 'NOT_SOWED' ? 'A' : 'V'}
                                                                                    </span>
                                                                                    {(lot.status === 'HARVESTED' || lot.status === 'SOWED') && (
                                                                                        <div className="flex gap-1">
                                                                                            {lot.status === 'HARVESTED' && (
                                                                                                <button
                                                                                                    onClick={(e) => {
                                                                                                        e.stopPropagation();
                                                                                                        handleCancelHarvest(lot);
                                                                                                    }}
                                                                                                    className="text-[10px] font-bold text-orange-500 hover:text-orange-700 bg-white px-2 py-0.5 rounded border border-slate-200 hover:border-orange-200 transition-colors uppercase tracking-tight"
                                                                                                >
                                                                                                    Cancelar Cosecha
                                                                                                </button>
                                                                                            )}
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleClearCrop(lot);
                                                                                                }}
                                                                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-white px-2 py-0.5 rounded border border-slate-200 hover:border-red-200 transition-colors uppercase tracking-tight"
                                                                                            >
                                                                                                Reiniciar Lote
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        {!isReadOnly && (
                                                                            <div className="flex ml-auto">
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        openPanel('observations', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                                                                    }}
                                                                                    className={`text-xs font-bold px-3 py-1.5 rounded border transition-all ${activePanel?.type === 'observations' && activePanel?.id === lot.id
                                                                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                        : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 shadow-sm'
                                                                                        }`}
                                                                                >
                                                                                    Observaciones
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Line 3: Crop Info (Clean & Simple) */}
                                                                    {lot.cropSpecies && lot.status !== 'EMPTY' && (
                                                                        <div className="text-[11px] font-bold text-slate-500 px-0.5 flex items-center gap-1.5 w-full">
                                                                            <span className="text-emerald-700 font-black uppercase tracking-widest">{lot.cropSpecies}</span>
                                                                            {(!lot.status || lot.status === 'SOWED' || lot.status === 'NOT_SOWED') && !harvestPlansByLot.get(lot.id) && (
                                                                                !isHarvesting && (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            fetchSowingDetails(lot.id);
                                                                                            setIsHarvesting(true);
                                                                                            setHarvestPlanOrder(null); // Mode: New Plan
                                                                                            setIsEditingHarvestPanel(true); // Mode: Edit
                                                                                            setSelectedLotId(lot.id);
                                                                                        }}
                                                                                        className="ml-auto text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm uppercase tracking-wider"
                                                                                    >
                                                                                        Plan. Cosecha
                                                                                    </button>
                                                                                )
                                                                            )}

                                                                            {/* 3. If Plan Exists -> Show "Marcar Cosechado" Button (Blue) + "Editar Plan" (Grey) */}
                                                                            {lotHarvestPlan && (
                                                                                (!lot.status || lot.status !== 'HARVESTED') ? (
                                                                                    <div className="ml-auto flex items-center gap-2">
                                                                                        {!isHarvesting && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setIsEditingHarvestPanel(true);
                                                                                                    setHarvestDate(lotHarvestPlan.date);
                                                                                                    setHarvestContractor(lotHarvestPlan.contractorName || '');
                                                                                                    setHarvestLaborPrice(lotHarvestPlan.servicePrice?.toString() || '');
                                                                                                    setSelectedLotId(lot.id);
                                                                                                    setHarvestPlanOrder(lotHarvestPlan); // Set current plan
                                                                                                    setIsHarvesting(true);
                                                                                                }}
                                                                                                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2 py-0.5 rounded border border-slate-200 hover:border-blue-200 transition-colors uppercase tracking-tight"
                                                                                            >
                                                                                                Editar Plan
                                                                                            </button>
                                                                                        )}

                                                                                        {!isHarvesting && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setActivePanel(null);
                                                                                                    setIsHarvesting(true);
                                                                                                    setHarvestPlanOrder(lotHarvestPlan); // Mode: Execute Plan
                                                                                                    setIsEditingHarvestPanel(false); // Mode: Execute
                                                                                                    setHarvestDate(lotHarvestPlan.date);
                                                                                                    setHarvestContractor(lotHarvestPlan.contractorName || '');
                                                                                                    setHarvestLaborPrice(lotHarvestPlan.servicePrice?.toString() || '');
                                                                                                    setSelectedLotId(lot.id);
                                                                                                }}
                                                                                                title="Cosecha planificada - Click para confirmar"
                                                                                                className="text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm uppercase tracking-wider"
                                                                                            >
                                                                                                Marcar Cosechado
                                                                                            </button>
                                                                                        )}
                                                                                    </div>
                                                                                ) : null
                                                                            )}
                                                                        </div>
                                                                    )}

                                                                    {/* Inline Harvest Form */}
                                                                    {isHarvesting && selectedLotId === lot.id && (
                                                                        <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm animate-fadeIn cursor-default" onClick={e => e.stopPropagation()}>
                                                                            <h4 className="text-xs font-bold text-blue-800 mb-3 uppercase tracking-wide">
                                                                                {harvestPlanOrder ? 'Confirmar Cosecha' : 'Planificar Cosecha'}
                                                                            </h4>
                                                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                                                                                <Input
                                                                                    label="Fecha"
                                                                                    type="date"
                                                                                    value={harvestDate}
                                                                                    onChange={e => setHarvestDate(e.target.value)}
                                                                                    className="bg-white"
                                                                                />
                                                                                <div>
                                                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Contratista</label>
                                                                                    <select
                                                                                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                                                                        value={harvestContractor}
                                                                                        onChange={e => setHarvestContractor(e.target.value)}
                                                                                    >
                                                                                        <option value="">Seleccionar...</option>
                                                                                        {contractors.map(c => (
                                                                                            <option key={c.id} value={c.username}>{c.username}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>

                                                                                {harvestPlanOrder && (
                                                                                    <Input
                                                                                        label="Rinde Real (kg)"
                                                                                        type="number"
                                                                                        value={observedYield}
                                                                                        onChange={e => setObservedYield(e.target.value)}
                                                                                        className="bg-white"
                                                                                    />
                                                                                )}
                                                                                <Input
                                                                                    label="Precio Labor (USD/ha)"
                                                                                    type="number"
                                                                                    value={harvestLaborPrice}
                                                                                    onChange={e => setHarvestLaborPrice(e.target.value)}
                                                                                    className="bg-white"
                                                                                />
                                                                                <div>
                                                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Pagado por</label>
                                                                                    <select
                                                                                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                                                                        value={selectedHarvestInvestor}
                                                                                        onChange={e => setSelectedHarvestInvestor(e.target.value)}
                                                                                    >
                                                                                        <option value="">Seleccionar...</option>
                                                                                        {client?.partners?.map((p: any) => (
                                                                                            <option key={p.name} value={p.name}>{p.name} {p.cuit ? `(CUIT: ${p.cuit})` : ''}</option>
                                                                                        ))}
                                                                                        {(!client?.partners || client.partners.length === 0) && client?.investors?.map((inv: any) => (
                                                                                            <option key={inv.name} value={inv.name}>{inv.name}</option>
                                                                                        ))}
                                                                                    </select>
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex justify-end gap-2">
                                                                                <button
                                                                                    onClick={() => setIsHarvesting(false)}
                                                                                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:bg-slate-50 uppercase tracking-wider"
                                                                                >
                                                                                    Cancelar
                                                                                </button>
                                                                                <button
                                                                                    onClick={() => handleMarkHarvested(lot)}
                                                                                    className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 shadow-sm uppercase tracking-wider"
                                                                                >
                                                                                    {harvestPlanOrder ? 'Confirmar Cosecha' : 'Guardar Plan'}
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    )}

                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )
                                    }
                                </div>


                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                <div className="text-4xl mb-2">🚜</div>
                                <p>Seleccione un Campo para gestionar lotes</p>
                            </div>
                        )}
                    </div>

                    {selectedLotId && (
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => {
                                    const lot = lots.find(l => l.id === selectedLotId);
                                    if (lot) {
                                        openPanel('history', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg border-2 font-bold text-xs uppercase tracking-wider transition-all shadow-sm
                                ${activePanel?.type === 'history'
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                        : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md'
                                    }`}
                            >
                                Ver Historial del Lote
                            </button>
                        </div>
                    )}
                </div>
            </div>


            {
                activePanel && (
                    <div
                        ref={obsSectionRef}
                        className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg animate-fadeIn ring-1 ring-slate-100 scroll-mt-6"
                    >
                        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                            <div className="flex items-center gap-4 flex-1 overflow-hidden">
                                <h2 className="text-lg font-bold text-slate-800 flex-shrink-0">
                                    {activePanel.type === 'observations' ? 'Observaciones' :
                                        activePanel.type === 'crop_assign' ? (lots.find(l => l.id === activePanel.id)?.status === 'NOT_SOWED' ? 'Editar Cultivo' : 'Asignar Cultivo') :
                                            activePanel.type === 'sowing_details' ? 'Detalle de Siembra' :
                                                activePanel.type === 'harvest_details' ? `Detalle de Cosecha - ${activePanel.name}` : 'Historial del Lote'}
                                </h2>
                                <div className="hidden md:block w-px h-5 bg-slate-300"></div>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                                        {activePanel.name}
                                    </span>
                                    {activePanel.subtitle && (
                                        <span className="text-xs text-slate-500 truncate">
                                            {activePanel.subtitle}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activePanel.type === 'crop_assign' && lots.find(l => l.id === activePanel.id)?.status === 'NOT_SOWED' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            const lot = lots.find(l => l.id === activePanel.id);
                                            if (lot) {
                                                await updateLot({
                                                    ...lot,
                                                    cropSpecies: '',
                                                    yield: 0,
                                                    status: 'EMPTY',
                                                    lastUpdatedBy: displayName || 'Sistema'
                                                });
                                                setActivePanel(null);
                                            }
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 text-xs font-bold uppercase tracking-widest mr-2"
                                    >
                                        Eliminar asignación
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => setActivePanel(null)} className="text-slate-400 hover:text-slate-600 text-xs font-bold uppercase tracking-widest">
                                    ✕ Cerrar
                                </Button>
                            </div>
                        </div>
                        <div className="px-2 pb-2">
                            {activePanel.type === 'observations' && (
                                <ObservationsSection
                                    clientId={id}
                                    farmId={activePanel.farmId}
                                    lotId={activePanel.lotId}
                                />
                            )}
                            {activePanel.type === 'crop_assign' && (
                                <div className="p-6 bg-white animate-fadeIn">
                                    {(() => {
                                        const cp = activePanel;
                                        if (!cp || cp.type !== 'crop_assign') return null;
                                        const lot = lots.find(l => l.id === cp.id);
                                        if (!lot) return null;
                                        return (
                                            <form
                                                onSubmit={async (e) => {
                                                    e.preventDefault();
                                                    const formData = new FormData(e.currentTarget);
                                                    const crop = formData.get('crop') as string;
                                                    const expectedYield = formData.get('yield') as string;

                                                    await updateLot({
                                                        ...lot,
                                                        cropSpecies: crop,
                                                        yield: parseFloat(expectedYield) || 0,
                                                        status: crop ? 'NOT_SOWED' : (lot.status === 'EMPTY' || !lot.status ? 'EMPTY' : lot.status),
                                                        lastUpdatedBy: displayName || 'Sistema'
                                                    });
                                                    setActivePanel(null);
                                                }}
                                                className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
                                            >
                                                <div className="md:col-span-1">
                                                    <Input
                                                        name="crop"
                                                        label="Especie / Cultivo"
                                                        placeholder="ej. Maíz"
                                                        defaultValue={lot.cropSpecies || ''}
                                                    />
                                                </div>
                                                <div className="md:col-span-1">
                                                    <Input
                                                        name="yield"
                                                        label="Rinde Esperado (kg/ha)"
                                                        type="number"
                                                        placeholder="0"
                                                        defaultValue={lot.yield?.toString() || ''}
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
                                    <LotHistory clientId={id} lotId={activePanel.id} />
                                </div>
                            )}
                            {activePanel.type === 'sowing_details' && (
                                <div className="p-6 bg-white animate-fadeIn">
                                    {sowingOrder ? (
                                        <div className="space-y-6">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Fecha de Siembra</div>
                                                    <div className="font-mono text-slate-800">{new Date(sowingOrder.date.includes('T') ? sowingOrder.date : sowingOrder.date + 'T12:00:00').toLocaleDateString()}</div>
                                                </div>
                                                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Orden #</div>
                                                    <div className="font-mono text-slate-800">{sowingOrder.orderNumber || '-'}</div>
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
                                                        <div className="font-mono text-slate-800">{new Date(harvestMovement.date.includes('T') ? harvestMovement.date : harvestMovement.date + 'T12:00:00').toLocaleDateString()}</div>
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
                                                                <option key={p.name} value={p.name}>{p.name} {p.cuit ? `(CUIT: ${p.cuit})` : ''}</option>
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
                )
            }
        </div>
    );
}
