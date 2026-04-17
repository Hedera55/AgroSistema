import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { syncService } from '@/services/sync';
import { Order, OrderItem, ClientStock } from '@/types';
import { generateId } from '@/lib/uuid';
import { movementService } from '@/services/movements';

export function useOrders(clientId: string) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshOrders = useCallback(async () => {
        if (!clientId) return;
        try {
            const clientOrders = await db.getAllByClient('orders', clientId);
            const filteredOrders = clientOrders
                .filter((o: Order) => !o.deleted && o.type !== 'HARVEST')
                .sort((a: Order, b: Order) => (b.orderNumber || 0) - (a.orderNumber || 0));
            setOrders(filteredOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refreshOrders();
        window.addEventListener('ordersUpdated', refreshOrders);
        return () => window.removeEventListener('ordersUpdated', refreshOrders);
    }, [refreshOrders]);

    const addOrder = async (
        order: Order,
        items: OrderItem[],
        displayName: string
    ) => {
        try {
            // Check if editing (id already exists)
            const existingOrder = await db.get('orders', order.id);
            if (existingOrder) {
                // REVERSAL LOGIC: Restore stock from previous movements
                const originalMovements = (await db.getAllByClient('movements', clientId)).filter((m: any) => m.referenceId === order.id && !m.deleted);
                
                // Capture original "Birth Time" from first movement
                let birthTime = new Date().toTimeString().split(' ')[0].substring(0, 5);
                if (originalMovements.length > 0 && originalMovements[0].time) {
                    birthTime = originalMovements[0].time;
                }

                for (const m of originalMovements) {
                    // Restore stock
                    const stockItems = await db.getAllByClient('stock', clientId);
                    const candidate = stockItems.find((s: ClientStock) =>
                        s.productId === m.productId &&
                        s.warehouseId === m.warehouseId
                    );

                    if (candidate) {
                        await db.put('stock', {
                            ...candidate,
                            quantity: candidate.quantity + m.quantity,
                            updatedAt: new Date().toISOString(),
                            synced: false
                        });
                    } else {
                        // If stock entry was deleted for some reason, recreate it
                        await db.put('stock', {
                            id: generateId(),
                            clientId: clientId,
                            productId: m.productId,
                            warehouseId: m.warehouseId,
                            quantity: m.quantity,
                            lastUpdated: new Date().toISOString(),
                            synced: false
                        });
                    }

                    // Soft-delete old movement
                    await db.put('movements', {
                        ...m,
                        deleted: true,
                        deletedAt: new Date().toISOString(),
                        synced: false
                    });
                }

                await db.logOrderActivity({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    clientId: order.clientId,
                    action: 'STATUS_CHANGE',
                    description: 'Orden editada/actualizada',
                    userName: displayName
                });
            } else {
                // New Order
                await db.logOrderActivity({
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    clientId: order.clientId,
                    action: 'CREATE',
                    description: 'Orden creada',
                    userName: displayName
                });
            }

            // 1. Save Order
            const finalOrder = {
                ...order,
                synced: false,
                updatedAt: new Date().toISOString()
            };
            await db.put('orders', finalOrder);

            // 3. Deduct Stock & Record Movements
            const clientStock = await db.getAllByClient('stock', clientId);

            for (const item of items) {
                // SKIP stock deduction for Virtual Deficits
                if (item.isVirtualDéficit) continue;

                const effectiveWarehouseId = item.warehouseId;
                if (!effectiveWarehouseId) continue;

                // Find all stock candidates for this product and warehouse
                const candidates = clientStock.filter((s: ClientStock) =>
                    s.productId === item.productId &&
                    s.warehouseId === effectiveWarehouseId
                ).sort((a: ClientStock, b: ClientStock) => {
                    const aHasPresentation = !!(a.presentationLabel || a.presentationContent);
                    const bHasPresentation = !!(b.presentationLabel || b.presentationContent);
                    if (aHasPresentation !== bHasPresentation) return aHasPresentation ? 1 : -1;
                    return (a.quantity || 0) - (b.quantity || 0);
                });

                let remaining = item.totalQuantity;

                if (candidates.length > 0) {
                    for (const stockItem of candidates) {
                        if (remaining <= 0.0001) break;

                        const deductAmount = Math.min(stockItem.quantity, remaining);
                        const newQuantity = stockItem.quantity - deductAmount;

                        await db.put('stock', {
                            ...stockItem,
                            quantity: newQuantity,
                            updatedAt: new Date().toISOString(),
                            lastUpdated: new Date().toISOString(),
                            synced: false
                        });

                        remaining -= deductAmount;
                    }
                }

                // If still remaining (no stock or not enough), create/update a negative entry
                if (remaining > 0.0001) {
                    if (candidates.length > 0) {
                        const firstCandidate = candidates[0];
                        const currentInDb = await db.get('stock', firstCandidate.id) as ClientStock;
                        await db.put('stock', {
                            ...currentInDb,
                            quantity: (currentInDb.quantity || 0) - remaining,
                            updatedAt: new Date().toISOString(),
                            synced: false
                        });
                    } else {
                        await db.put('stock', {
                            id: generateId(),
                            clientId: order.clientId,
                            warehouseId: effectiveWarehouseId,
                            productId: item.productId,
                            quantity: -remaining,
                            updatedAt: new Date().toISOString(),
                            lastUpdated: new Date().toISOString(),
                            synced: false
                        });
                    }
                }

                // Record Movement
                const birthTime = (await db.getAllByClient('movements', clientId))
                    .filter((m: any) => m.referenceId === order.id && !m.deleted)
                    .find((m: any) => m.time)?.time || new Date().toTimeString().split(' ')[0].substring(0, 5);

                await db.put('movements', {
                    id: generateId(),
                    clientId: order.clientId,
                    warehouseId: effectiveWarehouseId,
                    productId: item.productId,
                    productName: item.productName,
                    type: 'OUT',
                    quantity: item.totalQuantity,
                    unit: item.unit,
                    date: order.applicationDate || order.date,
                    time: birthTime,
                    referenceId: order.id,
                    notes: `Orden Nro ${order.orderNumber ?? '-'}`,
                    createdBy: displayName,
                    synced: false,
                    updatedAt: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                });
            }

            // Sync all changes
            await syncService.pushChanges();
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            await refreshOrders();
            return true;
        } catch (error) {
            console.error('Error adding/updating order:', error);
            throw error;
        }
    };

    const updateOrderStatus = async (
        orderId: string,
        newStatus: 'PENDING' | 'DONE' | undefined,
        displayName: string,
        auditData?: { appliedBy?: string; appliedAt?: string },
        newPrice?: number
    ) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) throw new Error('Order not found');

            const updatedOrder = {
                ...order,
                ...auditData,
                status: newStatus || order.status,
                servicePrice: newPrice !== undefined ? newPrice : order.servicePrice,
                updatedAt: new Date().toISOString(),
                updatedBy: displayName,
                synced: false
            };

            await db.put('orders', updatedOrder);

            // --- AUTOMATED LOT STATUS UPDATE (MULTI-LOT SUPPORT) ---
            if (order.type === 'SOWING') {
                const lotIds = order.lotIds && order.lotIds.length > 0 ? order.lotIds : (order.lotId ? [order.lotId] : []);
                
                for (const lid of lotIds) {
                    const lot = await db.get('lots', lid);
                    if (lot) {
                        if (newStatus === 'DONE') {
                            // Apply Sowing: Stamp ID and status
                            const seedItem = order.items?.find(i => i.productType === 'SEED');
                            const sowedCrop = seedItem?.productName || order.items?.[0]?.productName || 'Desconocido';
                            await db.put('lots', {
                                ...lot,
                                status: 'SOWED',
                                cropSpecies: sowedCrop,
                                currentSowingOrderId: order.id, // THE TRACING LINK
                                updatedAt: new Date().toISOString(),
                                synced: false
                            });
                        } else if (newStatus === 'PENDING') {
                            // Revert Sowing: Clear status and link
                            await db.put('lots', {
                                ...lot,
                                status: 'EMPTY',
                                cropSpecies: '',
                                currentSowingOrderId: undefined,
                                yield: 0,
                                observedYield: 0,
                                updatedAt: new Date().toISOString(),
                                synced: false
                            });
                        }
                    }
                }
            }
            // -------------------------------------------------------

            await db.logOrderActivity({
                orderId: order.id,
                orderNumber: order.orderNumber,
                clientId: clientId,
                action: 'STATUS_CHANGE',
                description: `Orden cambió de ${order.status === 'DONE' ? 'APLICADA' : 'PENDIENTE'} a ${newStatus === 'DONE' ? 'APLICADA' : 'PENDIENTE'}`,
                userName: displayName
            });

            await syncService.pushChanges();
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            await refreshOrders();
        } catch (error) {
            console.error('Error updating order status:', error);
            throw error;
        }
    };

    const deleteOrder = async (orderId: string, displayName: string) => {
        try {
            const order = orders.find(o => o.id === orderId);
            if (!order) throw new Error('Order not found');

            // 1. Soft-delete the order
            await db.put('orders', {
                ...order,
                deleted: true,
                deletedAt: new Date().toISOString(),
                deletedBy: displayName,
                synced: false
            });

            // 2. Soft-delete associated movements and REVERSE STOCK
            const associatedMovements = (await db.getAllByClient('movements', clientId)).filter((m: any) => m.referenceId === orderId && !m.deleted);
            
            for (const m of associatedMovements) {
                // Correctly undo the stock change before deleting the movement
                await movementService.reverseStock(clientId, m, async (updatedStock) => {
                    await db.put('stock', updatedStock);
                });

                await db.put('movements', {
                    ...m,
                    deleted: true,
                    deletedAt: new Date().toISOString(),
                    deletedBy: displayName,
                    synced: false
                });
            }

            await db.logOrderActivity({
                orderId: orderId,
                orderNumber: order.orderNumber,
                clientId: clientId,
                action: 'DELETE',
                description: 'Orden eliminada (soft-delete)',
                userName: displayName
            });

            await syncService.pushChanges();
            window.dispatchEvent(new CustomEvent('ordersUpdated'));
            await refreshOrders();
        } catch (error) {
            console.error('Error deleting order:', error);
            throw error;
        }
    };

    return {
        orders,
        loading,
        addOrder,
        updateOrderStatus,
        deleteOrder,
        refreshOrders
    };
}
