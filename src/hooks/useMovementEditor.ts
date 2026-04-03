import { useState, useCallback, useEffect } from 'react';
import { InventoryMovement, Order, Product, Warehouse, Client, ClientStock, Campaign, MovementItem } from '@/types';
import { db } from '@/services/db';
import { syncService } from '@/services/sync';
import { normalizeNumber } from '@/lib/numbers';
import { generateId } from '@/lib/uuid';
import { movementService } from '@/services/movements';

/**
 * Reusable hook to manage the state and logic for editing stock movements.
 * Can be used in Stock History, Contaduría, or anywhere else an edit button is needed.
 */
export function useMovementEditor(clientId: string, { 
    productsData, 
    campaigns, 
    stock, 
    updateStock, 
    onSuccess 
}: { 
    productsData: Record<string, Product>,
    campaigns: Campaign[],
    stock: ClientStock[],
    updateStock: (item: any) => Promise<any>,
    onSuccess?: () => void
}) {
    const [editingMovement, setEditingMovement] = useState<InventoryMovement | null>(null);
    const [showEditForm, setShowEditForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State (Shared for SALE/OUT and PURCHASE/IN)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
    const [selectedCampaignId, setSelectedCampaignId] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [selectedInvestors, setSelectedInvestors] = useState<{ name: string; percentage: number }[]>([]);
    
    // SALE Specific
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    // SALE Logistics
    const [saleTruckDriver, setSaleTruckDriver] = useState('');
    const [salePlateNumber, setSalePlateNumber] = useState('');
    const [saleTrailerPlate, setSaleTrailerPlate] = useState('');
    const [saleDestinationCompany, setSaleDestinationCompany] = useState('');
    const [saleDestinationAddress, setSaleDestinationAddress] = useState('');
    const [saleTransportCompany, setSaleTransportCompany] = useState('');
    const [saleDischargeNumber, setSaleDischargeNumber] = useState('');
    const [saleHumidity, setSaleHumidity] = useState('');
    const [saleHectoliterWeight, setSaleHectoliterWeight] = useState('');
    const [saleGrossWeight, setSaleGrossWeight] = useState('');
    const [saleTareWeight, setSaleTareWeight] = useState('');
    const [salePrimarySaleCuit, setSalePrimarySaleCuit] = useState('');
    const [saleDepartureDateTime, setSaleDepartureDateTime] = useState('');
    const [saleDistanceKm, setSaleDistanceKm] = useState('');
    const [saleFreightTariff, setSaleFreightTariff] = useState('');

    // PURCHASE/IN Specific
    const [stockItems, setStockItems] = useState<{ productId: string; quantity: string; price: string; tempBrand: string; presentationLabel?: string; presentationContent?: string; presentationAmount?: string; }[]>([]);
    const [activeStockItem, setActiveStockItem] = useState({ productId: '', quantity: '', price: '', tempBrand: '', presentationLabel: '', presentationContent: '', presentationAmount: '' });
    const [facturaDate, setFacturaDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selectedSeller, setSelectedSeller] = useState('');

    const startEdit = useCallback((m: InventoryMovement) => {
        setEditingMovement(m);
        setSelectedWarehouseId(m.warehouseId || '');
        setSelectedCampaignId(m.campaignId || '');
        setNote(m.notes || '');
        setShowNote(!!m.notes);
        setSelectedInvestors(m.investors || []);

        if (m.type === 'SALE' || m.type === 'OUT') {
            const product = productsData[m.productId];
            const isGrainOrSeedSale = (product?.type === 'GRAIN' || product?.type === 'SEED') && m.type === 'SALE';
            
            setSaleQuantity(isGrainOrSeedSale ? (m.quantity / 1000).toString() : m.quantity.toString());
            setSalePrice(isGrainOrSeedSale ? (Number(m.salePrice || 0) * 1000).toLocaleString('es-AR') : (m.salePrice || 0).toString());
            
            // Logistics
            const l = m as any;
            setSaleTruckDriver(l.truckDriver || '');
            setSalePlateNumber(l.plateNumber || '');
            setSaleTrailerPlate(l.trailerPlate || '');
            setSaleDestinationCompany(l.destinationCompany || l.deliveryLocation || '');
            setSaleDestinationAddress(l.destinationAddress || '');
            setSaleTransportCompany(l.transportCompany || '');
            setSaleDischargeNumber(l.dischargeNumber || '');
            setSaleHumidity(l.humidity?.toString() || '');
            setSaleHectoliterWeight(l.hectoliterWeight?.toString() || '');
            setSaleGrossWeight(l.grossWeight?.toString() || '');
            setSaleTareWeight(l.tareWeight?.toString() || '');
            setSalePrimarySaleCuit(l.primarySaleCuit || '');
            setSaleDepartureDateTime(l.departureDateTime || '');
            setSaleDistanceKm(l.distanceKm?.toString() || '');
            setSaleFreightTariff(l.freightTariff?.toString() || '');

            setStockItems([]);
        } else {
            const items = m.items || [{
                productId: m.productId,
                quantity: m.quantity.toString(),
                price: (m.purchasePrice || 0).toString(),
                tempBrand: m.productBrand || '',
                presentationLabel: (m as any).presentationLabel || '',
                presentationContent: (m as any).presentationContent?.toString() || '',
                presentationAmount: (m as any).presentationAmount?.toString() || ''
            }];
            
            setStockItems(items.map(it => ({
                productId: it.productId,
                quantity: it.quantity.toString(),
                price: ((it as any).price || (it as any).purchasePrice || 0).toString(),
                tempBrand: (it as any).productBrand || '',
                presentationLabel: it.presentationLabel || '',
                presentationContent: it.presentationContent?.toString() || '',
                presentationAmount: it.presentationAmount?.toString() || ''
            })));
            
            setFacturaDate(m.date || '');
            setSelectedSeller(m.sellerName || '');
        }
        setShowEditForm(true);
    }, [productsData]);

    const saveEdit = useCallback(async () => {
        if (!editingMovement) return;
        setIsSubmitting(true);

        try {
            // 1. Revert Old Stock
            await movementService.reverseStock(clientId, editingMovement, updateStock);

            // 2. Prepare Data for SALE/OUT
            if (editingMovement.type === 'SALE' || editingMovement.type === 'OUT') {
                const isSale = editingMovement.type === 'SALE';
                const product = productsData[editingMovement.productId];
                const isGrainOrSeedSale = (product?.type === 'GRAIN' || product?.type === 'SEED') && isSale;
                
                const qtyNumRaw = normalizeNumber(saleQuantity);
                const priceNumRaw = normalizeNumber(salePrice);
                
                const qtyNum = isGrainOrSeedSale ? qtyNumRaw * 1000 : qtyNumRaw;
                const priceNum = isGrainOrSeedSale ? priceNumRaw / 1000 : priceNumRaw;

                const updatedMovement = {
                    ...editingMovement,
                    warehouseId: selectedWarehouseId || undefined,
                    campaignId: selectedCampaignId || undefined,
                    quantity: qtyNum,
                    salePrice: isSale ? priceNum : undefined,
                    amount: qtyNum * priceNum,
                    notes: note,
                    investors: selectedInvestors,
                    updatedAt: new Date().toISOString(),
                    synced: false,
                    // Logistics
                    truckDriver: saleTruckDriver || undefined,
                    plateNumber: salePlateNumber || undefined,
                    trailerPlate: saleTrailerPlate || undefined,
                    destinationCompany: saleDestinationCompany || undefined,
                    destinationAddress: saleDestinationAddress || undefined,
                    transportCompany: saleTransportCompany || undefined,
                    dischargeNumber: saleDischargeNumber || undefined,
                    humidity: saleHumidity ? normalizeNumber(saleHumidity) : undefined,
                    hectoliterWeight: saleHectoliterWeight ? normalizeNumber(saleHectoliterWeight) : undefined,
                    grossWeight: saleGrossWeight ? normalizeNumber(saleGrossWeight) : undefined,
                    tareWeight: saleTareWeight ? normalizeNumber(saleTareWeight) : undefined,
                    primarySaleCuit: salePrimarySaleCuit || undefined,
                    departureDateTime: saleDepartureDateTime || undefined,
                    distanceKm: saleDistanceKm ? normalizeNumber(saleDistanceKm) : undefined,
                    freightTariff: saleFreightTariff ? normalizeNumber(saleFreightTariff) : undefined,
                };

                // 3. Apply New Stock
                await movementService.applyStock(clientId, updatedMovement as any, updateStock);
                await db.put('movements', updatedMovement);
            } 
            // 2. Prepare Data for PURCHASE/IN
            else {
                const allItems = [...stockItems];
                if (activeStockItem.productId && activeStockItem.quantity) allItems.push(activeStockItem);
                const validItems = allItems.filter(it => it.productId && it.quantity);

                const movementItems: MovementItem[] = validItems.map(it => {
                    const product = productsData[it.productId];
                    const camp = campaigns.find(c => c.id === selectedCampaignId);
                    const campaignName = camp?.name || '---';
                    const isHarvest = editingMovement.type === 'HARVEST';

                    return {
                        id: (it as any).id || generateId(),
                        productId: it.productId,
                        productName: product?.name || '',
                        productBrand: isHarvest ? campaignName : (it.tempBrand || product?.brandName || '').toLowerCase().trim(),
                        quantity: normalizeNumber(it.quantity),
                        unit: product?.unit || 'kg',
                        price: it.price ? normalizeNumber(it.price) : 0,
                        presentationLabel: it.presentationLabel || undefined,
                        presentationContent: it.presentationContent ? normalizeNumber(it.presentationContent) : undefined,
                        presentationAmount: it.presentationAmount ? normalizeNumber(it.presentationAmount) : undefined
                    };
                });

                const updatedMovement = {
                    ...editingMovement,
                    warehouseId: selectedWarehouseId || undefined,
                    campaignId: selectedCampaignId || undefined,
                    items: movementItems,
                    quantity: movementItems.reduce((acc, it) => acc + it.quantity, 0),
                    amount: movementItems.reduce((acc, it) => acc + (it.quantity * (it.price || 0)), 0),
                    notes: note,
                    investors: selectedInvestors,
                    updatedAt: new Date().toISOString(),
                    synced: false
                };

                // 3. Apply New Stock
                await movementService.applyStock(clientId, updatedMovement as any, updateStock);
                await db.put('movements', updatedMovement);
            }

            syncService.pushChanges();
            setShowEditForm(false);
            setEditingMovement(null);
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error('Error saving movement edit:', e);
            alert('Error al guardar los cambios.');
        } finally {
            setIsSubmitting(false);
        }
    }, [
        clientId, editingMovement, selectedWarehouseId, selectedCampaignId, note, saleQuantity, salePrice, 
        stockItems, activeStockItem, productsData, campaigns, updateStock, onSuccess,
        saleTruckDriver, salePlateNumber, saleTrailerPlate, saleDestinationCompany, saleDestinationAddress,
        saleTransportCompany, saleDischargeNumber, saleHumidity, saleHectoliterWeight,
        saleGrossWeight, saleTareWeight, salePrimarySaleCuit, saleDepartureDateTime,
        saleDistanceKm, saleFreightTariff, selectedInvestors
    ]);

    // Sale Note automation (Mirroring the Galpón UI logic)
    useEffect(() => {
        if (editingMovement?.type === 'SALE' && salePrice) {
            const product = productsData[editingMovement.productId];
            if (product) {
                const isGrainOrSeed = product.type === 'GRAIN' || product.type === 'SEED';
                const unitPriceLabel = isGrainOrSeed ? 'USD/Ton' : `USD/${product.unit || 'ud'}`;
                setNote(`${salePrice} ${unitPriceLabel}`);
            }
        }
    }, [editingMovement, salePrice, productsData]);

    return {
        editingMovement,
        setEditingMovement,
        showEditForm,
        setShowEditForm,
        isSubmitting,
        startEdit,
        saveEdit,
        // Form States
        selectedWarehouseId, setSelectedWarehouseId,
        selectedCampaignId, setSelectedCampaignId,
        note, setNote,
        showNote, setShowNote,
        selectedInvestors, setSelectedInvestors,
        // Sale States
        saleQuantity, setSaleQuantity,
        salePrice, setSalePrice,
        saleTruckDriver, setSaleTruckDriver,
        salePlateNumber, setSalePlateNumber,
        saleTrailerPlate, setSaleTrailerPlate,
        saleDestinationCompany, setSaleDestinationCompany,
        saleDestinationAddress, setSaleDestinationAddress,
        saleTransportCompany, setSaleTransportCompany,
        saleDischargeNumber, setSaleDischargeNumber,
        saleHumidity, setSaleHumidity,
        saleHectoliterWeight, setSaleHectoliterWeight,
        saleGrossWeight, setSaleGrossWeight,
        saleTareWeight, setSaleTareWeight,
        salePrimarySaleCuit, setSalePrimarySaleCuit,
        saleDepartureDateTime, setSaleDepartureDateTime,
        saleDistanceKm, setSaleDistanceKm,
        saleFreightTariff, setSaleFreightTariff,
        // Purchase States
        stockItems, setStockItems,
        activeStockItem, setActiveStockItem,
        facturaDate, setFacturaDate,
        dueDate, setDueDate,
        selectedSeller, setSelectedSeller
    };
}
