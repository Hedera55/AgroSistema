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
    async reverseStock(clientId: string, movement: InventoryMovement, updateStock: (item: any) => Promise<any>) {
        if (movement.deleted) return;

        const allStock = await db.getAll('stock') as ClientStock[];
        const currentStockState = allStock.filter(s => s.clientId === clientId);

        // Case 1: Sale or Out (Was subtraction, now add back)
        if (movement.type === 'SALE' || movement.type === 'OUT') {
            const st = currentStockState.find(s =>
                s.productId === movement.productId &&
                s.warehouseId === movement.warehouseId &&
                (s.productBrand || '').toLowerCase().trim() === (movement.productBrand || '').toLowerCase().trim() &&
                (s.campaignId || undefined) === (movement.campaignId || undefined) &&
                (s.presentationLabel || '') === ((movement as any).presentationLabel || '') &&
                (s.presentationContent || 0) === ((movement as any).presentationContent || 0)
            );

            if (st) {
                await updateStock({ ...st, quantity: st.quantity + movement.quantity });
            }
        }
        // Case 2: In or Harvest (Was addition, now subtract)
        else if (movement.type === 'IN' || movement.type === 'HARVEST' || movement.type === 'PURCHASE') {
            const items = movement.items || [{
                productId: movement.productId,
                quantity: movement.quantity,
                productBrand: movement.productBrand,
                presentationLabel: (movement as any).presentationLabel,
                presentationContent: (movement as any).presentationContent
            }];

            for (const it of items) {
                const st = currentStockState.find(s =>
                    s.productId === it.productId &&
                    s.warehouseId === movement.warehouseId &&
                    (s.campaignId || undefined) === (movement.campaignId || undefined) &&
                    (s.productBrand || '').toLowerCase().trim() === (it.productBrand || '').toLowerCase().trim() &&
                    (s.presentationLabel || '') === (it.presentationLabel || '') &&
                    (s.presentationContent || 0) === (it.presentationContent || 0)
                );
                if (st) {
                    await updateStock({ ...st, quantity: st.quantity - it.quantity });
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

        const items = (movement as any).items || [{
            productId: movement.productId,
            quantity: movement.quantity,
            productBrand: movement.productBrand,
            presentationLabel: (movement as any).presentationLabel,
            presentationContent: (movement as any).presentationContent
        }];

        for (const it of items) {
            const isSubtraction = movement.type === 'SALE' || movement.type === 'OUT';
            const qtyToApply = isSubtraction ? -it.quantity : it.quantity;

            const st = currentStockState.find(s =>
                s.productId === it.productId &&
                s.warehouseId === movement.warehouseId &&
                (s.campaignId || undefined) === (movement.campaignId || undefined) &&
                (s.productBrand || '').toLowerCase().trim() === (it.productBrand || '').toLowerCase().trim() &&
                (s.presentationLabel || '') === (it.presentationLabel || '') &&
                (s.presentationContent || 0) === (it.presentationContent || 0)
            );

            if (st) {
                await updateStock({ ...st, quantity: st.quantity + qtyToApply });
            } else {
                await updateStock({
                    id: generateId(),
                    clientId,
                    warehouseId: movement.warehouseId,
                    productId: it.productId,
                    productBrand: it.productBrand || '',
                    campaignId: movement.campaignId || undefined,
                    quantity: qtyToApply,
                    lastUpdated: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    presentationLabel: it.presentationLabel || undefined,
                    presentationContent: it.presentationContent || undefined,
                });
            }
        }
    }
};
