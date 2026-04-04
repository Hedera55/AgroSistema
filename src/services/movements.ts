import { db } from './db';
import { InventoryMovement, ClientStock, MovementItem } from '@/types';
import { generateId } from '@/lib/uuid';
import { normalizeNumber } from '@/lib/numbers';

/**
 * Service to handle the core logic of adjusting stock levels when a movement is updated or deleted.
 * This ensures data integrity by reversing the old state and applying the new state atomically.
 */
export const movementService = {
    /**
     * Reverts the stock changes made by a specific movement.
     */
    /**
     * Reverts the stock changes made by a specific movement.
     */
    async reverseStock(clientId: string, movement: InventoryMovement, updateStock: (item: any) => Promise<any>) {
        if (movement.deleted) return;

        const allStock = await db.getAll('stock') as ClientStock[];
        const currentStockState = allStock.filter(s => s.clientId === clientId);

        // Subtractions undo: Add back the absolute quantity
        if (this.isSubtraction(movement.type)) {
            const m = movement as any;
            const st = this.findBestMatch(currentStockState, {
                productId: String(movement.productId),
                warehouseId: String(movement.warehouseId),
                stockId: m.stockId,
                campaignId: movement.campaignId ? String(movement.campaignId) : undefined,
                productBrand: movement.productBrand,
                presentationLabel: m.presentationLabel,
                presentationContent: m.presentationContent
            });

            if (st) {
                // Ensure we use the absolute quantity to avoid double-negative issues
                const absQty = Math.abs(movement.quantity);
                await updateStock({ ...st, quantity: st.quantity + absQty });
            }
        }
        // Additions undo: Subtract the absolute quantity
        else if (this.isAddition(movement.type)) {
            // Check for items list: Only use it if it actually contains items
            const m = movement as any;
            const items = (m.items && m.items.length > 0) ? m.items : [{
                productId: movement.productId,
                quantity: movement.quantity,
                productBrand: movement.productBrand,
                presentationLabel: m.presentationLabel,
                presentationContent: m.presentationContent,
                stockId: m.stockId
            }];

            for (const it of items) {
                const st = this.findBestMatch(currentStockState, {
                    productId: String(it.productId),
                    warehouseId: String(movement.warehouseId),
                    stockId: (it as any).stockId,
                    campaignId: movement.campaignId ? String(movement.campaignId) : undefined,
                    productBrand: it.productBrand,
                    presentationLabel: it.presentationLabel,
                    presentationContent: it.presentationContent
                });
                
                if (st) {
                    const absQty = Math.abs(it.quantity);
                    await updateStock({ ...st, quantity: st.quantity - absQty });
                }
            }
        }
    },

    /**
     * Applies new stock changes for a movement.
     */
    async applyStock(clientId: string, movement: Partial<InventoryMovement> & { type: string; warehouseId: string; quantity: number; productId: string; productBrand: string }, updateStock: (item: any) => Promise<any>) {
        const allStock = await db.getAll('stock') as ClientStock[];
        const currentStockState = allStock.filter(s => s.clientId === clientId);

        const m = movement as any;
        // CRITICAL FIX: Only use items array if it is not empty. If [], fall back to main quantity.
        const items = (m.items && m.items.length > 0) ? m.items : [{
            productId: movement.productId,
            quantity: movement.quantity,
            productBrand: movement.productBrand,
            presentationLabel: m.presentationLabel,
            presentationContent: m.presentationContent,
            stockId: m.stockId
        }];

        for (const it of items) {
            const isSub = this.isSubtraction(movement.type);
            const absQty = Math.abs(it.quantity);
            const qtyToApply = isSub ? -absQty : absQty;

            const st = this.findBestMatch(currentStockState, {
                productId: String(it.productId),
                warehouseId: String(movement.warehouseId),
                stockId: (it as any).stockId,
                campaignId: movement.campaignId ? String(movement.campaignId) : undefined,
                productBrand: it.productBrand,
                presentationLabel: it.presentationLabel,
                presentationContent: it.presentationContent
            });

            if (st) {
                await updateStock({ ...st, quantity: st.quantity + qtyToApply });
            } else {
                await updateStock({
                    id: (it as any).stockId || generateId(),
                    clientId,
                    warehouseId: String(movement.warehouseId),
                    productId: String(it.productId),
                    productBrand: it.productBrand || '',
                    campaignId: movement.campaignId ? String(movement.campaignId) : undefined,
                    quantity: qtyToApply,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    presentationLabel: it.presentationLabel || undefined,
                    presentationContent: it.presentationContent || undefined,
                });
            }
        }
    },

    /**
     * Identifies if a movement type should subtract from stock.
     */
    isSubtraction(type: string = ''): boolean {
        const t = String(type).toUpperCase().trim();
        return t === 'SALE' || t === 'OUT' || t === 'APPLICATION' || t === 'SOWING' || t === 'SALE_HARVEST';
    },

    /**
     * Identifies if a movement type should add to stock.
     */
    isAddition(type: string = ''): boolean {
        const t = String(type).toUpperCase().trim();
        return t === 'IN' || t === 'HARVEST' || t === 'PURCHASE';
    },

    /**
     * Finds the best stock match for a given set of attributes, prioritising IDs then precise attributes,
     * then falling back to relaxed campaign and brand matching if no exact match is found.
     */
    findBestMatch(stockState: ClientStock[], criteria: { productId: string; warehouseId: string; stockId?: string; campaignId?: string; productBrand?: string; presentationLabel?: string; presentationContent?: number }): ClientStock | undefined {
        const cleanProductId = String(criteria.productId);
        const cleanWarehouseId = String(criteria.warehouseId);
        const cleanCampaignId = criteria.campaignId ? String(criteria.campaignId) : undefined;
        
        // 1. Literal ID Match (Highest Priority)
        if (criteria.stockId) {
            const found = stockState.find(s => s.id === criteria.stockId);
            if (found) return found;
        }

        // 2. Full Attribute Match (Literal, normalized strings)
        const fullMatch = stockState.find(s =>
            String(s.productId) === cleanProductId &&
            String(s.warehouseId) === cleanWarehouseId &&
            (s.productBrand || '').toLowerCase().trim() === (criteria.productBrand || '').toLowerCase().trim() &&
            (s.campaignId ? String(s.campaignId) : undefined) === cleanCampaignId &&
            (s.presentationLabel || '') === (criteria.presentationLabel || '') &&
            (s.presentationContent || 0) === (criteria.presentationContent || 0)
        );
        if (fullMatch) return fullMatch;

        // 3. Relaxed Campaign Match (Ignore campaign ID)
        const relaxedCampMatch = stockState.find(s =>
            String(s.productId) === cleanProductId &&
            String(s.warehouseId) === cleanWarehouseId &&
            (s.productBrand || '').toLowerCase().trim() === (criteria.productBrand || '').toLowerCase().trim() &&
            (s.presentationLabel || '') === (criteria.presentationLabel || '') &&
            (s.presentationContent || 0) === (criteria.presentationContent || 0)
        );
        if (relaxedCampMatch) return relaxedCampMatch;

        // 4. Ultra Relaxed Match (Ignore brand too)
        const ultraRelaxedMatch = stockState.find(s =>
            String(s.productId) === cleanProductId &&
            String(s.warehouseId) === cleanWarehouseId &&
            (s.presentationLabel || '') === (criteria.presentationLabel || '') &&
            (s.presentationContent || 0) === (criteria.presentationContent || 0)
        );

        return ultraRelaxedMatch;
    }
};
