import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { Order } from '@/types';
import { useAuth } from './useAuth';

export function useAllOrders() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const { profile } = useAuth();

    const refreshOrders = useCallback(async () => {
        if (!profile?.id) return;
        const { isAdmin, isMaster } = {
            isAdmin: profile.role === 'ADMIN' || profile.role === 'MASTER_ADMIN',
            isMaster: profile.role === 'MASTER_ADMIN'
        };

        try {
            const allOrders = await db.getAll('orders');

            const filteredOrders = allOrders
                .filter((o: Order) => {
                    // Always exclude harvest orders from these lists
                    if (o.type === 'HARVEST') return false;
                    if (o.deleted) return false;

                    if (isMaster) return true;
                    if (isAdmin) {
                        // Admins see orders for their assigned clients
                        return profile.assigned_clients?.includes(o.clientId);
                    }
                    // Contractors see orders where they are the applicator
                    return o.applicatorId === profile.id;
                })
                .sort((a: Order, b: Order) => (b.orderNumber || 0) - (a.orderNumber || 0));

            setOrders(filteredOrders);
        } catch (error) {
            console.error('Error fetching all orders:', error);
        } finally {
            setLoading(false);
        }
    }, [profile]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

    return {
        orders,
        loading,
        refreshOrders
    };
}
