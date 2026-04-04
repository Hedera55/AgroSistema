'use client';

import React, { use, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useClientStock, useInventory, useClientMovements } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCampaigns } from '@/hooks/useCampaigns';
import { useOrders } from '@/hooks/useOrders';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { ProductType, Unit, InventoryMovement, MovementItem, ClientStock, Product, Observation } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { syncService } from '@/services/sync';
import { supabase } from '@/lib/supabase';
import { calculateCampaignPartnerShares } from '@/utils/financial';
import { StockMovementPanel } from '@/components/StockMovementPanel';
import { usePDF } from '@/hooks/usePDF';
import { WarehouseManager } from './components/WarehouseManager';
import { ProductCatalog } from './components/ProductCatalog';
import { StockEntryForm } from './components/StockEntryForm';
import { StockTable } from './components/StockTable';
import { StockSalePanel } from '@/components/StockSalePanel';
import { useMovementEditor } from '@/hooks/useMovementEditor';

interface EnrichedStockItem extends ClientStock {
    productName: string;
    warehouseName: string;
    productType: ProductType;
    unit: Unit;
    price: number;
    productBrand?: string;
    productCommercialName?: string;
    hasProduct: boolean;
    campaignId?: string;
    breakdown?: ClientStock[];
}

const productTypes: ProductType[] = ['HERBICIDE', 'FERTILIZER', 'SEED', 'GRAIN', 'FUNGICIDE', 'INSECTICIDE', 'COADYUVANTE', 'INOCULANTE', 'OTHER'];

const typeLabels: Record<string, string> = {
    HERBICIDE: 'Herbicida',
    FERTILIZER: 'Fertilizante',
    SEED: 'Semilla',
    FUNGICIDE: 'Fungicida',
    INSECTICIDE: 'Insecticida',
    INOCULANTE: 'Inoculante',
    GRAIN: 'Grano',
    OTHER: 'Otro'
};

export default function ClientStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { stock, updateStock, deleteStock, loading: stockLoading } = useClientStock(id);
    const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loading: warehousesLoading } = useWarehouses(id);
    const { products, addProduct, updateProduct, deleteProduct, loading: productsLoading } = useInventory(); // Added deleteProduct
    const { movements, loading: movementsLoading, refresh: movementsRefresh } = useClientMovements(id);
    const { campaigns, loading: campaignsLoading } = useCampaigns(id);
    const { orders } = useOrders(id);

    const editor = useMovementEditor(id, {
        productsData: Object.fromEntries(products.map(p => [p.id, p])),
        campaigns: campaigns || [],
        stock: stock || [],
        updateStock: updateStock,
        onSuccess: () => {
            setShowStockForm(false);
            movementsRefresh();
        }
    });

    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));

    const [showStockForm, setShowStockForm] = useState(false);
    const [showProductForm, setShowProductForm] = useState(false);
    const [showCatalog, setShowCatalog] = useState(false);
    const [showWarehouses, setShowWarehouses] = useState(false);
    const [showWarehouseForm, setShowWarehouseForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Active Warehouse context
    const [activeWarehouseIds, setActiveWarehouseIds] = useState<string[]>([]);
    const [editingWarehouseId, setEditingWarehouseId] = useState<string | null>(null);
    const [selectedInManagerId, setSelectedInManagerId] = useState<string | null>(null); // For click interaction
    const [editName, setEditName] = useState('');


    // Stock Selection state
    const [selectedStockIds, setSelectedStockIds] = useState<string[]>([]);
    const [showMovePanel, setShowMovePanel] = useState(false);

    // New entry state
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [newProductName, setNewProductName] = useState('');
    const [newProductBrand, setNewProductBrand] = useState('');
    const [newProductCommercialName, setNewProductCommercialName] = useState('');
    const [newProductPA, setNewProductPA] = useState('');
    const [newProductType, setNewProductType] = useState<ProductType>('HERBICIDE');
    const [newProductUnit, setNewProductUnit] = useState<Unit>('L');
    const [availableUnits, setAvailableUnits] = useState<string[]>(['L', 'KG']);
    const [availableSellers, setAvailableSellers] = useState<string[]>([]);
    const [unitsLoaded, setUnitsLoaded] = useState(false);
    const [sellersLoaded, setSellersLoaded] = useState(false);
    const [showUnitInput, setShowUnitInput] = useState(false);
    const [showUnitDelete, setShowUnitDelete] = useState(false);
    const [showSellerInput, setShowSellerInput] = useState(false);
    const [showSellerDelete, setShowSellerDelete] = useState(false);
    const [unitInputValue, setUnitInputValue] = useState('');
    const [sellerInputValue, setSellerInputValue] = useState('');
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);
    const [newProductPresentations, setNewProductPresentations] = useState<{ label: string; content: number }[]>([]);

    // Factura upload state
    const [sellingStockId, setSellingStockId] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [saleNote, setSaleNote] = useState('');
    const [showSaleNote, setShowSaleNote] = useState(false);
    const [saleFacturaFile, setSaleFacturaFile] = useState<File | null>(null);
    const [saleRemitoFile, setSaleRemitoFile] = useState<File | null>(null);
    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [facturaDate, setFacturaDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');

    const [facturaUploading, setFacturaUploading] = useState(false);
    const [remitoUploading, setRemitoUploading] = useState(false);

    // New Sale Fields
    const [saleDestination, setSaleDestination] = useState('');
    const [saleTruckDriver, setSaleTruckDriver] = useState('');
    const [salePlateNumber, setSalePlateNumber] = useState('');
    const [saleTrailerPlate, setSaleTrailerPlate] = useState('');
    const [saleHumidity, setSaleHumidity] = useState('');
    const [saleDischargeNumber, setSaleDischargeNumber] = useState('');
    const [saleTransportCompany, setSaleTransportCompany] = useState('');
    const [saleHectoliterWeight, setSaleHectoliterWeight] = useState('');
    const [saleGrossWeight, setSaleGrossWeight] = useState('');
    const [saleTareWeight, setSaleTareWeight] = useState('');
    const [salePrimarySaleCuit, setSalePrimarySaleCuit] = useState('');
    const [saleDepartureDateTime, setSaleDepartureDateTime] = useState('');
    const [saleDistanceKm, setSaleDistanceKm] = useState('');
    const [saleFreightTariff, setSaleFreightTariff] = useState('');
    const [saleDestinationCompany, setSaleDestinationCompany] = useState('');
    const [saleDestinationAddress, setSaleDestinationAddress] = useState('');
    const [selectedSeller, setSelectedSeller] = useState('');

    // Success Ribbon State
    const [lastMovement, setLastMovement] = useState<InventoryMovement | null>(null);
    const [lastAction, setLastAction] = useState<'IN' | 'WITHDRAW' | 'TRANSFER' | 'SALE' | null>(null);
    const [lastTransferOrigin, setLastTransferOrigin] = useState<string>('');

    const { generateRemitoPDF } = usePDF();

    const unitInputRef = useRef<HTMLDivElement>(null);
    const warehouseContainerRef = useRef<HTMLDivElement>(null);

    const handleClearSelection = React.useCallback(() => {
        setSelectedStockIds([]);
        setShowMovePanel(false);
    }, []);

    const deductStockQuantity = React.useCallback(async (productId: string, brand: string, qtyToDeduct: number, warehouseId?: string) => {
        // Find all stock items for this product/brand in the specific warehouse(s)
        const candidates = stock.filter(s =>
            s.productId === productId &&
            (s.productBrand || '').toLowerCase().trim() === (brand || '').toLowerCase().trim() &&
            (warehouseId ? s.warehouseId === warehouseId : true)
        ).sort((a, b) => {
            // Priority: items with no presentation details first (cleanup generic stock), then smallest quantities
            const aHasPresentation = !!(a.presentationLabel || a.presentationContent);
            const bHasPresentation = !!(b.presentationLabel || b.presentationContent);
            if (aHasPresentation !== bHasPresentation) return aHasPresentation ? 1 : -1;
            return a.quantity - b.quantity;
        });

        let remaining = qtyToDeduct;
        for (const item of candidates) {
            if (remaining <= 0) break;

            if (item.quantity <= remaining + 0.0001) { // Add small epsilon for floating point
                remaining -= item.quantity;
                await deleteStock(item.id);
            } else {
                await updateStock({
                    ...item,
                    quantity: item.quantity - remaining,
                    lastUpdated: new Date().toISOString()
                });
                remaining = 0;
            }
        }
        return remaining <= 0.0001;
    }, [stock, deleteStock, updateStock]);

    const handleFacturaChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFacturaFile(e.target.files[0]);
        }
    }, []);

    // Upload factura to Supabase Storage and return public URL
    const uploadFactura = useCallback(async (movementId: string) => {
        if (!facturaFile) return '';
        const fileExt = facturaFile.name.split('.').pop();
        const filePath = `${id}/facturas/${movementId}.${fileExt}`;
        const { data, error } = await supabase.storage
            .from('facturas')
            .upload(filePath, facturaFile, { upsert: true });
        if (error) {
            console.error('Factura upload error:', error);
            return '';
        }
        const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
        return publicUrlData.publicUrl;
    }, [id, facturaFile]);

    const [client, setClient] = useState<any>(null);
    useEffect(() => {
        db.get('clients', id).then(setClient);
    }, [id]);

    const handleSetDefaultWarehouse = React.useCallback(async (warehouseId: string) => {
        if (!client) return;
        const updatedClient = { ...client, defaultHarvestWarehouseId: warehouseId, updatedAt: new Date().toISOString(), synced: false };
        await db.put('clients', updatedClient);
        setClient(updatedClient);
        syncService.pushChanges();
    }, [client]);

    const handleReorderWarehouses = React.useCallback(async (newOrder: string[]) => {
        if (!client) return;
        const updatedClient = { ...client, warehouseOrder: newOrder, updatedAt: new Date().toISOString(), synced: false };
        await db.put('clients', updatedClient);
        setClient(updatedClient);
        syncService.pushChanges();
    }, [client]);


    // Auto-set "Acopio de Granos" as default if none set
    useEffect(() => {
        if (client && !client.defaultHarvestWarehouseId && warehouses.length > 0) {
            const acopio = warehouses.find(w => w.name.trim().toLowerCase() === 'acopio de granos');
            if (acopio) {
                handleSetDefaultWarehouse(acopio.id);
            }
        }
    }, [client, warehouses, handleSetDefaultWarehouse]);

    const handleAddWarehouse = React.useCallback(async (name: string) => {
        await addWarehouse(name);
    }, [addWarehouse]);

    const handleCancelMove = React.useCallback(() => setShowMovePanel(false), []);
    const handleCloseSale = React.useCallback(() => setSellingStockId(null), []);
    const handleToggleWarehouses = React.useCallback(() => setShowWarehouses(prev => !prev), []);
    const handleToggleCatalog = React.useCallback(() => setShowCatalog(prev => !prev), []);

    const clientInvestors = useMemo(() =>
        [...(client?.partners || []), ...(client?.investors || [])]
        , [client?.investors, client?.partners]);

    const campaignShares = useMemo(() =>
        calculateCampaignPartnerShares(movements, orders)
        , [movements, orders]);

    // Persistence for form state
    useEffect(() => {
        const savedNote = localStorage.getItem(`stock_note_${id}`);
        const savedShowNote = localStorage.getItem(`stock_showNote_${id}`);

        if (savedNote) editor.setNote(savedNote);
        if (savedShowNote === 'true') editor.setShowNote(true);

        const savedShowStockForm = localStorage.getItem(`stock_showStockForm_${id}`);
        const savedShowProductForm = localStorage.getItem(`stock_showProductForm_${id}`);
        const savedShowCatalog = localStorage.getItem(`stock_showCatalog_${id}`);
        const savedShowWarehouses = localStorage.getItem(`stock_showWarehouses_${id}`);
        const savedActiveW = localStorage.getItem(`stock_activeW_${id}`);

        if (savedShowStockForm === 'true') setShowStockForm(true);
        if (savedShowProductForm === 'true') setShowProductForm(true);
        if (savedShowCatalog === 'true') setShowCatalog(true);
        if (savedShowWarehouses === 'true') setShowWarehouses(true);
        if (savedActiveW) {
            try {
                setActiveWarehouseIds(JSON.parse(savedActiveW));
            } catch (e) {
                console.error("Error parsing savedActiveW", e);
            }
        }
    }, [id]);

    const toggleWarehouseSelection = React.useCallback((warehouseId: string) => {
        setActiveWarehouseIds(prev =>
            prev.includes(warehouseId)
                ? prev.filter(id => id !== warehouseId)
                : [...prev, warehouseId]
        );
    }, []);

    const setAllWarehouses = React.useCallback((ids: string[]) => {
        setActiveWarehouseIds(ids);
    }, []);

    useEffect(() => {
        localStorage.setItem(`stock_showStockForm_${id}`, showStockForm.toString());
    }, [showStockForm, id]);

    useEffect(() => {
        localStorage.setItem(`stock_showProductForm_${id}`, showProductForm.toString());
    }, [showProductForm, id]);

    useEffect(() => {
        localStorage.setItem(`stock_showCatalog_${id}`, showCatalog.toString());
    }, [showCatalog, id]);

    useEffect(() => {
        localStorage.setItem(`stock_showWarehouses_${id}`, showWarehouses.toString());
    }, [showWarehouses, id]);

    const isFirstMountActiveW = useRef(true);
    useEffect(() => {
        if (isFirstMountActiveW.current) {
            isFirstMountActiveW.current = false;
            return;
        }
        localStorage.setItem(`stock_activeW_${id}`, JSON.stringify(activeWarehouseIds));
    }, [activeWarehouseIds, id]);

    // Default selection when id changes
    useEffect(() => {
        if (!id) return;
        if (activeWarehouseIds.length === 0) setSelectedWarehouseId('');
        else if (activeWarehouseIds.length === 1) setSelectedWarehouseId(activeWarehouseIds[0]);
    }, [activeWarehouseIds, id]);


    // Handle click outside to clear warehouse selection
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (warehouseContainerRef.current && !warehouseContainerRef.current.contains(event.target as Node)) {
                setSelectedInManagerId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);


    useEffect(() => {
        if (editor.note) sessionStorage.setItem(`stock_note_${id}`, editor.note);
        else sessionStorage.removeItem(`stock_note_${id}`);
    }, [editor.note, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showNote_${id}`, editor.showNote.toString());
    }, [editor.showNote, id]);


    // Load available units from Client persistence
    useEffect(() => {
        const loadClientUnits = async () => {
            try {
                const client = await db.get('clients', id);
                if (client?.enabledUnits) {
                    setAvailableUnits(client.enabledUnits);
                    // If current unit is not in the loaded list, reset it
                    if (client.enabledUnits.length > 0) {
                        if (!client.enabledUnits.includes(newProductUnit)) {
                            setNewProductUnit(client.enabledUnits[0]);
                        }
                    } else {
                        setNewProductUnit(''); // Select placeholder if empty
                    }
                }
                if (client?.enabledSellers) {
                    setAvailableSellers(client.enabledSellers);
                }
                setUnitsLoaded(true);
                setSellersLoaded(true);
            } catch (error) {
                console.error('Error loading client generic data:', error);
                setUnitsLoaded(true);
                setSellersLoaded(true);
            }
        };
        loadClientUnits();
    }, [id]);

    // Close unit input on click outside if empty
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                showUnitInput &&
                !unitInputValue.trim() &&
                unitInputRef.current &&
                !unitInputRef.current.contains(event.target as Node)
            ) {
                setShowUnitInput(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUnitInput, unitInputValue]);

    // Save available units to Client persistence
    const saveClientUnits = React.useCallback(async (newUnits: string[]) => {
        try {
            const client = await db.get('clients', id);
            if (client) {
                await db.put('clients', {
                    ...client,
                    enabledUnits: newUnits,
                    synced: false,
                    updatedAt: new Date().toISOString()
                });
                syncService.pushChanges();
            }
        } catch (error) {
            console.error('Error saving client units:', error);
        }
    }, [id]);

    const saveClientSellers = React.useCallback(async (newSellers: string[]) => {
        try {
            const client = await db.get('clients', id);
            if (client) {
                await db.put('clients', {
                    ...client,
                    enabledSellers: newSellers,
                    synced: false,
                    updatedAt: new Date().toISOString()
                });
                syncService.pushChanges();
            }
        } catch (error) {
            console.error('Error saving client sellers:', error);
        }
    }, [id]);

    const handleAddUnit = React.useCallback(() => {
        if (unitInputValue.trim()) {
            const upper = unitInputValue.trim().toUpperCase();
            if (!availableUnits.includes(upper)) {
                const newUnits = [...availableUnits, upper];
                setAvailableUnits(newUnits);
                saveClientUnits(newUnits);
                setNewProductUnit(upper);
            }
            setUnitInputValue('');
            setShowUnitInput(false);
        }
    }, [unitInputValue, availableUnits, saveClientUnits]);

    const handleAddSeller = React.useCallback(() => {
        if (sellerInputValue.trim()) {
            const formatted = sellerInputValue.trim();
            if (!availableSellers.includes(formatted)) {
                const newSellers = [...availableSellers, formatted];
                setAvailableSellers(newSellers);
                saveClientSellers(newSellers);
                editor.updateActiveStockItem('seller', formatted);
            }
            setSellerInputValue('');
            setShowSellerInput(false);
        }
    }, [sellerInputValue, availableSellers, saveClientSellers, editor.updateActiveStockItem]);

    // Filter products: show ONLY client-specific ones (Strict Per-Client Isolation)
    const availableProducts = useMemo(() => {
        return products.filter(p => {
            if (p.clientId !== id) return false;
            // Exclude harvested products (Propia) from the catalog view
            const isPropia = 
                (p.commercialName?.toLowerCase().trim() === 'propia') || 
                (p.brandName?.toLowerCase().trim() === 'propia');
            return !isPropia;
        });
    }, [products, id]);

    // Check for duplicates in real-time
    useEffect(() => {
        if (!showProductForm) {
            setIsDuplicate(false);
            return;
        }

        const duplicate = availableProducts.find(p =>
            p.id !== editingProductId && // Don't count self when editing
            p.activeIngredient?.toLowerCase().trim() === newProductPA.toLowerCase().trim() &&
            p.commercialName?.toLowerCase().trim() === newProductCommercialName.toLowerCase().trim() &&
            p.brandName?.toLowerCase().trim() === newProductBrand.toLowerCase().trim()
        );

        setIsDuplicate(!!duplicate);
    }, [newProductPA, newProductBrand, availableProducts, showProductForm, editingProductId]);

    // Enrich stock data with product details (name, unit, type) and weighted average price
    const enrichedStock = useMemo<EnrichedStockItem[]>(() => {
        // 1. Group movements to calculate weighted averages per specific presentation
        // key: productId_pLabel_pContent or normalized_name_pLabel_pContent
        const purchasePricing = new Map<string, { totalVal: number; totalQty: number }>();
        const salePricing = new Map<string, { totalVal: number; totalQty: number }>();

        const updateStats = (map: Map<string, { totalVal: number; totalQty: number }>, key: string, qty: number, val: number) => {
            if (!key) return;
            const entry = map.get(key) || { totalVal: 0, totalQty: 0 };
            entry.totalVal += val;
            entry.totalQty += qty;
            map.set(key, entry);
        };

        const getPresentKey = (baseId: string, item: any) => {
            const label = (item.presentationLabel || '').trim().toLowerCase();
            const content = (item.presentationContent || 0).toString();
            return `${baseId}_${label}_${content}`;
        }

        movements.forEach(m => {
            if (m.type === 'IN') {
                // Determine if we should process root or items
                // Rule: If items exist, they are the source of truth for presentation + price
                if (m.items && m.items.length > 0) {
                    m.items.forEach((item: any) => {
                        const cost = (item.quantity || 0) * (item.price || 0);

                        // 1. Specific ID + Presentation
                        const pKeySpecific = getPresentKey(item.productId, item);
                        updateStats(purchasePricing, pKeySpecific, item.quantity, cost);

                        // 2. Generic Name + Presentation
                        if (item.productName) {
                            const pKeyGeneric = getPresentKey(item.productName.toLowerCase().trim(), item);
                            updateStats(purchasePricing, pKeyGeneric, item.quantity, cost);
                        }
                    });
                } else {
                    // Fallback for older movements without items array
                    const cost = (m.quantity || 0) * (m.purchasePrice || m.price || 0);
                    const pKeySpecific = getPresentKey(m.productId, m);
                    updateStats(purchasePricing, pKeySpecific, m.quantity, cost);

                    if (m.productName) {
                        const pKeyGeneric = getPresentKey(m.productName.toLowerCase().trim(), m);
                        updateStats(purchasePricing, pKeyGeneric, m.quantity, cost);
                    }
                }
            } else if (m.type === 'SALE') {
                const cost = (m.quantity || 0) * (m.salePrice || 0);
                const pKeySpecific = getPresentKey(m.productId, m);
                updateStats(salePricing, pKeySpecific, m.quantity, cost);

                const nameKey = (m.crop || m.productName || '').toLowerCase().trim();
                const pKeyGeneric = getPresentKey(nameKey, m);
                updateStats(salePricing, pKeyGeneric, m.quantity, cost);
            }
        });

        const firstId = warehouses[0]?.id;
        const filteredStock = stock.filter((item: ClientStock) => {
            if (activeWarehouseIds.length === 0) return false;
            const effectiveWId = item.warehouseId || firstId;
            return activeWarehouseIds.includes(effectiveWId);
        });

        // Group by product/brand to combine stock
        const combined = new Map<string, EnrichedStockItem>();

        filteredStock.forEach((item: ClientStock) => {
            const product = products.find(p => p.id === item.productId);
            const warehouse = warehouses.find(w => w.id === item.warehouseId);
            const brand = (item.productBrand || product?.brandName || '').toLowerCase().trim();
            const normalizedName = (product?.name || '').toLowerCase().trim();

            const isPropia = (product?.type === 'GRAIN' || product?.type === 'SEED') && item.source === 'HARVEST';

            // Find specific PPP for this presentation
            const pKeySpecific = getPresentKey(item.productId, item);
            const pKeyGeneric = getPresentKey(normalizedName, item);

            let specificAvgPrice = 0;

            if (isPropia) {
                const d1 = salePricing.get(pKeySpecific);
                const d2 = salePricing.get(`${item.productId}__0`);
                const d3 = salePricing.get(pKeyGeneric);
                const d4 = salePricing.get(`${normalizedName}__0`);

                const totalVal = (d1?.totalVal || 0) + (d2?.totalVal || 0) + (d3?.totalVal || 0) + (d4?.totalVal || 0);
                const totalQty = (d1?.totalQty || 0) + (d2?.totalQty || 0) + (d3?.totalQty || 0) + (d4?.totalQty || 0);

                if (totalQty > 0) specificAvgPrice = totalVal / totalQty;
            } else {
                const d1 = purchasePricing.get(pKeySpecific);
                const d2 = purchasePricing.get(`${item.productId}__0`);
                const d3 = purchasePricing.get(pKeyGeneric);
                const d4 = purchasePricing.get(`${normalizedName}__0`);

                const totalVal = (d1?.totalVal || 0) + (d2?.totalVal || 0) + (d3?.totalVal || 0) + (d4?.totalVal || 0);
                const totalQty = (d1?.totalQty || 0) + (d2?.totalQty || 0) + (d3?.totalQty || 0) + (d4?.totalQty || 0);

                if (totalQty > 0) specificAvgPrice = totalVal / totalQty;
            }

            // Temporarily piggyback the specific PPP onto the breakdown item for rendering
            const enrichedBreakdownItem = { ...item, _specificPPP: specificAvgPrice } as any;

            const key = `${item.productId}_${brand}`;

            if (combined.has(key)) {
                const existing = combined.get(key)!;
                existing.quantity += item.quantity;
                if (!existing.breakdown) existing.breakdown = [];

                const existingBreakdown = existing.breakdown.find(b =>
                    b.presentationLabel === enrichedBreakdownItem.presentationLabel &&
                    b.presentationContent === enrichedBreakdownItem.presentationContent
                );

                if (existingBreakdown) {
                    existingBreakdown.quantity += enrichedBreakdownItem.quantity;
                    if (existingBreakdown.presentationAmount && enrichedBreakdownItem.presentationAmount) {
                        existingBreakdown.presentationAmount += enrichedBreakdownItem.presentationAmount;
                    } else if (enrichedBreakdownItem.presentationAmount) {
                        existingBreakdown.presentationAmount = enrichedBreakdownItem.presentationAmount;
                    }
                } else {
                    existing.breakdown.push(enrichedBreakdownItem);
                }
            } else {
                combined.set(key, {
                    ...item,
                    productName: product?.name || 'Insumo Desconocido',
                    warehouseName: activeWarehouseIds.length > 1 ? 'Múltiples' : (warehouse?.name || (item.warehouseId === null && warehouses[0] ? warehouses[0].name : 'Galpón')),
                    productType: product?.type || 'OTHER',
                    unit: product?.unit || 'UNIT',
                    price: 0, // Will calculate global avg after all items processed
                    productBrand: item.productBrand || product?.brandName || '',
                    productCommercialName: product?.commercialName || (brand === 'propia' ? 'Propia' : ''),
                    hasProduct: !!product,
                    campaignId: item.campaignId,
                    breakdown: [enrichedBreakdownItem]
                });
            }
        });

        // Second pass to calculate true weighted average price for the main row
        Array.from(combined.values()).forEach(item => {
            if (item.breakdown && item.quantity > 0) {
                let trueTotalValue = 0;
                item.breakdown.forEach((b: any) => {
                    trueTotalValue += (b.quantity * (b._specificPPP || 0));
                });
                item.price = trueTotalValue / item.quantity; // USD per Unit
            }
        });

        return Array.from(combined.values()).filter(item => item.hasProduct);
    }, [stock, products, warehouses, activeWarehouseIds, movements]);

    // Auto-update Sale Note with pricing details
    useEffect(() => {
        if (sellingStockId && saleQuantity && salePrice) {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (stockItem) {
                // Global rule: Prefer val.replace(/\./g, '').replace(',', '.') before calling parseFloat
                const priceNum = parseFloat(salePrice.replace(/\./g, '').replace(',', '.'));
                if (!isNaN(priceNum)) {
                    const isGrainOrSeed = stockItem.productType === 'GRAIN' || stockItem.productType === 'SEED';
                    const unitPriceLabel = isGrainOrSeed ? 'USD/Ton' : `USD/${stockItem.unit || 'ud'}`;
                    // We only show the unit price in the note as per user request
                    setSaleNote(`${salePrice} ${unitPriceLabel}`);
                }
            }
        }
    }, [sellingStockId, saleQuantity, salePrice, enrichedStock]);

    const handleProductSubmit = React.useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newProductName) return;

        if (newProductBrand && newProductBrand.toLowerCase().trim() === 'propia') {
            alert('La marca "Propia" está reservada para semillas de cosecha propia y no puede usarse manualmente.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingProductId) {
                // Update existing
                await updateProduct({
                    id: editingProductId,
                    name: newProductName,
                    brandName: newProductBrand,
                    commercialName: newProductCommercialName,
                    activeIngredient: newProductPA,
                    type: newProductType,
                    unit: newProductUnit,
                    standardPresentations: newProductPresentations,
                    clientId: id
                });
            } else {
                // Create new
                await addProduct({
                    name: newProductName,
                    brandName: newProductBrand,
                    commercialName: newProductCommercialName,
                    activeIngredient: newProductPA,
                    type: newProductType,
                    unit: newProductUnit,
                    standardPresentations: newProductPresentations,
                    clientId: id
                });
            }

            setNewProductName('');
            setNewProductBrand('');
            setNewProductCommercialName('');
            setNewProductPA('');
            setNewProductPresentations([]);
            setEditingProductId(null);
            setIsEditingProduct(false);
            setShowProductForm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [newProductName, newProductBrand, newProductCommercialName, newProductPA, editingProductId, newProductType, newProductUnit, newProductPresentations, id, updateProduct, addProduct]);

    const handleStockSubmit = React.useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        // Include active items if present
        const allItemsToProcess = [...editor.stockItems];
        if (editor.activeStockItem.productId && editor.activeStockItem.quantity) {
            allItemsToProcess.push(editor.activeStockItem);
        }

        const validItems = allItemsToProcess.filter(item => item.productId && item.quantity);
        if (validItems.length === 0) return;

        if (!selectedWarehouseId) {
            alert("Seleccione un destino");
            return;
        }

        setIsSubmitting(true);
        try {
            const movementId = generateId();
            let facturaUrl = '';

            if (facturaFile) {
                setFacturaUploading(true);
                facturaUrl = await uploadFactura(movementId);
                setFacturaUploading(false);
            }

            const now = new Date();
            const dateStr = now.toISOString().split('T')[0];
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            const movementItems: MovementItem[] = [];
            let currentStockState = [...stock];

            for (const item of validItems) {
                const product = availableProducts.find((p: Product) => p.id === item.productId);
                const qtyNum = parseFloat(item.quantity.toString().replace(',', '.'));
                const priceNum = item.price ? parseFloat(item.price.toString().replace(',', '.')) : 0;
                const pLabel = (item.presentationLabel || '').trim();
                const pContent = item.presentationContent ? parseFloat(item.presentationContent.toString().replace(',', '.')) : 0;
                const pAmount = item.presentationAmount ? parseFloat(item.presentationAmount.toString().replace(',', '.')) : 0;
                const pBrand = (item.tempBrand || product?.brandName || '').toLowerCase().trim();

                // Find existing item, but also account for items already processed in this loop
                // Now matching by Product, Warehouse, Brand, and Presentation details
                const existingInLoop = currentStockState.find((s: ClientStock) =>
                    s.productId === item.productId &&
                    s.warehouseId === (selectedWarehouseId || undefined) &&
                    (s.productBrand || '').toLowerCase().trim() === pBrand &&
                    (s.presentationLabel || '').trim() === pLabel &&
                    (s.presentationContent || 0) === pContent &&
                    s.campaignId === (selectedCampaignId || undefined)
                );

                const stockId = existingInLoop ? existingInLoop.id : generateId();

                const newItem: ClientStock = {
                    id: stockId,
                    clientId: id,
                    warehouseId: selectedWarehouseId || undefined,
                    campaignId: selectedCampaignId || undefined,
                    productId: item.productId,
                    productBrand: item.tempBrand || product?.brandName || '',
                    productCommercialName: item.productCommercialName || product?.commercialName || '',
                    quantity: existingInLoop
                        ? existingInLoop.quantity + qtyNum
                        : qtyNum,
                    lastUpdated: now.toISOString(),
                    updatedAt: now.toISOString(),
                    source: 'PURCHASE',
                    presentationLabel: pLabel || undefined,
                    presentationContent: pContent || undefined,
                    presentationAmount: existingInLoop
                        ? (existingInLoop.presentationAmount || 0) + pAmount
                        : pAmount
                };

                // Update intermediate state for the next iteration in this loop
                if (existingInLoop) {
                    currentStockState = currentStockState.map(s => s.id === stockId ? newItem : s);
                } else {
                    currentStockState.push(newItem);
                }

                await updateStock(newItem);

                // --- Dynamic Presentation Learning ---
                if (pLabel && pContent > 0 && product) {
                    const existingPresentations = product.standardPresentations || [];
                    const alreadyExists = existingPresentations.some(
                        pres => pres.label.toLowerCase().trim() === pLabel.toLowerCase().trim() &&
                            pres.content === pContent
                    );

                    if (!alreadyExists) {
                        const updatedPresentations = [
                            ...existingPresentations,
                            { label: pLabel, content: pContent }
                        ];
                        // Silent update of the product in background
                        db.put('products', {
                            ...product,
                            standardPresentations: updatedPresentations,
                            synced: false,
                            updatedAt: new Date().toISOString()
                        });
                        // Also update availableProducts in memory if needed (though it will refresh on next render/sync)
                    }
                }
                // ------------------------------------

                movementItems.push({
                    id: generateId(),
                    productId: item.productId,
                    productName: product?.name || 'Unknown',
                    productCommercialName: product?.commercialName || '-',
                    productBrand: item.tempBrand || product?.brandName || '',
                    quantity: qtyNum,
                    unit: product?.unit || 'L',
                    price: priceNum,
                    sellerName: editor.selectedSeller || undefined,
                    presentationLabel: pLabel || undefined,
                    presentationContent: pContent || 0,
                    presentationAmount: pAmount || 0,
                    source: 'PURCHASE'
                });
            }

            const singleValidItem = validItems.length === 1 ? validItems[0] : null;
            const rootPrice = singleValidItem && singleValidItem.price ? parseFloat(singleValidItem.price.toString().replace(',', '.')) : undefined;

            const totalAmount = movementItems.reduce((acc, it) => acc + (it.quantity * (it.price || 0)), 0);

            const movementData: InventoryMovement = {
                id: movementId,
                clientId: id,
                warehouseId: selectedWarehouseId || undefined,
                productId: validItems.length === 1 ? singleValidItem!.productId : validItems[0].productId,
                productName: validItems.length === 1 ? (availableProducts.find((p: Product) => p.id === singleValidItem!.productId)?.name || 'Unknown') : 'Compra de insumos',
                productBrand: validItems.length === 1 ? singleValidItem!.tempBrand : undefined,
                type: 'IN',
                quantity: validItems.length === 1 ? parseFloat(singleValidItem!.quantity.toString().replace(',', '.')) : validItems.length,
                unit: validItems.length === 1 ? (availableProducts.find((p: Product) => p.id === singleValidItem!.productId)?.unit || 'L') : 'items',
                amount: totalAmount,
                date: dateStr,
                time: timeStr,
                referenceId: `PURCHASE-${movementId}`,
                notes: editor.note || '-',
                facturaImageUrl: facturaUrl || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false,
                investors: editor.selectedInvestors,
                sellerName: editor.selectedSeller || undefined,
                facturaDate: editor.facturaDate || undefined,
                dueDate: editor.dueDate || undefined,
                campaignId: selectedCampaignId || undefined,
                items: movementItems,
                source: 'PURCHASE',
                purchasePrice: rootPrice
            };

            await db.put('movements', movementData);
            setLastMovement(movementData);
            setLastAction('IN');

            await movementsRefresh();
            syncService.pushChanges();

            // Reset
            editor.setStockItems([]);
            editor.setActiveStockItem({
                productId: '',
                quantity: '',
                price: '',
                tempBrand: '',
                productCommercialName: '',
                presentationLabel: '',
                presentationContent: '',
                presentationAmount: ''
            });
            setSelectedWarehouseId('');
            editor.setNote('');
            editor.setShowNote(false);
            editor.setFacturaDate('');
            editor.setDueDate('');
            setSelectedCampaignId('');
            editor.setSelectedInvestors([]);
            editor.setSelectedSeller('');
            setShowStockForm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [id, editor, facturaFile, uploadFactura, stock, availableProducts, selectedWarehouseId, selectedCampaignId, updateStock, displayName, movementsRefresh, setShowStockForm]);

    const handleSaleSubmit = React.useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sellingStockId || !saleQuantity || !salePrice) return;

        setIsSubmitting(true);
        try {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (!stockItem) return;

            const isGrainOrSeed = stockItem.productType === 'GRAIN' || stockItem.productType === 'SEED';
            const qtyNumRaw = parseFloat(saleQuantity.replace(',', '.'));
            const priceNumRaw = parseFloat(salePrice.replace(',', '.'));

            if (isNaN(qtyNumRaw) || isNaN(priceNumRaw)) return;

            const qtyNum = isGrainOrSeed ? qtyNumRaw * 1000 : qtyNumRaw;
            const priceNum = isGrainOrSeed ? priceNumRaw / 1000 : priceNumRaw;

            // Record Movement
            const movementId = generateId();
            let facturaUrl = '';
            if (saleFacturaFile) {
                setFacturaUploading(true);
                const fileExt = saleFacturaFile.name.split('.').pop();
                const filePath = `${id}/facturas/${movementId}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('facturas')
                    .upload(filePath, saleFacturaFile, { upsert: true });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
                    facturaUrl = publicUrlData.publicUrl;
                }
                setFacturaUploading(false);
            }

            let remitoUrl = '';
            if (saleRemitoFile) {
                setRemitoUploading(true);
                const fileExt = saleRemitoFile.name.split('.').pop();
                const filePath = `${id}/remitos/${movementId}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('remitos') // using remitos bucket
                    .upload(filePath, saleRemitoFile, { upsert: true });

                if (!uploadError) {
                    const { data: publicUrlData } = supabase.storage.from('remitos').getPublicUrl(filePath);
                    remitoUrl = publicUrlData.publicUrl;
                }
                setRemitoUploading(false);
            }

            // Update Stock using auto-deduction across presentations
            const deductSuccess = await deductStockQuantity(
                stockItem.productId,
                stockItem.productBrand || '',
                qtyNum,
                stockItem.warehouseId
            );

            if (!deductSuccess) {
                // This shouldn't happen if UI validation works, but as a safety:
                console.warn('Deduction might have been incomplete');
            }
            const isHarvested = !stockItem.source && movements.some(m => 
                !m.deleted && 
                m.type === 'HARVEST' && 
                m.productId === stockItem.productId && 
                m.campaignId === stockItem.campaignId &&
                m.productBrand === stockItem.productBrand
            );

            const movementData: InventoryMovement = {
                id: movementId,
                clientId: id,
                warehouseId: stockItem.warehouseId,
                productId: stockItem.productId,
                productName: stockItem.productName,
                productCommercialName: stockItem.productCommercialName || '',
                productBrand: stockItem.productBrand || '-',
                type: 'SALE',
                quantity: qtyNum,
                unit: stockItem.unit,
                amount: qtyNum * priceNum,
                salePrice: priceNum,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
                referenceId: `SALE-${movementId}`,
                campaignId: stockItem.campaignId, // Propagate campaign from stock
                notes: saleNote || `${priceNum} USD/ ${stockItem.unit}, USD ${(qtyNum * priceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total`,
                facturaImageUrl: facturaUrl || undefined,
                remitoImageUrl: remitoUrl || undefined,
                source: stockItem.source || (isHarvested ? 'HARVEST' : undefined),
                createdBy: displayName || 'Sistema',
                createdAt: new Date().toISOString(),
                synced: false,
                // Flattened Properties
                truckDriver: saleTruckDriver || undefined,
                plateNumber: salePlateNumber || undefined,
                trailerPlate: saleTrailerPlate || undefined,
                destinationCompany: saleDestinationCompany || undefined,
                destinationAddress: saleDestinationAddress || undefined,
                transportCompany: saleTransportCompany || undefined,
                dischargeNumber: saleDischargeNumber || undefined,
                humidity: saleHumidity ? parseFloat(saleHumidity.replace(',', '.')) : undefined,
                hectoliterWeight: saleHectoliterWeight ? parseFloat(saleHectoliterWeight.replace(',', '.')) : undefined,
                grossWeight: saleGrossWeight ? parseFloat(saleGrossWeight.replace(',', '.')) : undefined,
                tareWeight: saleTareWeight ? parseFloat(saleTareWeight.replace(',', '.')) : undefined,
                primarySaleCuit: salePrimarySaleCuit || undefined,
                departureDateTime: saleDepartureDateTime || undefined,
                distanceKm: saleDistanceKm ? parseFloat(saleDistanceKm.replace(',', '.')) : undefined,
                freightTariff: saleFreightTariff ? parseFloat(saleFreightTariff.replace(',', '.')) : undefined,
            };

            await db.put('movements', movementData);

            await movementsRefresh();
            setLastMovement(movementData);
            setLastAction('SALE');
            setLastTransferOrigin(stockItem.warehouseName);

            syncService.pushChanges();
            setSellingStockId(null);
            setSaleQuantity('');
            setSalePrice('');
            setSaleNote('');
            setShowSaleNote(false);
            setSaleFacturaFile(null);
            setSaleRemitoFile(null);
            setSaleTruckDriver('');
            setSalePlateNumber('');
            setSaleDestination('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    }, [id, sellingStockId, saleQuantity, salePrice, enrichedStock, saleFacturaFile, deductStockQuantity, saleNote, displayName, saleTruckDriver, salePlateNumber, saleTrailerPlate, saleDestinationCompany, saleDestinationAddress, saleTransportCompany, saleDischargeNumber, saleHumidity, saleHectoliterWeight, saleGrossWeight, saleTareWeight, salePrimarySaleCuit, saleDepartureDateTime, saleDistanceKm, saleFreightTariff, movementsRefresh]);

    const handleConfirmMove = React.useCallback(async (action: 'WITHDRAW' | 'TRANSFER', quantities: Record<string, number>, destinationWarehouseId?: string, note?: string, receiverName?: string, logistics?: any, remitoFile?: File | null) => {
        // quantities here is a map of specific stock IDs to their selected quantities
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let createdMovement: InventoryMovement | null = null;

        let remitoUrl = '';
        if (remitoFile) {
            setRemitoUploading(true);
            const commonMovementId = generateId();
            const fileExt = remitoFile.name.split('.').pop();
            const filePath = `${id}/remitos/move_${commonMovementId}.${fileExt}`;
            const { error: uploadError } = await supabase.storage
                .from('remitos')
                .upload(filePath, remitoFile, { upsert: true });

            if (!uploadError) {
                const { data: publicUrlData } = supabase.storage.from('remitos').getPublicUrl(filePath);
                remitoUrl = publicUrlData.publicUrl;
            }
            setRemitoUploading(false);
        }

        // Iterate over the specific entries in the quantities map
        for (const [stockId, qtyToMove] of Object.entries(quantities)) {
            if (qtyToMove <= 0) continue;

            // Find the specific stock record in the absolute stock state
            const stockRecord = stock.find(s => s.id === stockId);
            if (!stockRecord) continue;

            const product = products.find(p => p.id === stockRecord.productId);
            const warehouse = warehouses.find(w => w.id === stockRecord.warehouseId);

            // 1. Create OUT Movement (Origin)
            const movementData: InventoryMovement = {
                id: generateId(),
                clientId: id,
                warehouseId: stockRecord.warehouseId,
                productId: stockRecord.productId,
                productName: product?.name || 'Insumo Desconocido',
                productCommercialName: product?.commercialName || '',
                productBrand: stockRecord.productBrand || '-',
                type: 'OUT',
                quantity: qtyToMove,
                unit: product?.unit || 'u.',
                date: dateStr,
                time: timeStr,
                referenceId: `MOVE-${now.getTime()}`,
                campaignId: stockRecord.campaignId, // Propagate campaign from stock
                notes: `${action === 'WITHDRAW' ? 'Retiro de stock' : 'Traslado a ' + (warehouses.find(w => w.id === destinationWarehouseId)?.name || 'galpón')} - ${stockRecord.presentationLabel || ''} ${stockRecord.presentationContent || ''} - ${note || ''}`,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false,
                source: stockRecord.source,
                receiverName: action === 'WITHDRAW' ? (receiverName || undefined) : undefined,
                remitoImageUrl: remitoUrl || undefined,
                ...(action === 'WITHDRAW' && logistics ? logistics : {})
            };

            await db.put('movements', movementData);

            if (action === 'WITHDRAW') {
                createdMovement = movementData;
                if (warehouse) setLastTransferOrigin(warehouse.name);
            }

            // 2. Update Origin Stock (Direct Deduction)
            const remainingQty = stockRecord.quantity - qtyToMove;
            // Removed deleteStock(stockRecord.id) call to allow negative stock tracking
            await updateStock({
                ...stockRecord,
                quantity: remainingQty,
                source: stockRecord.source, // Explicitly preserve
                lastUpdated: now.toISOString()
            });

            // 3. If TRANSFER, create IN (Destination)
            if (action === 'TRANSFER' && destinationWarehouseId) {
                // Find existing stock at destination with SAME product, brand, and presentation
                const existingDestItem = stock.find(s =>
                    s.productId === stockRecord.productId &&
                    s.warehouseId === destinationWarehouseId &&
                    (s.productBrand || '').toLowerCase().trim() === (stockRecord.productBrand || '').toLowerCase().trim() &&
                    (s.presentationLabel || '').toLowerCase().trim() === (stockRecord.presentationLabel || '').toLowerCase().trim() &&
                    (s.presentationContent || 0) === (stockRecord.presentationContent || 0)
                );

                if (existingDestItem) {
                    await updateStock({
                        ...existingDestItem,
                        quantity: existingDestItem.quantity + qtyToMove,
                        campaignId: stockRecord.campaignId, // Ensure campaignId is preserved
                        source: stockRecord.source, // Ensure source is preserved
                        lastUpdated: now.toISOString()
                    });
                } else {
                    // Create new stock record at destination mirroring the origin presentation
                    await updateStock({
                        clientId: id,
                        warehouseId: destinationWarehouseId,
                        productId: stockRecord.productId,
                        productBrand: stockRecord.productBrand,
                        presentationLabel: stockRecord.presentationLabel,
                        presentationContent: stockRecord.presentationContent,
                        presentationAmount: 0, // Not relevant for moved items total
                        quantity: qtyToMove,
                        campaignId: stockRecord.campaignId, // Propagate campaign from stock
                        source: stockRecord.source,
                        lastUpdated: now.toISOString()
                    });
                }

                // IN movement record
                const transferInMovement: InventoryMovement = {
                    id: generateId(),
                    clientId: id,
                    warehouseId: destinationWarehouseId,
                    productId: stockRecord.productId,
                    productName: product?.name || 'Insumo Desconocido',
                    productCommercialName: product?.commercialName || '',
                    productBrand: stockRecord.productBrand || '-',
                    type: 'IN',
                    quantity: qtyToMove,
                    unit: product?.unit || 'u.',
                    date: dateStr,
                    time: timeStr,
                    referenceId: `MOVE-${now.getTime()}`,
                    campaignId: stockRecord.campaignId, // Propagate campaign from stock
                    notes: `Transferencia desde ${warehouse?.name || 'Galpón'} - ${stockRecord.presentationLabel || ''} ${stockRecord.presentationContent || ''} - ${note || ''}`,
                    createdBy: displayName || 'Sistema',
                    createdAt: now.toISOString(),
                    synced: false,
                    source: stockRecord.source,
                    remitoImageUrl: remitoUrl || undefined
                };
                await db.put('movements', transferInMovement);
                createdMovement = transferInMovement;
            }
        }

        await movementsRefresh();
        syncService.pushChanges();
        handleClearSelection();

        if (createdMovement) {
            setLastMovement(createdMovement);
            setLastAction(action);
            if (action === 'TRANSFER') {
                const firstId = Object.keys(quantities)[0];
                const item = stock.find(i => i.id === firstId);
                const warehouse = warehouses.find(w => w.id === item?.warehouseId);
                if (warehouse) setLastTransferOrigin(warehouse.name);
            }
        }
    }, [id, stock, products, warehouses, displayName, updateStock, movementsRefresh, handleClearSelection]);

    const toggleStockSelection = React.useCallback((id: string, e: React.MouseEvent) => {
        // Prevent if clicking on actions or links
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;

        setSelectedStockIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    }, []);



    const handleDeleteProduct = React.useCallback(async (productId: string) => {
        if (!confirm('¿Está seguro que desea eliminar este insumo del catálogo? Esto no eliminará el historial pero podría afectar la visualización de stock actual.')) return;
        try {
            await deleteProduct(productId);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar insumo');
        }
    }, [deleteProduct]);

    const handleEditBrand = React.useCallback(async (stockId: string, currentBrand: string) => {
        const newBrand = prompt('Editar Marca:', currentBrand);
        if (newBrand === null || newBrand === currentBrand) return;

        if (newBrand.toLowerCase().trim() === 'propia') {
            alert('La marca "Propia" está reservada para semillas de cosecha propia y no puede usarse manualmente.');
            return;
        }

        const item = stock.find(s => s.id === stockId);
        if (!item) return;

        // Find if there's already stock for this exact product + brand + warehouse
        const existingItem = stock.find(s =>
            s.id !== stockId &&
            s.productId === item.productId &&
            s.warehouseId === item.warehouseId &&
            (s.productBrand || '').toLowerCase().trim() === newBrand.toLowerCase().trim()
        );

        if (existingItem) {
            if (confirm(`Ya existe stock de este insumo con la marca "${newBrand}". ¿Desea unificar ambos registros?\n\nCantidad actual: ${item.quantity}\nCantidad en "${newBrand}": ${existingItem.quantity}\nTotal resultante: ${item.quantity + existingItem.quantity}`)) {
                // Merge logic:
                // 1. Update the existing item with the sum of quantities
                await updateStock({
                    ...existingItem,
                    quantity: existingItem.quantity + item.quantity
                });
                // 2. Delete the current item
                await deleteStock(stockId);
                alert('Stock unificado con éxito.');
            }
        } else {
            // Just update the brand
            await updateStock({
                ...item,
                productBrand: newBrand
            });
        }
    }, [stock, updateStock, deleteStock]);

    // Redundant local batch methods removed - now using editor hook

    const handleImportProducts = React.useCallback(async (importedProducts: any[]) => {
        setIsSubmitting(true);
        try {
            for (const p of importedProducts) {
                const exists = availableProducts.find(existing =>
                    (existing.activeIngredient || '').toLowerCase() === (p.activeIngredient || '').toLowerCase() &&
                    (existing.brandName || '').toLowerCase() === (p.brandName || '').toLowerCase() &&
                    (existing.commercialName || '').toLowerCase() === (p.commercialName || '').toLowerCase() &&
                    existing.type === p.type
                );

                if (!exists) {
                    await addProduct({
                        name: p.name,
                        brandName: p.brandName,
                        commercialName: p.commercialName,
                        activeIngredient: p.activeIngredient || p.name,
                        type: p.type,
                        unit: p.unit,
                        standardPresentations: p.standardPresentations,
                        clientId: id
                    });
                }
            }
        } catch (error) {
            console.error('Import error:', error);
        } finally {
            setIsSubmitting(false);
        }
    }, [availableProducts, addProduct, id]);

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
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Galpón Virtual</h1>
                    </div>
                    {!isReadOnly && (
                        <div className="flex gap-2">
                            {selectedStockIds.length > 0 && (
                                <>
                                    <Button
                                        onClick={() => setShowMovePanel(!showMovePanel)}
                                        variant={showMovePanel ? "secondary" : "primary"}
                                        className={`${showMovePanel ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-emerald-600 hover:bg-emerald-700"} animate-fadeIn`}
                                    >
                                        {showMovePanel ? 'Cancelar Mover' : `Mover Stock (${selectedStockIds.length})`}
                                    </Button>

                                    {/* Sales allowed from ANY warehouse as per user request */}
                                    <Button
                                        onClick={() => {
                                            if (sellingStockId) {
                                                setSellingStockId(null);
                                                return;
                                            }

                                            if (selectedStockIds.length === 1) {
                                                const item = enrichedStock.find(s => s.id === selectedStockIds[0]);
                                                const campaign = item?.campaignId ? campaigns.find(c => c.id === item.campaignId) : null;

                                                if (campaign?.mode === 'GRAIN' && item?.source === 'HARVEST') {
                                                    alert('No se permiten ventas de granos cosechados en campañas de modo COSECHA. Los socios deben realizar retiros.');
                                                    return;
                                                }

                                                if (item) {
                                                    setSellingStockId(item.id);
                                                    setSaleQuantity('');
                                                }
                                            } else {
                                                alert('Por favor selecciona un solo insumo para vender.');
                                            }
                                        }}
                                        variant={sellingStockId ? "secondary" : "primary"}
                                        className={`${sellingStockId ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"} animate-fadeIn`}
                                    >
                                        {sellingStockId ? 'Cancelar Vender' : 'Vender'}
                                    </Button>
                                </>
                            )}
                            <Button
                                onClick={() => {
                                    setShowStockForm(!showStockForm);
                                }}
                                variant={showStockForm ? "secondary" : "primary"}
                                className={showStockForm ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : ""}
                            >
                                {showStockForm ? 'Cancelar Carga' : 'Cargar Compra de Insumo'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>



            {/* Success Ribbon for PDF Download */}
            {lastMovement && lastAction && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-4 rounded-r-lg shadow-sm animate-fadeIn flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-2 rounded-full text-emerald-600">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        </div>
                        <div>
                            <p className="font-bold text-emerald-800">
                                {lastAction === 'SALE' ? `Venta registrada exitosamente (Origen: ${lastTransferOrigin})` :
                                    lastAction === 'TRANSFER' ? `Traslado registrado exitosamente (${lastTransferOrigin} ➝ ${warehouses.find(w => w.id === lastMovement.warehouseId)?.name})` :
                                        lastAction === 'WITHDRAW' ? `Retiro registrado exitosamente (Origen: ${lastTransferOrigin})` :
                                            'Ingreso registrado exitosamente'}
                            </p>
                            <p className="text-sm text-emerald-600">
                                {lastMovement.productName} {lastMovement.productBrand ? `(${lastMovement.productBrand})` : ''} - {lastMovement.quantity} {lastMovement.unit}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => {
                                setLastMovement(null);
                                setLastAction(null);
                            }}
                            className="text-slate-400 hover:text-slate-600 px-2"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Input Form */}


            <StockTable
                activeWarehouseIds={activeWarehouseIds}
                warehouses={warehouses}
                stockLoading={stockLoading}
                productsLoading={productsLoading}
                enrichedStock={enrichedStock}
                toggleStockSelection={toggleStockSelection}
                selectedStockIds={selectedStockIds}
                handleEditBrand={handleEditBrand}
                typeLabels={typeLabels}
                products={products}
                clearSelection={handleClearSelection}
            />

            {sellingStockId && (
                <StockSalePanel
                    stockItem={enrichedStock.find(s => s.id === sellingStockId)}
                    onClose={handleCloseSale}
                    onSubmit={handleSaleSubmit}
                    saleQuantity={saleQuantity}
                    setSaleQuantity={setSaleQuantity}
                    salePrice={salePrice}
                    setSalePrice={setSalePrice}
                    isSubmitting={isSubmitting}
                    facturaUploading={facturaUploading}
                    saleTruckDriver={saleTruckDriver}
                    setSaleTruckDriver={setSaleTruckDriver}
                    salePlateNumber={salePlateNumber}
                    setSalePlateNumber={setSalePlateNumber}
                    saleTrailerPlate={saleTrailerPlate}
                    setSaleTrailerPlate={setSaleTrailerPlate}
                    saleDestinationCompany={saleDestinationCompany}
                    setSaleDestinationCompany={setSaleDestinationCompany}
                    saleDestinationAddress={saleDestinationAddress}
                    setSaleDestinationAddress={setSaleDestinationAddress}
                    salePrimarySaleCuit={salePrimarySaleCuit}
                    setSalePrimarySaleCuit={setSalePrimarySaleCuit}
                    saleTransportCompany={saleTransportCompany}
                    setSaleTransportCompany={setSaleTransportCompany}
                    saleDischargeNumber={saleDischargeNumber}
                    setSaleDischargeNumber={setSaleDischargeNumber}
                    saleHumidity={saleHumidity}
                    setSaleHumidity={setSaleHumidity}
                    saleHectoliterWeight={saleHectoliterWeight}
                    setSaleHectoliterWeight={setSaleHectoliterWeight}
                    saleGrossWeight={saleGrossWeight}
                    setSaleGrossWeight={setSaleGrossWeight}
                    saleTareWeight={saleTareWeight}
                    setSaleTareWeight={setSaleTareWeight}
                    saleDistanceKm={saleDistanceKm}
                    setSaleDistanceKm={setSaleDistanceKm}
                    saleDepartureDateTime={saleDepartureDateTime}
                    setSaleDepartureDateTime={setSaleDepartureDateTime}
                    saleFreightTariff={saleFreightTariff}
                    setSaleFreightTariff={setSaleFreightTariff}
                    showSaleNote={showSaleNote}
                    setShowSaleNote={setShowSaleNote}
                    saleNote={saleNote}
                    setSaleNote={setSaleNote}
                    saleFacturaFile={saleFacturaFile}
                    setSaleFacturaFile={setSaleFacturaFile}
                    saleRemitoFile={saleRemitoFile}
                    setSaleRemitoFile={setSaleRemitoFile}
                />
            )}


            {/* Stock Movement Panel (Moved to bottom) */}
            {showMovePanel && (
                <StockMovementPanel
                    selectedIds={selectedStockIds}
                    stockItems={enrichedStock}
                    warehouses={warehouses}
                    activeWarehouseIds={activeWarehouseIds}
                    onConfirm={handleConfirmMove}
                    onCancel={handleCancelMove}
                    investors={clientInvestors}
                    campaignShares={campaignShares}
                    campaigns={campaigns}
                    movements={movements}
                    isSaleActive={!!sellingStockId}
                />
            )}

            <div className="flex justify-end pr-2 pb-4 gap-2 flex-wrap">
                <button
                    onClick={handleToggleWarehouses}
                    className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showWarehouses ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                >
                    {showWarehouses 
                        ? (isReadOnly ? 'Cerrar galpones' : 'Cerrar gestión de galpón') 
                        : (isReadOnly ? 'Ver galpones' : 'Gestionar Galpones')
                    }
                </button>
                <button
                    onClick={handleToggleCatalog}
                    className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showCatalog ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                >
                    {showCatalog 
                        ? 'Cerrar catálogo' 
                        : (isReadOnly ? 'Ver catálogo' : 'Catálogo de insumos')
                    }
                </button>
                <Link
                    href={`/clients/${id}/stock/history`}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                >
                    Historial de Movimientos
                </Link>
            </div>

            <WarehouseManager
                showWarehouses={showWarehouses}
                setShowWarehouses={setShowWarehouses}
                showWarehouseForm={showWarehouseForm}
                setShowWarehouseForm={setShowWarehouseForm}
                warehouses={warehouses}
                addWarehouse={handleAddWarehouse}
                updateWarehouse={updateWarehouse}
                deleteWarehouse={deleteWarehouse}
                activeWarehouseIds={activeWarehouseIds}
                toggleWarehouseSelection={toggleWarehouseSelection}
                setAllWarehouses={setAllWarehouses}
                selectedInManagerId={selectedInManagerId}
                setSelectedInManagerId={setSelectedInManagerId}
                editingWarehouseId={editingWarehouseId}
                setEditingWarehouseId={setEditingWarehouseId}
                editName={editName}
                setEditName={setEditName}
                setSelectedStockIds={setSelectedStockIds}
                setSellingStockId={setSellingStockId}
                setShowMovePanel={setShowMovePanel}
                isReadOnly={isReadOnly}
                warehouseContainerRef={warehouseContainerRef}
                stock={stock}
                defaultHarvestWarehouseId={client?.defaultHarvestWarehouseId}
                onSetDefaultWarehouse={handleSetDefaultWarehouse}
                warehouseOrder={client?.warehouseOrder}
                onReorderWarehouses={handleReorderWarehouses}
            />

            <ProductCatalog
                showCatalog={showCatalog}
                setShowCatalog={setShowCatalog}
                productsLoading={productsLoading}
                availableProducts={availableProducts}
                typeLabels={typeLabels}
                isReadOnly={isReadOnly}
                setIsEditingProduct={setIsEditingProduct}
                setEditingProductId={setEditingProductId}
                setNewProductName={setNewProductName}
                setNewProductBrand={setNewProductBrand}
                setNewProductPA={setNewProductPA}
                newProductCommercialName={newProductCommercialName}
                setNewProductCommercialName={setNewProductCommercialName}
                setShowProductForm={setShowProductForm}
                availableUnits={availableUnits}
                deleteProduct={deleteProduct}
                setAvailableUnits={setAvailableUnits}
                saveClientUnits={saveClientUnits}
                newProductUnit={newProductUnit}
                setNewProductUnit={setNewProductUnit}
                showProductForm={showProductForm}
                editingProductId={editingProductId}
                handleProductSubmit={handleProductSubmit}
                newProductPresentations={newProductPresentations}
                setNewProductPresentations={setNewProductPresentations}
                newProductType={newProductType}
                setNewProductType={setNewProductType}
                productTypes={productTypes}
                newProductPA={newProductPA}
                newProductBrand={newProductBrand}
                showUnitInput={showUnitInput}
                setShowUnitInput={setShowUnitInput}
                showUnitDelete={showUnitDelete}
                setShowUnitDelete={setShowUnitDelete}
                unitInputRef={unitInputRef}
                unitInputValue={unitInputValue}
                setUnitInputValue={setUnitInputValue}
                handleAddUnit={handleAddUnit}
                isDuplicate={isDuplicate}
                isSubmitting={isSubmitting}
                importProducts={handleImportProducts}
            />

            {showStockForm && (
                <StockEntryForm
                    showStockForm={showStockForm}
                    setShowStockForm={setShowStockForm}
                    warehouses={warehouses}
                    activeWarehouseIds={activeWarehouseIds}
                    selectedWarehouseId={selectedWarehouseId}
                    setSelectedWarehouseId={setSelectedWarehouseId}
                    availableProducts={availableProducts}
                    activeStockItem={editor.activeStockItem}
                    updateActiveStockItem={editor.updateActiveStockItem}
                    stockItems={editor.stockItems}
                    setStockItems={editor.setStockItems as any}
                    addStockToBatch={editor.addStockToBatch}
                    editBatchItem={editor.editBatchItem}
                    removeBatchItem={editor.removeBatchItem}
                    availableSellers={availableSellers}
                    selectedSeller={editor.selectedSeller}
                    setSelectedSeller={editor.setSelectedSeller}
                    showSellerInput={showSellerInput}
                    setShowSellerInput={setShowSellerInput}
                    sellerInputValue={sellerInputValue}
                    setSellerInputValue={setSellerInputValue}
                    handleAddSeller={handleAddSeller}
                    showSellerDelete={showSellerDelete}
                    setShowSellerDelete={setShowSellerDelete}
                    setAvailableSellers={setAvailableSellers}
                    saveClientSellers={saveClientSellers}
                    selectedInvestors={editor.selectedInvestors}
                    setSelectedInvestors={editor.setSelectedInvestors}
                    client={client}
                    showNote={editor.showNote}
                    setShowNote={editor.setShowNote}
                    note={editor.note}
                    setNote={editor.setNote}
                    setNoteConfirmed={() => {}} // Placeholder if not used anymore
                    facturaFile={facturaFile}
                    setFacturaFile={setFacturaFile}
                    handleFacturaChange={handleFacturaChange}
                    handleStockSubmit={handleStockSubmit}
                    isSubmitting={isSubmitting}
                    facturaUploading={facturaUploading}
                    facturaDate={editor.facturaDate}
                    setFacturaDate={editor.setFacturaDate}
                    dueDate={editor.dueDate}
                    setDueDate={editor.setDueDate}
                    campaigns={campaigns}
                    selectedCampaignId={selectedCampaignId}
                    setSelectedCampaignId={setSelectedCampaignId}
                />
            )}
        </div>
    );
}
