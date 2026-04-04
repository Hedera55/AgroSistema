import { generateId } from '@/lib/uuid';
import { normalizeNumber } from '@/lib/numbers';
import { Lot, Product, Campaign, ClientStock, InventoryMovement, Order } from '@/types';

export interface HarvestProcessParams {
    db: any;
    clientId: string;
    lot: Lot;
    data: any; // From HarvestWizard
    campaigns: Campaign[];
    products: Product[];
    identity: {
        displayName: string;
    };
    updaters: {
        updateStock: (stock: any) => Promise<any>;
        updateLot: (lot: any) => Promise<any>;
        addProduct: (product: any) => Promise<Product>;
    };
    isEditing: boolean;
    existingBatchId?: string;
    existingOrder?: Order | null;
}

export const processHarvest = async (params: HarvestProcessParams) => {
    const { db, clientId, lot, data, campaigns, products, identity, updaters, isEditing, existingBatchId, existingOrder } = params;
    const { date, contractor, campaignId, laborPricePerHa, investor, harvestType: selectedHarvestType, totalYield, technicalResponsible, distributions, transportSheets: sheets } = data;

    const batchId = existingBatchId || (existingOrder as any)?.harvestBatchId || generateId();
    const campaign = campaigns.find(c => String(c.id) === String(campaignId));
    const campaignName = campaign?.name || '---';

    const cropBaseName = (lot.cropSpecies || 'Granos').replace(/^granos de /i, '');
    const productName = cropBaseName;
    const productType = selectedHarvestType === 'SEMILLA' ? 'SEED' : 'GRAIN';
    const propBrand = campaignName;

    // 1. Identify/Sync the Product
    let product: Product | undefined;

    // A) If editing, we MUST keep the same Product ID to ensure Sales "follow" the branding update
    if (isEditing && batchId) {
        const allMovs = await db.getAll('movements');
        // Capture legacy movements (no batchId) by checking ReferenceId + Date
        const oldMovs = allMovs.filter((m: any) => 
            ((m.harvestBatchId && m.harvestBatchId === batchId) || 
             (!m.harvestBatchId && m.type === 'HARVEST' && m.referenceId === lot.id && m.date === existingOrder?.date)) &&
            !m.deleted
        );
        
        const existingProdId = oldMovs[0]?.productId;
        
        if (existingProdId) {
            const existingProd = products.find(p => p.id === existingProdId);
            if (existingProd) {
                product = { ...existingProd, brandName: propBrand, updatedAt: new Date().toISOString() };
                await db.put('products', product);
            }
        }
    }

    // B) Fallback search by attributes if not found yet
    if (!product) {
        product = products.find(p =>
            p.name.toLowerCase() === productName.toLowerCase() &&
            p.type === productType &&
            p.brandName === propBrand &&
            p.clientId === clientId
        );
    }

    // C) Create new product if still missing (Fixes DataError by generating ID)
    if (!product && lot.cropSpecies) {
        const newId = generateId();
        product = await updaters.addProduct({
            id: newId,
            clientId,
            name: productName,
            type: productType,
            brandName: propBrand,
            commercialName: 'Propia',
            unit: 'kg',
            createdAt: new Date().toISOString(),
            synced: false
        });
    }

    if (!product) {
        throw new Error('No se pudo identificar o crear el cultivo del lote.');
    }

    // 2. Reversal (if editing)
    if (isEditing && batchId) {
        const allMovs = await db.getAll('movements');
        // Capture legacy movements (no batchId) by checking ReferenceId + Date
        const oldMovs = allMovs.filter((m: any) => 
            ((m.harvestBatchId && m.harvestBatchId === batchId) || 
             (!m.harvestBatchId && m.type === 'HARVEST' && m.referenceId === lot.id && m.date === existingOrder?.date)) &&
            !m.deleted
        );
        const allStock = await db.getAll('stock') as ClientStock[];

        for (const m of oldMovs) {
            if (m.warehouseId) {
                const existingStock = allStock.find(s => s.clientId === clientId && s.productId === m.productId && s.warehouseId === m.warehouseId);
                if (existingStock) {
                    await updaters.updateStock({
                        ...existingStock,
                        quantity: existingStock.quantity - m.quantity,
                        lastUpdated: new Date().toISOString()
                    });
                }
            }
            // Soft delete old movement logic
            await db.put('movements', { ...m, deleted: true, updatedAt: new Date().toISOString(), synced: false });
        }
    }

    // 3. Update Lot Status
    await updaters.updateLot({
        ...lot,
        status: 'HARVESTED',
        observedYield: totalYield,
        lastHarvestId: batchId,
        lastUpdatedBy: identity.displayName || 'Sistema'
    });

    const movementDate = date || new Date().toISOString().split('T')[0];
    const pricePerHa = normalizeNumber(laborPricePerHa);
    const totalCost = pricePerHa * lot.hectares;
    const normalizedTotalYield = normalizeNumber(totalYield);
    
    // 3.5 Birth Time Persistence: If editing, reuse original time. Otherwise use Now.
    let timeNow = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (isEditing && batchId) {
        const allMovs = await db.getAll('movements');
        const firstOld = allMovs.find((m: any) => 
            ((m.harvestBatchId && m.harvestBatchId === batchId) || 
             (!m.harvestBatchId && m.type === 'HARVEST' && m.referenceId === lot.id && m.date === existingOrder?.date)) &&
            !m.deleted && m.time
        );
        if (firstOld?.time) timeNow = firstOld.time;
    }

    // 4. Process Distributions
    for (const dist of distributions) {
        if (dist.type === 'WAREHOUSE') {
            const allStock = await db.getAll('stock') as ClientStock[];
            const existingStock = allStock.find(s => s.clientId === clientId && s.productId === product!.id && s.warehouseId === dist.targetId);
            const currentQty = existingStock?.quantity || 0;

            await updaters.updateStock({
                id: existingStock?.id || generateId(),
                clientId,
                warehouseId: dist.targetId,
                campaignId: campaignId || undefined,
                productId: product!.id,
                productBrand: propBrand,
                productCommercialName: 'propia',
                quantity: currentQty + dist.amount,
                source: 'HARVEST',
                lastUpdated: new Date().toISOString()
            });
        }

        const distSheets = (sheets || []).filter((s: any) => !s.distributionId || s.distributionId === dist.id);
        const isFirstDist = distributions.indexOf(dist) === 0;

        await db.put('movements', {
            ...dist.logistics,
            id: generateId(),
            clientId,
            farmId: lot.farmId,
            lotId: lot.id,
            warehouseId: dist.type === 'WAREHOUSE' ? dist.targetId : undefined,
            productId: product!.id,
            productName: product!.name,
            productBrand: propBrand,
            type: 'HARVEST',
            quantity: dist.amount,
            unit: product!.unit,
            date: movementDate,
            time: timeNow,
            referenceId: lot.id,
            campaignId: campaignId || undefined,
            notes: `Cosecha de lote ${lot.name}`,
            contractorName: contractor || undefined,
            harvestLaborPricePerHa: pricePerHa || undefined,
            harvestLaborCost: isFirstDist ? (totalCost || undefined) : 0,
            investorName: investor || undefined,
            investors: data.investors || [],
            receiverName: dist.type === 'PARTNER' ? dist.targetName : undefined,
            createdBy: identity.displayName || 'Sistema',
            createdAt: new Date().toISOString(),
            synced: false,
            harvestBatchId: batchId,
            source: 'HARVEST',
            technicalResponsible,
            transportSheets: distSheets.length > 0 ? distSheets : (sheets || []),
        });
    }

    // 5. Update/Create Order
    const orderData = {
        id: existingOrder?.id || generateId(),
        clientId,
        farmId: lot.farmId,
        lotId: lot.id,
        type: 'HARVEST' as const,
        status: 'DONE' as const,
        date: movementDate,
        time: timeNow,
        expectedYield: normalizedTotalYield,
        servicePrice: pricePerHa || undefined,
        contractorName: contractor || undefined,
        investorName: investor || undefined,
        items: existingOrder?.items || [],
        treatedArea: lot.hectares,
        campaignId: campaignId || undefined,
        createdBy: existingOrder?.createdBy || identity.displayName || 'Sistema',
        appliedBy: identity.displayName || 'Sistema',
        appliedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        synced: false,
        harvestBatchId: batchId,
        technicalResponsible,
        notes: `Cosecha de ${lot.cropSpecies || 'Cultivo'} en ${lot.name}`
    };

    await db.put('orders', orderData);

    return { batchId, productId: product.id };
};
