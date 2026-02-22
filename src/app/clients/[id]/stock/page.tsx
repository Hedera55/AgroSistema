'use client';

import React, { use, useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useClientStock, useInventory, useClientMovements } from '@/hooks/useInventory';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { db } from '@/services/db';
import { ProductType, Unit, InventoryMovement, MovementItem, ClientStock, Product, Observation } from '@/types';
import { generateId } from '@/lib/uuid';
import { useAuth } from '@/hooks/useAuth';
import { syncService } from '@/services/sync';
import { supabase } from '@/lib/supabase';
import { StockMovementPanel } from '@/components/StockMovementPanel';
import { usePDF } from '@/hooks/usePDF';
import { WarehouseManager } from './components/WarehouseManager';
import { ProductCatalog } from './components/ProductCatalog';
import { StockEntryForm } from './components/StockEntryForm';
import { StockTable } from './components/StockTable';

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

export default function ClientStockPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { role, isMaster, profile, displayName } = useAuth();
    const { stock, updateStock, deleteStock, loading: stockLoading } = useClientStock(id);
    const { warehouses, addWarehouse, updateWarehouse, deleteWarehouse, loading: warehousesLoading } = useWarehouses(id);
    const { products, addProduct, updateProduct, deleteProduct, loading: productsLoading } = useInventory(); // Added deleteProduct
    const { movements, loading: movementsLoading, refresh: movementsRefresh } = useClientMovements(id);
    const { campaigns, loading: campaignsLoading } = useCampaigns(id);

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
    const [note, setNote] = useState('');
    const [noteConfirmed, setNoteConfirmed] = useState(false);
    // const [selectedInvestor, setSelectedInvestor] = useState(''); -> Replaced by selectedInvestors array
    const [selectedInvestors, setSelectedInvestors] = useState<{ name: string; percentage: number }[]>([]);
    const [showNote, setShowNote] = useState(false);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [isEditingProduct, setIsEditingProduct] = useState(false);
    const [editingProductId, setEditingProductId] = useState<string | null>(null);

    // Multi-product entry state
    const [activeStockItem, setActiveStockItem] = useState({
        productId: '',
        quantity: '',
        price: '',
        tempBrand: '',
        presentationLabel: '',
        presentationContent: '',
        presentationAmount: ''
    });
    const [stockItems, setStockItems] = useState<{
        productId: string;
        quantity: string;
        price: string;
        tempBrand: string;
        presentationLabel?: string;
        presentationContent?: string;
        presentationAmount?: string;
    }[]>([]);

    // Factura upload state
    const [sellingStockId, setSellingStockId] = useState<string | null>(null);
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [saleNote, setSaleNote] = useState('');
    const [showSaleNote, setShowSaleNote] = useState(false);
    const [saleFacturaFile, setSaleFacturaFile] = useState<File | null>(null);
    const [facturaFile, setFacturaFile] = useState<File | null>(null);
    const [facturaDate, setFacturaDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');

    const [facturaUploading, setFacturaUploading] = useState(false);

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
    const [selectedSeller, setSelectedSeller] = useState('');

    // Success Ribbon State
    const [lastMovement, setLastMovement] = useState<InventoryMovement | null>(null);
    const [lastAction, setLastAction] = useState<'IN' | 'WITHDRAW' | 'TRANSFER' | 'SALE' | null>(null);
    const [lastTransferOrigin, setLastTransferOrigin] = useState<string>('');

    const { generateRemitoPDF } = usePDF();

    const unitInputRef = useRef<HTMLDivElement>(null);
    const warehouseContainerRef = useRef<HTMLDivElement>(null);

    // Handle file selection
    const handleFacturaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFacturaFile(e.target.files[0]);
        }
    };

    // Upload factura to Supabase Storage and return public URL
    const uploadFactura = async (movementId: string) => {
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
    };

    const [client, setClient] = useState<any>(null);
    useEffect(() => {
        db.get('clients', id).then(setClient);
    }, [id]);

    const handleSetDefaultWarehouse = async (warehouseId: string) => {
        if (!client) return;
        const updatedClient = { ...client, defaultHarvestWarehouseId: warehouseId, updatedAt: new Date().toISOString(), synced: false };
        await db.put('clients', updatedClient);
        setClient(updatedClient);
        syncService.pushChanges();
    };

    // Persistence for form state
    useEffect(() => {
        const savedNote = sessionStorage.getItem(`stock_note_${id}`);
        const savedShowNote = sessionStorage.getItem(`stock_showNote_${id}`);

        if (savedNote) setNote(savedNote);
        if (savedShowNote === 'true') setShowNote(true);

        const savedShowStockForm = sessionStorage.getItem(`stock_showStockForm_${id}`);
        const savedShowProductForm = sessionStorage.getItem(`stock_showProductForm_${id}`);
        const savedShowCatalog = sessionStorage.getItem(`stock_showCatalog_${id}`);
        const savedShowWarehouses = sessionStorage.getItem(`stock_showWarehouses_${id}`);
        const savedActiveW = sessionStorage.getItem(`stock_activeW_${id}`);

        if (savedShowStockForm === 'true') setShowStockForm(true);
        if (savedShowProductForm === 'true') setShowProductForm(true);
        if (savedShowCatalog === 'true') setShowCatalog(true);
        if (savedShowWarehouses === 'true') setShowWarehouses(true);
        if (savedActiveW) setActiveWarehouseIds(JSON.parse(savedActiveW));
    }, [id]);

    const toggleWarehouseSelection = (warehouseId: string) => {
        setActiveWarehouseIds(prev =>
            prev.includes(warehouseId)
                ? prev.filter(id => id !== warehouseId)
                : [...prev, warehouseId]
        );
    };

    const setAllWarehouses = (ids: string[]) => {
        setActiveWarehouseIds(ids);
    };

    useEffect(() => {
        sessionStorage.setItem(`stock_showStockForm_${id}`, showStockForm.toString());
    }, [showStockForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showProductForm_${id}`, showProductForm.toString());
    }, [showProductForm, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showCatalog_${id}`, showCatalog.toString());
    }, [showCatalog, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showWarehouses_${id}`, showWarehouses.toString());
    }, [showWarehouses, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_activeW_${id}`, JSON.stringify(activeWarehouseIds));
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
        if (note) sessionStorage.setItem(`stock_note_${id}`, note);
        else sessionStorage.removeItem(`stock_note_${id}`);
    }, [note, id]);

    useEffect(() => {
        sessionStorage.setItem(`stock_showNote_${id}`, showNote.toString());
    }, [showNote, id]);


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
    const saveClientUnits = async (newUnits: string[]) => {
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
    };

    const saveClientSellers = async (newSellers: string[]) => {
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
    };

    const handleAddUnit = () => {
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
    };

    const handleAddSeller = () => {
        if (sellerInputValue.trim()) {
            const formatted = sellerInputValue.trim();
            if (!availableSellers.includes(formatted)) {
                const newSellers = [...availableSellers, formatted];
                setAvailableSellers(newSellers);
                saveClientSellers(newSellers);
                updateActiveStockItem('seller', formatted);
            }
            setSellerInputValue('');
            setShowSellerInput(false);
        }
    };

    // Filter products: show ONLY client-specific ones (Strict Per-Client Isolation)
    const availableProducts = useMemo(() => {
        return products.filter(p => p.clientId === id);
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
        // 1. Group movements to calculate weighted averages
        // key: productId_brand or normalized_name
        const purchasePricing = new Map<string, { totalVal: number; totalQty: number }>();
        const salePricing = new Map<string, { totalVal: number; totalQty: number }>();

        const updateStats = (map: Map<string, { totalVal: number; totalQty: number }>, key: string, qty: number, val: number) => {
            if (!key) return;
            const entry = map.get(key) || { totalVal: 0, totalQty: 0 };
            entry.totalVal += val;
            entry.totalQty += qty;
            map.set(key, entry);
        };

        movements.forEach(m => {
            if (m.type === 'IN') {
                if (m.productId === 'CONSOLIDATED' && m.items) {
                    m.items.forEach((item: any) => {
                        const cost = item.quantity * (item.price || 0);
                        // 1. Specific ID
                        updateStats(purchasePricing, item.productId, item.quantity, cost);
                        // 2. Generic Name
                        if (item.productName) {
                            updateStats(purchasePricing, item.productName.toLowerCase().trim(), item.quantity, cost);
                        }
                    });
                } else {
                    const cost = m.quantity * (m.purchasePrice || m.price || 0);
                    // 1. Specific ID
                    updateStats(purchasePricing, m.productId, m.quantity, cost);
                    // 2. Generic Name
                    if (m.productName) {
                        updateStats(purchasePricing, m.productName.toLowerCase().trim(), m.quantity, cost);
                    }
                }
            } else if (m.type === 'SALE') {
                const cost = m.quantity * (m.salePrice || 0);
                // 1. Specific ID
                updateStats(salePricing, m.productId, m.quantity, cost);
                // 2. Generic Name
                const nameKey = (m.crop || m.productName || '').toLowerCase().trim();
                updateStats(salePricing, nameKey, m.quantity, cost);
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
            const commercialName = (product?.commercialName || '').toLowerCase().trim();

            const key = `${item.productId}_${brand}`;

            let avgPrice = 0;
            const saleDataSpecific = salePricing.get(item.productId);
            const saleDataGeneric = salePricing.get(normalizedName);

            if (saleDataSpecific && saleDataSpecific.totalQty > 0) {
                avgPrice = saleDataSpecific.totalVal / saleDataSpecific.totalQty;
            } else if (saleDataGeneric && saleDataGeneric.totalQty > 0) {
                avgPrice = saleDataGeneric.totalVal / saleDataGeneric.totalQty;
            } else {
                const purchaseDataSpecific = purchasePricing.get(item.productId);
                const purchaseDataGeneric = purchasePricing.get(normalizedName);

                if (purchaseDataSpecific && purchaseDataSpecific.totalQty > 0) {
                    avgPrice = purchaseDataSpecific.totalVal / purchaseDataSpecific.totalQty;
                } else if (purchaseDataGeneric && purchaseDataGeneric.totalQty > 0) {
                    avgPrice = purchaseDataGeneric.totalVal / purchaseDataGeneric.totalQty;
                }
            }

            if (combined.has(key)) {
                const existing = combined.get(key)!;
                existing.quantity += item.quantity;
                if (!existing.breakdown) existing.breakdown = [];
                existing.breakdown.push(item);
            } else {
                combined.set(key, {
                    ...item,
                    productName: product?.name || 'Producto Desconocido',
                    warehouseName: activeWarehouseIds.length > 1 ? 'Múltiples' : (warehouse?.name || (item.warehouseId === null && warehouses[0] ? warehouses[0].name : 'Galpón')),
                    productType: product?.type || 'OTHER',
                    unit: product?.unit || 'UNIT',
                    price: avgPrice,
                    productBrand: item.productBrand || product?.brandName || '',
                    productCommercialName: product?.commercialName || (brand === 'propia' ? 'Propia' : ''),
                    hasProduct: !!product,
                    campaignId: item.campaignId,
                    breakdown: [item]
                });
            }
        });

        return Array.from(combined.values()).filter(item => item.hasProduct);
    }, [stock, products, warehouses, activeWarehouseIds, movements]);

    // Auto-update Sale Note with pricing details
    useEffect(() => {
        if (sellingStockId && saleQuantity && salePrice) {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (stockItem) {
                const qtyNum = parseFloat(saleQuantity.replace(',', '.'));
                const priceNum = parseFloat(salePrice.replace(',', '.'));
                if (!isNaN(qtyNum) && !isNaN(priceNum)) {
                    // Logic: User enters Tons, we store Kg. Note reflects the user's input (Tons)
                    setSaleNote(`${priceNum} USD/Ton, USD ${(qtyNum * priceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total`);
                }
            }
        }
    }, [sellingStockId, saleQuantity, salePrice, enrichedStock]);

    const handleProductSubmit = async (e: React.FormEvent) => {
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
                    clientId: id
                });
            }

            setNewProductName('');
            setNewProductBrand('');
            setNewProductCommercialName('');
            setNewProductPA('');
            setEditingProductId(null);
            setIsEditingProduct(false);
            setShowProductForm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleStockSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Include active items if present
        const allItemsToProcess = [...stockItems];
        if (activeStockItem.productId && activeStockItem.quantity) {
            allItemsToProcess.push(activeStockItem);
        }

        const validItems = allItemsToProcess.filter(item => item.productId && item.quantity);
        if (validItems.length === 0) return;

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
                const qtyNum = parseFloat(item.quantity.replace(',', '.'));
                const priceNum = item.price ? parseFloat(item.price.replace(',', '.')) : 0;
                const pLabel = (item.presentationLabel || '').trim();
                const pContent = item.presentationContent ? parseFloat(item.presentationContent.replace(',', '.')) : 0;
                const pAmount = item.presentationAmount ? parseFloat(item.presentationAmount.replace(',', '.')) : 0;
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
                    quantity: existingInLoop
                        ? existingInLoop.quantity + qtyNum
                        : qtyNum,
                    lastUpdated: now.toISOString(),
                    updatedAt: now.toISOString(),
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

                movementItems.push({
                    id: generateId(),
                    productId: item.productId,
                    productName: product?.name || 'Unknown',
                    productCommercialName: product?.commercialName || '-',
                    productBrand: item.tempBrand || product?.brandName || '',
                    quantity: qtyNum,
                    unit: product?.unit || 'L',
                    price: priceNum,
                    sellerName: selectedSeller || undefined,
                    presentationLabel: pLabel || undefined,
                    presentationContent: pContent || 0,
                    presentationAmount: pAmount || 0
                });
            }

            const movementData: InventoryMovement = {
                id: movementId,
                clientId: id,
                warehouseId: selectedWarehouseId || undefined,
                productId: 'CONSOLIDATED', // Marker for multi-item
                productName: 'Compra de insumos',
                type: 'IN',
                quantity: validItems.length, // count of products
                unit: 'items',
                date: dateStr,
                time: timeStr,
                referenceId: `PURCHASE-${movementId}`,
                notes: note || '-',
                facturaImageUrl: facturaUrl || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false,
                // investorName: selectedInvestor || undefined, -> Deprecated in favor of investors array
                investors: selectedInvestors,
                sellerName: selectedSeller || undefined,
                facturaDate: facturaDate || undefined,
                dueDate: dueDate || undefined,
                campaignId: selectedCampaignId || undefined,
                items: movementItems
            };

            await db.put('movements', movementData);
            setLastMovement(movementData);
            setLastAction('IN');

            await movementsRefresh();
            syncService.pushChanges();

            // Reset
            setStockItems([]);
            setActiveStockItem({
                productId: '',
                quantity: '',
                price: '',
                tempBrand: '',
                presentationLabel: '',
                presentationContent: '',
                presentationAmount: ''
            });
            setSelectedWarehouseId('');
            setNote('');
            setNoteConfirmed(false);
            setShowNote(false);
            setFacturaDate('');
            setDueDate('');
            setSelectedCampaignId('');
            setSelectedInvestors([]);
            setSelectedSeller('');
            setShowStockForm(false);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!sellingStockId || !saleQuantity || !salePrice) return;

        setIsSubmitting(true);
        try {
            const stockItem = enrichedStock.find(s => s.id === sellingStockId);
            if (!stockItem) return;

            const qtyInTons = parseFloat(saleQuantity.replace(',', '.'));
            const priceInTons = parseFloat(salePrice.replace(',', '.'));

            if (isNaN(qtyInTons) || isNaN(priceInTons)) return;

            const qtyNum = qtyInTons * 1000; // Store as Kg
            const priceNum = priceInTons / 1000; // Store as USD/Kg

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
                salePrice: priceNum,
                date: new Date().toISOString().split('T')[0],
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                referenceId: `SALE-${generateId()}`,
                notes: saleNote || `${priceNum} USD/ ${stockItem.unit}, USD ${(qtyNum * priceNum).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Total`,
                facturaImageUrl: facturaUrl || undefined,
                createdBy: displayName || 'Sistema',
                createdAt: new Date().toISOString(),
                synced: false,
                truckDriver: saleTruckDriver || undefined,
                plateNumber: salePlateNumber || undefined,
                deliveryLocation: saleDestination || undefined,
                trailerPlate: saleTrailerPlate || undefined,
                humidity: saleHumidity ? parseFloat(saleHumidity.replace(',', '.')) : undefined,
                dischargeNumber: saleDischargeNumber || undefined,
                transportCompany: saleTransportCompany || undefined,
                hectoliterWeight: saleHectoliterWeight ? parseFloat(saleHectoliterWeight.replace(',', '.')) : undefined,
                grossWeight: saleGrossWeight ? parseFloat(saleGrossWeight.replace(',', '.')) : undefined,
                tareWeight: saleTareWeight ? parseFloat(saleTareWeight.replace(',', '.')) : undefined
            };

            await db.put('movements', movementData);

            await movementsRefresh();
            setLastMovement(movementData);
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
            setSaleTruckDriver('');
            setSalePlateNumber('');
            setSaleDestination('');
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleConfirmMove = async (action: 'WITHDRAW' | 'TRANSFER', quantities: Record<string, number>, destinationWarehouseId?: string, note?: string, receiverName?: string, logistics?: any) => {
        // quantities here is a map of specific stock IDs to their selected quantities
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let createdMovement: InventoryMovement | null = null;

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
                productName: product?.name || 'Producto Desconocido',
                productCommercialName: product?.commercialName || '',
                productBrand: stockRecord.productBrand || '-',
                type: 'OUT',
                quantity: qtyToMove,
                unit: product?.unit || 'u.',
                date: dateStr,
                time: timeStr,
                referenceId: `MOVE-${now.getTime()}`,
                notes: `${action === 'WITHDRAW' ? 'Retiro de stock' : 'Traslado a ' + (warehouses.find(w => w.id === destinationWarehouseId)?.name || 'galpón')} - ${stockRecord.presentationLabel || ''} ${stockRecord.presentationContent || ''} - ${note || ''}`,
                createdBy: displayName || 'Sistema',
                createdAt: now.toISOString(),
                synced: false,
                receiverName: action === 'WITHDRAW' ? (receiverName || undefined) : undefined,
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
                        lastUpdated: now.toISOString()
                    });
                }

                // IN movement record
                const transferInMovement: InventoryMovement = {
                    id: generateId(),
                    clientId: id,
                    warehouseId: destinationWarehouseId,
                    productId: stockRecord.productId,
                    productName: product?.name || 'Producto Desconocido',
                    productCommercialName: product?.commercialName || '',
                    productBrand: stockRecord.productBrand || '-',
                    type: 'IN',
                    quantity: qtyToMove,
                    unit: product?.unit || 'u.',
                    date: dateStr,
                    time: timeStr,
                    referenceId: `MOVE-${now.getTime()}`,
                    notes: `Transferencia desde ${warehouse?.name || 'Galpón'} - ${stockRecord.presentationLabel || ''} ${stockRecord.presentationContent || ''} - ${note || ''}`,
                    createdBy: displayName || 'Sistema',
                    createdAt: now.toISOString(),
                    synced: false
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
    };

    const toggleStockSelection = (id: string, e: React.MouseEvent) => {
        // Prevent if clicking on actions or links
        if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('a')) return;

        setSelectedStockIds(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    const handleClearSelection = () => {
        setSelectedStockIds([]);
        setShowMovePanel(false);
    };

    const deductStockQuantity = async (productId: string, brand: string, qtyToDeduct: number, warehouseId?: string) => {
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
    };

    const handleDeleteProduct = async (productId: string) => {
        if (!confirm('¿Está seguro que desea eliminar este producto del catálogo? Esto no eliminará el historial pero podría afectar la visualización de stock actual.')) return;
        try {
            await deleteProduct(productId);
        } catch (e) {
            console.error(e);
            alert('Error al eliminar producto');
        }
    };

    const handleEditBrand = async (stockId: string, currentBrand: string) => {
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
            if (confirm(`Ya existe stock de este producto con la marca "${newBrand}". ¿Desea unificar ambos registros?\n\nCantidad actual: ${item.quantity}\nCantidad en "${newBrand}": ${existingItem.quantity}\nTotal resultante: ${item.quantity + existingItem.quantity}`)) {
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
    };

    const addStockToBatch = () => {
        if (!activeStockItem.productId || !activeStockItem.quantity) return;

        // Normalize commas to dots before adding to batch
        const normalizedItem = {
            ...activeStockItem,
            quantity: activeStockItem.quantity.replace(',', '.'),
            price: activeStockItem.price.replace(',', '.'),
            presentationContent: activeStockItem.presentationContent.replace(',', '.'),
            presentationAmount: activeStockItem.presentationAmount.replace(',', '.')
        };

        setStockItems([...stockItems, { ...normalizedItem }]);
        setActiveStockItem({
            productId: '',
            quantity: '',
            price: '',
            tempBrand: '',
            presentationLabel: '',
            presentationContent: '',
            presentationAmount: ''
        });
    };

    const removeBatchItem = (idx: number) => {
        setStockItems(stockItems.filter((_, i) => i !== idx));
    };

    const editBatchItem = (idx: number) => {
        const itemToEdit = stockItems[idx];
        setActiveStockItem({
            ...itemToEdit,
            presentationLabel: itemToEdit.presentationLabel || '',
            presentationContent: itemToEdit.presentationContent || '',
            presentationAmount: itemToEdit.presentationAmount || ''
        });
        setStockItems(stockItems.filter((_, i) => i !== idx));
    };

    const updateActiveStockItem = (field: string, value: string) => {
        setActiveStockItem(prev => {
            const newState = { ...prev, [field]: value };

            // Auto-calculate quantity if presentation content or amount changes
            if (field === 'presentationContent' || field === 'presentationAmount') {
                const contentVal = (field === 'presentationContent' ? value : (prev.presentationContent || ''));
                const amountVal = (field === 'presentationAmount' ? value : (prev.presentationAmount || ''));

                const content = parseFloat(contentVal.toString().replace(',', '.'));
                const amount = parseFloat(amountVal.toString().replace(',', '.'));

                if (!isNaN(content) && !isNaN(amount)) {
                    newState.quantity = (content * amount).toString();
                }
            }

            return newState;
        });
    };

    const productTypes: ProductType[] = ['HERBICIDE', 'FERTILIZER', 'SEED', 'FUNGICIDE', 'INSECTICIDE', 'COADYUVANTE', 'INOCULANTE', 'OTHER'];

    const typeLabels: Record<string, string> = {
        HERBICIDE: 'Herbicida',
        FERTILIZER: 'Fertilizante',
        SEED: 'Semilla',
        FUNGICIDE: 'Fungicida',
        INSECTICIDE: 'Insecticida',
        COADYUVANTE: 'Coadyuvante',
        INOCULANTE: 'Inoculante',
        OTHER: 'Otro'
    };

    const handleImportProducts = async (importedProducts: any[]) => {
        setIsSubmitting(true);
        try {
            let importedCount = 0;
            for (const p of importedProducts) {
                // Check if exists
                const exists = availableProducts.find(existing =>
                    (existing.activeIngredient || '').toLowerCase() === (p.activeIngredient || '').toLowerCase() &&
                    (existing.brandName || '').toLowerCase() === (p.brandName || '').toLowerCase() &&
                    (existing.commercialName || '').toLowerCase() === (p.commercialName || '').toLowerCase() &&
                    existing.type === p.type
                );

                if (!exists) {
                    await addProduct({
                        name: p.name, // Fallback if PA missing, or just name
                        brandName: p.brandName,
                        commercialName: p.commercialName,
                        activeIngredient: p.activeIngredient || p.name,
                        type: p.type,
                        unit: p.unit,
                        clientId: id
                    });
                    importedCount++;
                }
            }
            if (importedCount > 0) alert(`${importedCount} productos importados.`);
            else alert('No se importaron productos nuevos (todos ya existían).');
        } catch (error) {
            console.error('Import error:', error);
            alert('Error al importar productos.');
        } finally {
            setIsSubmitting(false);
        }
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
                                        onClick={() => setShowMovePanel(true)}
                                        className="bg-emerald-600 hover:bg-emerald-700 animate-fadeIn"
                                    >
                                        Mover Stock ({selectedStockIds.length})
                                    </Button>

                                    {activeWarehouseIds.length === 1 && warehouses.find(w => w.id === activeWarehouseIds[0])?.name === 'Acopio de Granos' && (
                                        <Button
                                            onClick={() => {
                                                if (sellingStockId) {
                                                    setSellingStockId(null);
                                                    return;
                                                }

                                                if (selectedStockIds.length === 1) {
                                                    const item = enrichedStock.find(s => s.id === selectedStockIds[0]);
                                                    const campaign = item?.campaignId ? campaigns.find(c => c.id === item.campaignId) : null;

                                                    if (campaign?.mode === 'GRAIN') {
                                                        alert('No se permiten ventas en campañas de modo COSECHA. Los socios deben realizar retiros.');
                                                        return;
                                                    }

                                                    if (item) {
                                                        setSellingStockId(item.id);
                                                        setSaleQuantity(item.quantity.toString());
                                                    }
                                                } else {
                                                    alert('Por favor selecciona un solo producto para vender.');
                                                }
                                            }}
                                            variant={sellingStockId ? "secondary" : "primary"}
                                            className={`${sellingStockId ? "bg-slate-100 hover:bg-slate-200 text-slate-700" : "bg-emerald-600 hover:bg-emerald-700 text-white"} animate-fadeIn`}
                                        >
                                            {sellingStockId ? 'Cancelar Vender' : 'Vender'}
                                        </Button>
                                    )}
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
                                {lastMovement.productName} ({lastMovement.productBrand}) - {lastMovement.quantity} {lastMovement.unit}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {(lastAction === 'WITHDRAW' || lastAction === 'SALE') && (
                            <Button
                                onClick={async () => {
                                    const client = await db.get('clients', id) as any;
                                    const warehouse = warehouses.find(w => w.id === lastMovement.warehouseId);
                                    if (client && warehouse) {
                                        generateRemitoPDF(lastMovement, client, warehouse.name);
                                    }
                                }}
                                variant="outline"
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            >
                                📄 Descargar Remito
                            </Button>
                        )}
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
                sellingStockId={sellingStockId}
                handleSaleSubmit={handleSaleSubmit}
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
                saleDestination={saleDestination}
                setSaleDestination={setSaleDestination}
                saleTrailerPlate={saleTrailerPlate}
                setSaleTrailerPlate={setSaleTrailerPlate}
                saleHumidity={saleHumidity}
                setSaleHumidity={setSaleHumidity}
                saleDischargeNumber={saleDischargeNumber}
                setSaleDischargeNumber={setSaleDischargeNumber}
                saleTransportCompany={saleTransportCompany}
                setSaleTransportCompany={setSaleTransportCompany}
                saleHectoliterWeight={saleHectoliterWeight}
                setSaleHectoliterWeight={setSaleHectoliterWeight}
                saleGrossWeight={saleGrossWeight}
                setSaleGrossWeight={setSaleGrossWeight}
                saleTareWeight={saleTareWeight}
                setSaleTareWeight={setSaleTareWeight}
                showSaleNote={showSaleNote}
                setShowSaleNote={setShowSaleNote}
                saleNote={saleNote}
                setSaleNote={setSaleNote}
                saleFacturaFile={saleFacturaFile}
                setSaleFacturaFile={setSaleFacturaFile}
                products={products}
                clearSelection={handleClearSelection}
            />


            {/* Stock Movement Panel (Moved to bottom) */}
            {showMovePanel && (
                <StockMovementPanel
                    selectedIds={selectedStockIds}
                    stockItems={enrichedStock}
                    warehouses={warehouses}
                    activeWarehouseIds={activeWarehouseIds}
                    onConfirm={handleConfirmMove}
                    onCancel={() => setShowMovePanel(false)}
                    investors={client?.investors || client?.partners || []}
                    campaigns={campaigns}
                    movements={movements}
                />
            )}

            <div className="flex justify-end pr-2 pb-4 gap-2 flex-wrap">
                {!isReadOnly && (
                    <button
                        onClick={() => setShowWarehouses(!showWarehouses)}
                        className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showWarehouses ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                    >
                        {showWarehouses ? 'Cerrar gestión de galpón' : 'Gestionar Galpones'}
                    </button>
                )}
                {!isReadOnly && (
                    <button
                        onClick={() => setShowCatalog(!showCatalog)}
                        className={`text-xs px-4 py-2 rounded-full border shadow-sm transition-all font-medium ${showCatalog ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:text-emerald-600 hover:bg-white'}`}
                    >
                        {showCatalog ? 'Cerrar catálogo' : 'Catálogo de productos'}
                    </button>
                )}
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
                addWarehouse={async (name) => { await addWarehouse(name); }}
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

            <StockEntryForm
                showStockForm={showStockForm}
                setShowStockForm={setShowStockForm}
                warehouses={warehouses}
                activeWarehouseIds={activeWarehouseIds}
                selectedWarehouseId={selectedWarehouseId}
                setSelectedWarehouseId={setSelectedWarehouseId}
                availableProducts={availableProducts}
                activeStockItem={activeStockItem}
                updateActiveStockItem={updateActiveStockItem}
                stockItems={stockItems}
                setStockItems={setStockItems}
                addStockToBatch={addStockToBatch}
                editBatchItem={editBatchItem}
                removeBatchItem={removeBatchItem}
                availableSellers={availableSellers}
                selectedSeller={selectedSeller}
                setSelectedSeller={setSelectedSeller}
                showSellerInput={showSellerInput}
                setShowSellerInput={setShowSellerInput}
                sellerInputValue={sellerInputValue}
                setSellerInputValue={setSellerInputValue}
                handleAddSeller={handleAddSeller}
                showSellerDelete={showSellerDelete}
                setShowSellerDelete={setShowSellerDelete}
                setAvailableSellers={setAvailableSellers}
                saveClientSellers={saveClientSellers}
                selectedInvestors={selectedInvestors}
                setSelectedInvestors={setSelectedInvestors}
                client={client}
                showNote={showNote}
                setShowNote={setShowNote}
                note={note}
                setNote={setNote}
                setNoteConfirmed={setNoteConfirmed}
                facturaFile={facturaFile}
                setFacturaFile={setFacturaFile}
                handleFacturaChange={handleFacturaChange}
                handleStockSubmit={handleStockSubmit}
                isSubmitting={isSubmitting}
                facturaUploading={facturaUploading}
                facturaDate={facturaDate}
                setFacturaDate={setFacturaDate}
                dueDate={dueDate}
                setDueDate={setDueDate}
                campaigns={campaigns}
                selectedCampaignId={selectedCampaignId}
                setSelectedCampaignId={setSelectedCampaignId}
            />
        </div >
    );
}
