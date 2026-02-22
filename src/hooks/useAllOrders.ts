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
        try {
            const allOrders = await db.getAll('orders');
            // Filter by applicatorId for contractor
            const contractorOrders = allOrders
                .filter((o: Order) => o.applicatorId === profile.id && !o.deleted)
                .sort((a: Order, b: Order) => (b.orderNumber || 0) - (a.orderNumber || 0));
            setOrders(contractorOrders);
        } catch (error) {
            console.error('Error fetching all orders:', error);
        } finally {
            setLoading(false);
        }
    }, [profile?.id]);

    useEffect(() => {
        refreshOrders();
    }, [refreshOrders]);

    return {
        orders,
        loading,
        refreshOrders
    };
}
