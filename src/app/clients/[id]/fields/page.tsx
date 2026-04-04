'use client';

import { use, useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useFarms, useLots, useAllLots } from '@/hooks/useLocations';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useInventory, useClientStock, useClientMovements } from '@/hooks/useInventory';
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
import { FarmCard } from './components/FarmCard';
import { LotCard } from './components/LotCard';
import { SidePanels } from './components/SidePanels';
import { HarvestWizard } from '@/components/HarvestWizard';
import { OrderDetailView } from '@/components/OrderDetailView';
import { MovementDetailsView } from '@/components/MovementDetailsView';
import { HarvestDetailsView } from '@/components/HarvestDetailsView';
import { normalizeNumber } from '@/lib/numbers';
import { processHarvest } from '@/services/harvest';
import { 
    calculateInvestorBreakdown, 
    calculateCampaignPartnerShares,
    calculateCampaignPartnerInvestment 
} from '@/utils/financial';

type PanelType = 'observations' | 'crop_assign' | 'history' | 'sowing_details' | 'harvest_details';

export default function FieldsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const { role, isMaster, profile, displayName } = useAuth();
    const { farms, addFarm, updateFarm, deleteFarm, loading: farmsLoading } = useFarms(id);
    const { warehouses } = useWarehouses(id);
    const { products, addProduct } = useInventory();
    const { stock, updateStock } = useClientStock(id);
    const { orders, refreshOrders } = useOrders(id);
    const { campaigns, loading: campaignsLoading } = useCampaigns(id);
    const { movements } = useClientMovements(id);
    const campaignShares = useMemo(() =>
        calculateCampaignPartnerShares(movements, orders)
        , [movements, orders]);

    const campaignInvestments = useMemo(() =>
        calculateCampaignPartnerInvestment(movements, orders)
        , [movements, orders]);

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showFarmForm, setShowFarmForm] = useState(false);
    const [newFarmName, setNewFarmName] = useState('');
    const [newFarmAddress, setNewFarmAddress] = useState('');
    const [newFarmCity, setNewFarmCity] = useState('');
    const [newFarmProvince, setNewFarmProvince] = useState('');
    const [editingFarmId, setEditingFarmId] = useState<string | null>(null);

    // Selected Farm for adding lots
    const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
    const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
    const [showLotForm, setShowLotForm] = useState(false);

    // Hoisted Lots State
    const { lots, addLot, updateLot, deleteLot, loading: lotsLoading } = useLots(selectedFarmId || '');
    const { lots: allClientLots } = useAllLots(id);
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
    const [harvestTechnicalResponsible, setHarvestTechnicalResponsible] = useState('');
    const [sowingOrder, setSowingOrder] = useState<Order | null>(null);
    const [harvestMovement, setHarvestMovement] = useState<InventoryMovement | null>(null);
    const [harvestMovements, setHarvestMovements] = useState<InventoryMovement[]>([]);
    const [harvestPlanOrder, setHarvestPlanOrder] = useState<Order | null>(null);
    const [isEditingHarvestPanel, setIsEditingHarvestPanel] = useState(false);
    const [contractors, setContractors] = useState<{ id: string, username: string }[]>([]);
    const [client, setClient] = useState<any>(null);
    const [selectedHarvestInvestor, setSelectedHarvestInvestor] = useState('');
    const [selectedHarvestWarehouseId, setSelectedHarvestWarehouseId] = useState('');
    const [selectedHarvestCampaignId, setSelectedHarvestCampaignId] = useState('');
    const [harvestType, setHarvestType] = useState<'SEMILLA' | 'GRANO'>('GRANO');
    const [tempFarmKmlData, setTempFarmKmlData] = useState<string | null>(null);
    const [tempFarmBoundary, setTempFarmBoundary] = useState<any>(null);
    const [tempLotKmlData, setTempLotKmlData] = useState<string | null>(null);
    const [tempLotBoundary, setTempLotBoundary] = useState<any>(null);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

    const refreshMovements = useClientMovements(id).refresh;

    const getSowingTooltip = (lotId: string) => {
        if (!orders) return 'Sembrado';
        const sowings = orders.filter(o =>
            (o.lotId === lotId || o.lotIds?.includes(lotId)) &&
            o.type === 'SOWING' &&
            (o.status === 'CONFIRMED' || o.status === 'DONE') &&
            !o.deleted
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (sowings.length === 0) return 'Sembrado';

        return sowings.map(s => {
            const ha = s.lotHectares?.[lotId] ?? s.treatedArea;
            const crop = s.items.find(i => i.productType === 'SEED')?.productName || 'Semilla';
            const dateStr = new Date(s.date).toLocaleDateString('es-AR');
            return `${ha.toFixed(1)} ha - ${crop} - ${dateStr}`;
        }).join('\n');
    };

    // Compute harvest plans map for efficiently checking status per lot
    const harvestPlansByLot = useMemo(() => {
        const map = new Map<string, Order>();
        if (!orders) return map;
        for (const o of orders) {
            if (o.type === 'HARVEST' && o.status === 'CONFIRMED') {
                // Support both legacy single-lot and new multi-lot formats
                const lotIds = o.lotIds || (o.lotId ? [o.lotId] : []);
                for (const lid of lotIds) {
                    if (!map.has(lid)) {
                        map.set(lid, o);
                    }
                }
            }
        }
        return map;
    }, [orders]);

    useEffect(() => {
        const fetchExtras = async () => {
            const { data: contractorsData } = await supabase
                .from('profiles')
                .select('id, username, assigned_clients')
                .eq('role', 'CONTRATISTA');

            if (contractorsData) {
                // Filter contractors assigned to this specific client
                const filtered = contractorsData.filter(c =>
                    c.assigned_clients && c.assigned_clients.includes(id)
                );
                setContractors(filtered);
            }

            const clientData = await db.get('clients', id);
            setClient(clientData);
        };
        fetchExtras();
    }, [id]);


    // Unified Panel State (Observations, Crop Assignment, History)
    const [activePanel, setActivePanel] = useState<{
        type: PanelType | null;
        id: string | null;
        farmId: string | null;
        lotId: string | null;
        name: string | null;
        subtitle?: string | null;
    } | null>(null);

    const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
    const [selectedMovement, setSelectedMovement] = useState<any | null>(null);

    const obsSectionRef = useRef<HTMLDivElement>(null);
    const historySectionRef = useRef<HTMLDivElement>(null);
    const detailSectionRef = useRef<HTMLDivElement>(null);
    const logisticsSectionRef = useRef<HTMLDivElement>(null);

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

    const openPanel = (
        type: PanelType,
        id: string,
        farmId: string | null,
        lotId: string | null,
        name: string,
        subtitle?: string | null
    ) => {
        // If clicking same history lot, toggle close
        if (type === 'history' && activePanel?.type === 'history' && activePanel.lotId === lotId) {
            setActivePanel(null);
            // We KEEP selectedEvent and selectedMovement open as per the user's request
            return;
        }

        setActivePanel({ type, id, farmId, lotId, name, subtitle });
        setSelectedEvent(null);
        setSelectedMovement(null);

        // Scroll to history if needed
        if (type === 'history') {
            setTimeout(() => {
                historySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        } else {
            obsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleAddLot = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!lotName || !lotHectares) return;
        if (!selectedFarmId) return;

        if (editingLotId) {
            // Update
            await updateLot({
                id: editingLotId,
                clientId: id,
                farmId: selectedFarmId!,
                name: lotName,
                hectares: parseFloat(lotHectares),
                lastUpdatedBy: displayName || 'Sistema'
            });
        } else {
            // Create
            await addLot({
                id: generateId(),
                clientId: id,
                farmId: selectedFarmId!,
                name: lotName,
                hectares: parseFloat(lotHectares),
                status: 'EMPTY',
                boundary: tempLotBoundary || undefined,
                kmlData: tempLotKmlData || undefined,
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }

        setLotName('');
        setLotHectares('');
        setEditingLotId(null);
        setTempLotBoundary(null);
        setTempLotKmlData(null);
        setShowLotForm(false);
    };


    const handleMarkHarvested = async (lot: Lot, data: any) => {
        try {
            await processHarvest({
                db,
                clientId: id,
                lot,
                data,
                campaigns,
                products,
                identity: { displayName: displayName || 'Sistema' },
                updaters: {
                    updateStock,
                    updateLot: (l) => db.put('lots', l),
                    addProduct
                },
                isEditing: isEditingHarvestPanel,
                existingBatchId: harvestPlanOrder?.harvestBatchId,
                existingOrder: harvestPlanOrder
            });

            // Post-process UI state
            setIsHarvesting(false);
            setHarvestPlanOrder(null);
            setIsEditingHarvestPanel(false);
            window.dispatchEvent(new CustomEvent('lotsUpdated'));
            refreshOrders();
        } catch (error: any) {
            console.error(error);
            alert(error.message || 'Error al procesar la cosecha.');
        }
    };

    const handleUpdateHarvest = async (movement: InventoryMovement, date: string, quantity: number, pricePerHa: number, contractor: string, investorName: string) => {
        try {
            const lotId = movement.referenceId;
            const lot = allClientLots.find(l => l.id === lotId);
            if (!lot) return;

            const totalCost = pricePerHa * lot.hectares;

            // 1. Calculate yield difference to adjust stock
            const yieldDiff = quantity - movement.quantity;

            // 2. Fetch Stock to update
            const stockItem = stock.find(s => s.productId === movement.productId && s.warehouseId === movement.warehouseId);
            if (stockItem) {
                await updateStock({
                    ...stockItem,
                    quantity: stockItem.quantity + yieldDiff,
                    lastUpdated: new Date().toISOString()
                });
            }

            // 3. Update the primary movement (and its siblings if any)
            const allMovements = await db.getAll('movements') as InventoryMovement[];
            const relatedMovements = allMovements.filter(m => m.referenceId === lotId && m.date === movement.date && m.type === 'HARVEST' && !m.deleted);

            // Update movements
            for (const m of relatedMovements) {
                const isFirst = relatedMovements.indexOf(m) === 0;
                await db.put('movements', {
                    ...m,
                    date,
                    quantity: relatedMovements.length === 1 ? quantity : m.quantity, // Only update if single
                    harvestLaborPricePerHa: pricePerHa,
                    harvestLaborCost: isFirst ? totalCost : 0,
                    contractorName: contractor,
                    investorName: investorName,
                    harvestBatchId: m.harvestBatchId,
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            }

            // 4. Update the Order
            const allOrders = await db.getAll('orders') as Order[];
            const harvestOrder = allOrders.find(o => o.lotId === lotId && o.type === 'HARVEST' && o.date === movement.date && o.status === 'DONE' && !o.deleted);
            if (harvestOrder) {
                await db.put('orders', {
                    ...harvestOrder,
                    date,
                    expectedYield: quantity,
                    servicePrice: pricePerHa,
                    contractorName: contractor,
                    investorName: investorName,
                    harvestBatchId: harvestOrder.harvestBatchId,
                    updatedAt: new Date().toISOString(),
                    synced: false
                });
            }

            // 5. Update Lot Rinde if applicable
            await updateLot({
                ...lot,
                observedYield: quantity,
                lastUpdatedBy: displayName || 'Sistema'
            });

            await refreshOrders();
            await syncService.pushChanges();
            setIsEditingHarvestPanel(false);
            setHistoryRefreshKey(prev => prev + 1);
            // alert('Cosecha actualizada correctamente.');
        } catch (error) {
            console.error('Error updating harvest:', error);
            alert('Error al actualizar la cosecha.');
        }
    };

    const handleEditHarvest = (event: any) => {
        // Find lot and farm
        const lotId = activePanel?.lotId || activePanel?.id;
        const lot = lots.find(l => l.id === lotId);
        const farm = farms.find(f => f.id === selectedFarmId);

        if (!lot || !farm) return;

        // 1. Prepare wizard states
        // 1. Aggregate ALL transport sheets from all related movements
        const eventMovements = (event.movements || [event]);
        const allSheets: any[] = [];
        eventMovements.forEach((m: any) => {
            if (m.transportSheets) {
                m.transportSheets.forEach((s: any) => {
                    if (!allSheets.find(existing => existing.id === s.id)) {
                        allSheets.push(s);
                    }
                });
            }
        });

        // 2. Prepare wizard states
        setHarvestDate(event.date);
        setHarvestContractor(event.contractorName || '');
        setObservedYield(event.observedYield?.toString() || event.quantity?.toString() || '');
        setHarvestLaborPrice(event.harvestLaborPricePerHa?.toString() || event.movements?.[0]?.harvestLaborPricePerHa?.toString() || '');
        setSelectedHarvestInvestor(event.investorName || event.movements?.[0]?.investorName || '');
        setSelectedHarvestCampaignId(event.campaignId || event.movements?.[0]?.campaignId || '');
        setHarvestTechnicalResponsible(event.technicalResponsible || event.movements?.[0]?.technicalResponsible || '');

        // 3. Open Wizard in Edit Mode
        setHarvestPlanOrder({
            ...event,
            transportSheets: allSheets // Pass the aggregated sheets
        });
        setIsEditingHarvestPanel(true);
        setIsHarvesting(true);
        setSelectedLotId(lot.id);

        // 3. Scroll to it
        setTimeout(() => {
            const anchor = document.getElementById('harvest-wizard-scroll-anchor');
            anchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    };

    const handleCancelHarvest = async (lot: Lot) => {
        if (!confirm('¿Está seguro de cancelar la cosecha de este lote? El lote volverá al estado "Sembrado" y se restará el stock de granos.')) return;

        try {
            // 1. Revert Lot Status to SOWED
            await updateLot({
                ...lot,
                status: 'SOWED',
                observedYield: undefined,
                lastHarvestId: undefined, // Clear batch link
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

            // 4. Update Order (Mark HARVEST order as DELETED)
            const allOrders = await db.getAll('orders') as Order[];
            const harvestOrders = allOrders.filter(o => o.lotId === lot.id && o.type === 'HARVEST' && o.status === 'DONE' && !o.deleted);
            for (const o of harvestOrders) {
                await db.put('orders', { ...o, deleted: true, updatedAt: new Date().toISOString(), synced: false });
            }

            await refreshOrders();
            setHistoryRefreshKey(prev => prev + 1);
            await syncService.pushChanges();
            alert('Cosecha cancelada correctamente.');
        } catch (error) {
            console.error('Error cancelling harvest:', error);
            alert('Error al cancelar la cosecha.');
        }
    };

    const handleDeleteHarvestBatch = async (batchId: string, lotId: string) => {
        if (!confirm('¿Está seguro de eliminar esta cosecha del historial? Se restará el stock y se borrarán los registros.')) return;

        try {
            const lot = allClientLots.find(l => l.id === lotId);
            if (!lot) return;

            const isCurrentHarvest = lot.status === 'HARVESTED' && lot.lastHarvestId === batchId;

            if (!isCurrentHarvest && lot.lastHarvestId !== batchId) {
                alert("No se puede. Opción: Editar el rinde total a 0");
                return;
            }

            // 1. Fetch ALL batch movements
            const allMovements = await db.getAll('movements') as InventoryMovement[];
            const batchMovements = allMovements.filter(m => m.harvestBatchId === batchId && !m.deleted);

            // 2. Revert Stock for each movement
            for (const mov of batchMovements) {
                const items = mov.items && mov.items.length > 0 ? mov.items : [{
                    productId: mov.productId,
                    quantity: mov.quantity,
                    productBrand: mov.productBrand,
                    presentationLabel: mov.presentationLabel,
                    presentationContent: mov.presentationContent,
                    presentationAmount: mov.presentationAmount
                }];

                const allStock = await db.getAll('stock') as ClientStock[];
                for (const it of items) {
                    const existing = allStock.find(s =>
                        s.productId === it.productId &&
                        s.warehouseId === mov.warehouseId &&
                        s.clientId === id
                    );
                    if (existing) {
                        await updateStock({
                            ...existing,
                            quantity: existing.quantity - it.quantity,
                            presentationAmount: existing.presentationAmount !== undefined 
                                ? (existing.presentationAmount - (it.presentationAmount || 0))
                                : undefined,
                            lastUpdated: new Date().toISOString()
                        });
                    }
                }

                // 3. Soft Delete Movement
                await db.put('movements', { ...mov, deleted: true, updatedAt: new Date().toISOString(), synced: false });
            }

            // 4. Delete associated order
            const allOrders = await db.getAll('orders') as Order[];
            const batchOrder = allOrders.find(o => o.harvestBatchId === batchId && !o.deleted);
            if (batchOrder) {
                await db.put('orders', { ...batchOrder, deleted: true, updatedAt: new Date().toISOString(), synced: false });
            }

            // 5. Revert Lot state if it was current
            if (isCurrentHarvest) {
                await updateLot({
                    ...lot,
                    status: 'SOWED',
                    observedYield: undefined,
                    lastHarvestId: undefined,
                    lastUpdatedBy: displayName || 'Sistema'
                });
            }

            setHistoryRefreshKey(prev => prev + 1);
            await syncService.pushChanges();
            alert('Cosecha eliminada correctamente.');
        } catch (error) {
            console.error('Error deleting harvest batch:', error);
            alert('Error al eliminar la cosecha.');
        }
    };

    const handleEditLot = (lot: Lot) => {
        setSelectedFarmId(lot.farmId);
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

    const parseKml = (kmlText: string) => {
        const dom = new DOMParser().parseFromString(kmlText, 'text/xml');
        return kml(dom);
    };

    const handleKmlUpload = async (lot: Lot, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            const kmlText = event.target?.result as string;
            try {
                const geojson = parseKml(kmlText);

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
                const geojson = parseKml(kmlText);

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
            const hms = allMovements.filter(m => m.referenceId === lotId && m.type === 'HARVEST' && m.productName !== 'Labor de Cosecha');
            setHarvestMovements(hms);

            if (hms.length > 0) {
                const harvest = hms[0];
                // rough matching for expense
                const expense = allMovements.find(m => m.referenceId === lotId && m.type === 'OUT' && m.productId === 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' && m.date === harvest.date);

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
                    address: newFarmAddress,
                    city: newFarmCity,
                    province: newFarmProvince,
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
                address: newFarmAddress,
                city: newFarmCity,
                province: newFarmProvince,
                boundary: tempFarmBoundary || undefined,
                kmlData: tempFarmKmlData || undefined,
                createdBy: displayName || 'Sistema',
                lastUpdatedBy: displayName || 'Sistema'
            });
        }
        setNewFarmName('');
        setNewFarmAddress('');
        setNewFarmCity('');
        setNewFarmProvince('');
        setTempFarmBoundary(null);
        setTempFarmKmlData(null);
        setShowFarmForm(false);
    };

    const handleEditFarm = (farm: Farm) => {
        setNewFarmName(farm.name);
        setNewFarmAddress(farm.address || '');
        setNewFarmCity(farm.city || '');
        setNewFarmProvince(farm.province || '');
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
        setNewFarmAddress('');
        setNewFarmCity('');
        setNewFarmProvince('');
        setTempFarmBoundary(null);
        setTempFarmKmlData(null);
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
                    <form onSubmit={handleAddFarm} className="space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-800">{editingFarmId ? 'Editar Campo' : 'Nuevo Campo'}</h2>
                            <div className="flex gap-2">
                                <Button type="submit" size="sm" className="!p-1 !h-8 !w-8 flex items-center justify-center rounded-full">➜</Button>
                                <button
                                    type="button"
                                    onClick={cancelEdit}
                                    className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                    title="Cancelar"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4 items-end">
                            <div className="flex-1">
                                <Input
                                    label="Nombre del Campo"
                                    placeholder="ej. La Estelita"
                                    value={newFarmName}
                                    onChange={e => setNewFarmName(e.target.value)}
                                    required
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Input
                                label="Dirección"
                                placeholder="ej. Ruta 8 Km 10"
                                value={newFarmAddress}
                                onChange={e => setNewFarmAddress(e.target.value)}
                            />
                            <Input
                                label="Ciudad"
                                placeholder="ej. Pergamino"
                                value={newFarmCity}
                                onChange={e => setNewFarmCity(e.target.value)}
                            />
                            <Input
                                label="Provincia"
                                placeholder="ej. Buenos Aires"
                                value={newFarmProvince}
                                onChange={e => setNewFarmProvince(e.target.value)}
                            />
                        </div>

                        {!editingFarmId && (
                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
                                    {tempFarmKmlData ? 'KML Cargado (Cambiar)' : 'Cargar KML'}
                                    <input
                                        type="file"
                                        accept=".kml"
                                        className="hidden"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                                const kmlText = event.target?.result as string;
                                                try {
                                                    const geojson = parseKml(kmlText);
                                                    setTempFarmBoundary(geojson);
                                                    setTempFarmKmlData(kmlText);
                                                } catch (err) {
                                                    alert('Error al procesar KML.');
                                                }
                                            };
                                            reader.readAsText(file);
                                        }}
                                    />
                                </label>
                                {tempFarmKmlData && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTempFarmKmlData(null);
                                            setTempFarmBoundary(null);
                                        }}
                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                    >
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        )}

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
                    <div className="flex justify-between items-center min-h-[36px]">
                        <h2 className="text-xl font-bold text-slate-800">Campos</h2>
                    </div>
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
                                                        openPanel('observations', farm.id, farm.id, null, farm.name);
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
                    <div className="flex justify-between items-center min-h-[36px]">
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

                                        {!editingLotId && (
                                            <div className="pt-2 border-t border-slate-200 flex gap-2">
                                                <label className="flex-1 text-xs font-semibold bg-white text-slate-500 px-3 py-2 rounded-lg border border-slate-200 hover:border-emerald-300 hover:text-emerald-700 transition-all cursor-pointer flex items-center justify-center gap-2">
                                                    {tempLotKmlData ? 'KML Cargado (Cambiar)' : 'Cargar KML'}
                                                    <input
                                                        type="file"
                                                        accept=".kml"
                                                        className="hidden"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            const reader = new FileReader();
                                                            reader.onload = (event) => {
                                                                const kmlText = event.target?.result as string;
                                                                try {
                                                                    const geojson = parseKml(kmlText);
                                                                    setTempLotBoundary(geojson);
                                                                    setTempLotKmlData(kmlText);
                                                                } catch (err) {
                                                                    alert('Error al procesar KML.');
                                                                }
                                                            };
                                                            reader.readAsText(file);
                                                        }}
                                                    />
                                                </label>
                                                {tempLotKmlData && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setTempLotKmlData(null);
                                                            setTempLotBoundary(null);
                                                        }}
                                                        className="px-3 py-2 text-xs font-semibold text-red-500 bg-red-50 rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
                                                    >
                                                        Eliminar
                                                    </button>
                                                )}
                                            </div>
                                        )}

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
                                    ) : lots.filter(lot => lot.farmId === selectedFarmId && lot.id !== editingLotId).length === 0 ? (
                                        <div className="text-center text-sm text-slate-500 py-4">No hay lotes para este campo.</div>
                                    ) : (
                                        lots
                                            .filter(lot => lot.farmId === selectedFarmId && lot.id !== editingLotId)
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

                                                                <div className="flex gap-2 flex-shrink-0 mt-0.5">
                                                                    {lot.boundary && (
                                                                        <Link
                                                                            href={`/clients/${id}/map?selected=${lot.id}`}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="text-xs font-semibold px-2 py-1 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors"
                                                                        >
                                                                            Ver mapa
                                                                        </Link>
                                                                    )}
                                                                    {!isReadOnly && (
                                                                        <>
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
                                                                        </>
                                                                    )}
                                                                </div>
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
                                                                                        title={lot.status === 'SOWED' ? getSowingTooltip(lot.id) :
                                                                                            lot.status === 'HARVESTED' ? 'Cosechado' :
                                                                                                lot.status === 'NOT_SOWED' ? 'Asignado' : 'Vacío'}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            e.preventDefault();
                                                                                            if (lot.status === 'SOWED') {
                                                                                                await fetchSowingDetails(lot.id);
                                                                                                openPanel('sowing_details', lot.id, selectedFarmId!, lot.id, lot.name, `${farms.find(f => f.id === selectedFarmId)?.name}`);
                                                                                            } else if (lot.status === 'HARVESTED') {
                                                                                                await fetchHarvestDetails(lot.id);
                                                                                                openPanel('harvest_details', lot.id, selectedFarmId!, lot.id, lot.name);
                                                                                            }
                                                                                        }}
                                                                                        className={`text-[10px] font-bold flex items-center justify-center leading-none rounded border transition-all relative z-10 ${lot.status === 'SOWED'
                                                                                            ? 'bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer hover:bg-emerald-200 hover:scale-110 px-2 py-0.5'
                                                                                            : lot.status === 'HARVESTED' ? 'bg-blue-100 text-blue-700 border-blue-200 cursor-pointer hover:bg-blue-200 hover:scale-110 px-2 py-[1px]' :
                                                                                                lot.status === 'NOT_SOWED' ? 'bg-yellow-100 text-yellow-700 border-yellow-200 px-2 py-0.5' :
                                                                                                    'bg-slate-100 text-slate-500 border-slate-200 px-2 py-0.5'
                                                                                            }`}
                                                                                    >
                                                                                        {lot.status === 'SOWED' ? 'S' :
                                                                                            lot.status === 'HARVESTED' ? 'C' :
                                                                                                lot.status === 'NOT_SOWED' ? 'A' : 'V'}
                                                                                    </span>
                                                                                    {/* Buttons moved back here */}
                                                                                    {/* Buttons hidden for clients */}
                                                    {!isReadOnly && lot.status === 'HARVESTED' && (
                                                                                        <div className="flex gap-1 ml-2">
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleCancelHarvest(lot);
                                                                                                }}
                                                                                                title="Cancelar Cosecha"
                                                                                                className="text-[10px] font-bold text-orange-500 hover:text-orange-700 bg-white px-2 py-0.5 rounded border border-orange-200 hover:border-orange-300 transition-colors uppercase tracking-tight flex items-center justify-center leading-none"
                                                                                            >
                                                                                                Cancelar
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    handleClearCrop(lot);
                                                                                                }}
                                                                                                title="Reiniciar Lote"
                                                                                                className="text-[10px] font-bold text-red-500 hover:text-red-700 bg-white px-2 py-0.5 rounded border border-red-200 hover:border-red-300 transition-colors uppercase tracking-tight flex items-center justify-center leading-none"
                                                                                            >
                                                                                                Reiniciar
                                                                                            </button>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>

                                                                        <div className="flex ml-auto">
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    openPanel('observations', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                                                                }}
                                                                                className={`text-[10px] font-bold px-2 py-0.5 rounded border transition-all uppercase tracking-tight ${activePanel?.type === 'observations' && activePanel?.id === lot.id
                                                                                    ? 'bg-emerald-600 text-white border-emerald-600'
                                                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'
                                                                                    }`}
                                                                            >
                                                                                Observaciones
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {/* Line 3: Crop Info (Clean & Simple) */}
                                                                    {lot.cropSpecies && lot.status !== 'EMPTY' && (
                                                                        <div className="text-[11px] font-bold text-slate-500 px-0.5 flex items-center gap-1.5 w-full">
                                                                            <span className="text-emerald-700 font-black uppercase tracking-widest">{lot.cropSpecies}</span>

                                                                            {/* Reset / Cancel Buttons moved here */}

                                                                            {lot.status === 'SOWED' && (
                                                                                !isReadOnly && !isHarvesting && (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            fetchSowingDetails(lot.id);
                                                                                            setIsHarvesting(true);
                                                                                            setHarvestPlanOrder(null);
                                                                                            setIsEditingHarvestPanel(false);
                                                                                            setSelectedLotId(lot.id);
                                                                                            setHarvestDate(new Date().toISOString().split('T')[0]);

                                                                                            // Default warehouse selection
                                                                                            const defaultWarehouse = warehouses.find(w => w.name === 'Acopio de Granos');
                                                                                            if (defaultWarehouse) {
                                                                                                setSelectedHarvestWarehouseId(defaultWarehouse.id);
                                                                                            } else if (warehouses.length > 0) {
                                                                                                setSelectedHarvestWarehouseId(warehouses[0].id);
                                                                                            }
                                                                                        }}
                                                                                        className="ml-auto text-[10px] font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded border border-blue-200 hover:bg-blue-100 transition-colors shadow-sm uppercase tracking-wider"
                                                                                    >
                                                                                        Cosechar
                                                                                    </button>
                                                                                )
                                                                            )}

                                                                            {/* 3. If Plan Exists -> Show "Marcar Cosechado" Button (Blue) + "Editar Plan" (Grey) */}
                                                                            {lotHarvestPlan && (
                                                                                (!lot.status || lot.status !== 'HARVESTED') ? (
                                                                                    <div className="ml-auto flex items-center gap-2">
                                                                                        {!isReadOnly && !isHarvesting && (
                                                                                            <button
                                                                                                onClick={(e) => {
                                                                                                    e.stopPropagation();
                                                                                                    setIsEditingHarvestPanel(false);
                                                                                                    setHarvestDate(lotHarvestPlan.date);
                                                                                                    setHarvestContractor(lotHarvestPlan.contractorName || '');
                                                                                                    setHarvestLaborPrice(lotHarvestPlan.servicePrice?.toString() || '');
                                                                                                    setSelectedLotId(lot.id);
                                                                                                    setHarvestPlanOrder(lotHarvestPlan); // Set current plan
                                                                                                    setIsHarvesting(true);

                                                                                                    // Default warehouse selection
                                                                                                    const defaultWarehouse = warehouses.find(w => w.name === 'Acopio de Granos');
                                                                                                    if (defaultWarehouse) {
                                                                                                        setSelectedHarvestWarehouseId(defaultWarehouse.id);
                                                                                                    } else if (warehouses.length > 0) {
                                                                                                        setSelectedHarvestWarehouseId(warehouses[0].id);
                                                                                                    }
                                                                                                }}
                                                                                                className="text-[10px] font-bold text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 px-2 py-0.5 rounded border border-slate-200 hover:border-blue-200 transition-colors uppercase tracking-tight"
                                                                                            >
                                                                                                Editar Plan
                                                                                            </button>
                                                                                        )}

                                                                                        {!isReadOnly && !isHarvesting && (
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

                                                                                                    // Default warehouse selection
                                                                                                    const defaultWarehouse = warehouses.find(w => w.name === 'Acopio de Granos');
                                                                                                    if (defaultWarehouse) {
                                                                                                        setSelectedHarvestWarehouseId(defaultWarehouse.id);
                                                                                                    } else if (warehouses.length > 0) {
                                                                                                        setSelectedHarvestWarehouseId(warehouses[0].id);
                                                                                                    }
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
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                    )}
                                </div>


                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                <div className="text-4xl mb-2">🚜</div>
                                <p>Seleccione un Campo para gestionar lotes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {selectedLotId && (
                <div className="container mx-auto max-w-7xl mt-4 px-4 lg:px-8">
                    <div className="flex justify-end">
                        <button
                            onClick={() => {
                                const lot = lots.find(l => l.id === selectedLotId);
                                if (lot) {
                                    openPanel('history', lot.id, selectedFarmId!, lot.id, lot.name, `Lote de ${farms.find(f => f.id === selectedFarmId)?.name}`);
                                }
                            }}
                            className={`px-4 py-2 rounded-lg border-2 font-bold text-xs uppercase tracking-wider transition-all shadow-sm
                                ${activePanel?.type === 'history' && activePanel.lotId === selectedLotId
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300 hover:text-emerald-700 hover:shadow-md'
                                }`}
                        >
                            {activePanel?.type === 'history' && activePanel.lotId === selectedLotId ? 'Cerrar Historial del Lote' : 'Ver Historial del Lote'}
                        </button>
                    </div>
                </div>
            )}

            {activePanel && (
                <div className="container mx-auto max-w-7xl px-4 lg:px-8 pb-20">
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
                                                activePanel.type === 'harvest_details' ? 'Detalle de Cosecha' : 'Historial del Lote'}
                                </h2>
                                <div className="hidden md:block w-px h-5 bg-slate-300"></div>
                                <div className="flex items-center gap-2 overflow-hidden text-[10px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    <span>{activePanel.subtitle ? `${activePanel.subtitle.replace('Lote de ', '')} - ` : ''}{activePanel.name}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {activePanel.type === 'crop_assign' && lots.find(l => l.id === activePanel.id)?.status === 'NOT_SOWED' && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={async () => {
                                            const lot = lots.find(l => l.id === activePanel?.id);
                                            if (lot) {
                                                await updateLot({
                                                    ...lot,
                                                    id: lot.id,
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
                                <div ref={obsSectionRef} className="p-6 bg-white animate-fadeIn">
                                    <ObservationsSection
                                        clientId={id}
                                        farmId={activePanel.farmId!}
                                        lotId={activePanel.lotId || undefined}
                                        isReadOnly={isReadOnly}
                                    />
                                </div>
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
                                                        id: lot.id,
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
                                <div ref={historySectionRef} className="p-0 bg-white shadow-inner">
                                    <LotHistory
                                        clientId={id}
                                        lotId={activePanel.id!}
                                        refreshKey={historyRefreshKey}
                                        onSelectEvent={setSelectedEvent}
                                        onEditEvent={handleEditHarvest}
                                        onDeleteBatch={handleDeleteHarvestBatch}
                                        isReadOnly={isReadOnly}
                                    />

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
                                                    <div className="text-xs text-slate-500 uppercase font-bold mb-1">Rinde Esperado (kg/ha)</div>
                                                    <div className="font-mono text-slate-800">
                                                        {(() => {
                                                            const lot = lots.find(l => l.id === activePanel?.id);
                                                            const yieldVal = lot?.yield || sowingOrder.expectedYield;
                                                            return yieldVal ? `${yieldVal.toLocaleString()} kg/ha` : '-';
                                                        })()}
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
                            {activePanel?.type === 'harvest_details' && (
                                <div className="p-6 bg-white animate-fadeIn">
                                    {harvestMovement ? (
                                        !isEditingHarvestPanel ? (
                                            <HarvestDetailsView
                                                harvestMovement={harvestMovement}
                                                harvestMovements={harvestMovements}
                                                client={profile as any}
                                                warehouses={warehouses}
                                                farms={farms}
                                                lots={allClientLots}
                                                campaigns={campaigns}
                                                onClose={() => setActivePanel(null)}
                                                onEdit={() => handleEditHarvest(harvestMovement)}
                                                isReadOnly={isReadOnly}
                                            />
                                        ) : null
                                    ) : (
                                        <div className="text-center py-8 text-slate-400">
                                            <p>No se encontró información de la cosecha.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* SEPARATE FLOATING BOX FOR DETAILS (Level 3) */}
                    {selectedEvent && (
                        <div
                            ref={detailSectionRef}
                            className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg animate-fadeIn ring-1 ring-slate-100 scroll-mt-24"
                        >
                            <div className="px-0 pb-0">
                                {selectedEvent.type === 'HARVEST' ? (
                                    <HarvestDetailsView
                                        harvestMovement={selectedEvent.movements[0]}
                                        harvestMovements={selectedEvent.movements}
                                        client={client as any}
                                        warehouses={warehouses}
                                        farms={farms}
                                        lots={allClientLots}
                                        campaigns={campaigns}
                                        onClose={() => setSelectedEvent(null)}
                                        onEdit={() => handleEditHarvest(selectedEvent)}
                                        onSelectMovement={(m) => {
                                            setSelectedMovement({
                                                m,
                                                destName: m.receiverName || warehouses.find(w => w.id === m.warehouseId)?.name || 'Desconocido'
                                            });
                                            setTimeout(() => {
                                                logisticsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }, 100);
                                        }}
                                        isReadOnly={isReadOnly}
                                    />
                                ) : (
                                    selectedEvent.rawOrder && (
                                        <OrderDetailView
                                            order={selectedEvent.rawOrder}
                                            client={client!}
                                            warehouses={warehouses}
                                            lots={allClientLots}
                                            campaigns={campaigns}
                                            onClose={() => setSelectedEvent(null)}
                                            onEdit={() => router.push(`/clients/${id}/orders/new?editId=${selectedEvent.rawOrder.id}`)}
                                            isReadOnly={isReadOnly}
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* SEPARATE FLOATING BOX FOR MOVEMENTS (Level 4) */}
            {selectedMovement && (
                <div
                    ref={logisticsSectionRef}
                    className="mt-8 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg animate-fadeIn ring-1 ring-slate-100 scroll-mt-24 border-t-4 border-t-amber-500"
                >
                    <MovementDetailsView
                        movement={selectedMovement.m}
                        client={client!}
                        destName={selectedMovement.destName}
                        typeLabel="Distribución de Cosecha"
                        onClose={() => setSelectedMovement(null)}
                        onEdit={() => handleEditHarvest(selectedEvent)}
                        isReadOnly={isReadOnly}
                    />
                </div>
            )}

            {/* WIZARD CONTAINER (Always at bottom of flow) */}
            <div id="harvest-wizard-scroll-anchor" className="container mx-auto max-w-7xl px-4 lg:px-8 pb-32">
                {isHarvesting && selectedLotId && (
                    <div className="mt-8 animate-fadeIn">
                        <HarvestWizard
                            lot={lots.find(l => l.id === selectedLotId)!}
                            farm={farms.find(f => f.id === selectedFarmId)!}
                            contractors={contractors}
                            campaigns={campaigns}
                            warehouses={warehouses}
                            partners={client?.partners || []}
                            investors={client?.investors || []}
                            campaignShares={campaignShares}
                            campaignInvestments={campaignInvestments}
                            movements={movements}
                            onCancel={() => {
                                setIsHarvesting(false);
                                setHistoryRefreshKey(prev => prev + 1);
                            }}
                            onComplete={async (data) => {
                                await handleMarkHarvested(lots.find(l => l.id === selectedLotId)!, data);
                                setHistoryRefreshKey(prev => prev + 1);
                            }}
                            initialDate={harvestDate}
                            initialContractor={harvestContractor}
                            initialLaborPrice={harvestLaborPrice}
                            initialYield={observedYield}
                            initialTechnicalResponsible={harvestTechnicalResponsible}
                            isExecutingPlan={!isEditingHarvestPanel}
                            initialDistributions={(harvestPlanOrder as any)?.movements?.map((m: any) => ({
                                id: m.id,
                                type: m.receiverName ? 'PARTNER' : 'WAREHOUSE',
                                targetId: m.warehouseId || m.receiverName,
                                targetName: m.receiverName || warehouses.find(w => w.id === m.warehouseId)?.name || 'Desconocido',
                                amount: m.quantity,
                                logistics: m as any
                            })) || []}
                            initialTransportSheets={
                                isEditingHarvestPanel
                                    ? ((harvestPlanOrder as any)?.transportSheets || [])
                                    : undefined
                            }
                            defaultWhId={client?.defaultHarvestWarehouseId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
