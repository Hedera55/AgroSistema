import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { syncService } from '@/services/sync';
import { Order, OrderItem, ClientStock } from '@/types';
import { generateId } from '@/lib/uuid';

export function useOrders(clientId: string) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshOrders = useCallback(async () => {
        if (!clientId) return;
        try {
            const allOrders = await db.getAll('orders');
            const clientOrders = allOrders
                .filter((o: Order) => o.clientId === clientId)
                .sort((a: Order, b: Order) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setOrders(clientOrders);
        } catch (error) {
            console.error('Error fetching orders:', error);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

    const addOrder = async (
        order: Order,
        items: OrderItem[],
        displayName: string
    ) => {
        try {
            // 1. Save Order
            const finalOrder = {
                ...order,
                synced: false,
                updatedAt: new Date().toISOString()
            };
            await db.put('orders', finalOrder);

            // 2. Log activity
            await db.logOrderActivity({
                orderId: order.id,
                orderNumber: order.orderNumber,
                clientId: order.clientId,
                action: 'CREATE',
                description: 'Orden creada',
                userName: displayName
            });

            // 3. Deduct Stock & Record Movements
            // We fetch the latest stock here to ensure atomic-like correctness
            const currentStock = await db.getAll('stock');
            const clientStock = currentStock.filter((s: ClientStock) => s.clientId === clientId);

            for (const item of items) {
                const stockItem = clientStock.find((s: ClientStock) =>
                    s.productId === item.productId &&
                    s.warehouseId === order.warehouseId
                );

                if (stockItem) {
                    await db.put('stock', {
                        ...stockItem,
                        quantity: stockItem.quantity - item.totalQuantity,
                        updatedAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        synced: false
                    });
                } else {
                    await db.put('stock', {
                        id: generateId(),
                        clientId: order.clientId,
                        warehouseId: order.warehouseId,
                        productId: item.productId,
                        quantity: -item.totalQuantity,
                        updatedAt: new Date().toISOString(),
                        lastUpdated: new Date().toISOString(),
                        synced: false
                    });
                }

                // Record Movement
                await db.put('movements', {
                    id: generateId(),
                    clientId: order.clientId,
                    warehouseId: order.warehouseId,
                    productId: item.productId,
                    productName: item.productName,
                    type: 'OUT',
                    quantity: item.totalQuantity,
                    unit: item.unit,
                    date: new Date().toISOString(),
                    time: new Date().toTimeString().split(' ')[0].substring(0, 5),
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
            await refreshOrders();
            return true;
        } catch (error) {
            console.error('Error adding order:', error);
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

            // --- AUTOMATED LOT STATUS UPDATE ---
            // If it's a SOWING order and it's being marked as DONE, update the Lot status
            if (order.type === 'SOWING' && newStatus === 'DONE') {
                const lot = await db.get('lots', order.lotId);
                if (lot) {
                    // We assume the first item in a SOWING order is the seed/crop
                    const sowedCrop = order.items?.[0]?.productName || 'Desconocido';
                    await db.put('lots', {
                        ...lot,
                        cropSpecies: sowedCrop,
                        status: 'SOWED',
                        updatedAt: new Date().toISOString(),
                        synced: false
                    });
                }
            }
            // ------------------------------------

            await db.logOrderActivity({
                orderId: order.id,
                orderNumber: order.orderNumber,
                clientId: clientId,
                action: 'STATUS_CHANGE',
                description: `Orden cambió de ${order.status === 'DONE' ? 'APLICADA' : 'PENDIENTE'} a ${newStatus === 'DONE' ? 'APLICADA' : 'PENDIENTE'}`,
                userName: displayName
            });

            await syncService.pushChanges();
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

            await db.delete('orders', orderId);

            await db.logOrderActivity({
                orderId: orderId,
                orderNumber: order.orderNumber,
                clientId: clientId,
                action: 'DELETE',
                description: 'Orden eliminada',
                userName: displayName
            });

            await syncService.pushChanges();
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
