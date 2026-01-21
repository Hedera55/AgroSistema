import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { Product, Client, ClientStock } from '@/types';
import { generateId } from '@/lib/uuid';
import { syncService } from '@/services/sync';

export function useInventory() {
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const [allProducts, allClients] = await Promise.all([
                db.getAll('products'),
                db.getAll('clients')
            ]);
            setProducts(allProducts);
            setClients(allClients);
        } catch (error) {
            console.error("Failed to fetch inventory data", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
        const finalProduct = {
            ...product,
            id: product.id || generateId(),
            synced: false,
            updatedAt: new Date().toISOString()
        } as Product;
        await db.put('products', finalProduct);
        await refresh();
        syncService.pushChanges();
        return finalProduct;
    };

    const addClient = async (client: Omit<Client, 'id'> & { id?: string }) => {
        const finalClient = {
            ...client,
            id: client.id || generateId(),
            synced: false,
            updatedAt: new Date().toISOString()
        } as Client;
        await db.put('clients', finalClient);
        await refresh();
        syncService.pushChanges();
        return finalClient;
    };

    const deleteClient = async (clientId: string) => {
        await db.delete('clients', clientId);
        await refresh();
        syncService.pushChanges();
    };

    const deleteProduct = async (productId: string) => {
        await db.delete('products', productId);
        await refresh();
        syncService.pushChanges();
    };

    const updateProduct = async (product: Product) => {
        const updated = { ...product, synced: false, updatedAt: new Date().toISOString() };
        await db.put('products', updated);
        await refresh();
        syncService.pushChanges();
    };

    return { products, clients, loading, addProduct, updateProduct, deleteProduct, addClient, deleteClient, refresh };
}

export function useClientStock(clientId: string) {
    const [stock, setStock] = useState<ClientStock[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const allStock = await db.getAll('stock');
            const clientStock = allStock.filter((s: ClientStock) => s.clientId === clientId);
            setStock(clientStock);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const updateStock = async (item: Omit<ClientStock, 'id'> & { id?: string }) => {
        const finalItem = {
            ...item,
            id: item.id || generateId(),
            synced: false,
            updatedAt: new Date().toISOString()
        } as ClientStock;
        await db.put('stock', finalItem);
        await refresh();
        syncService.pushChanges();
        return finalItem;
    };

    return { stock, loading, updateStock, refresh };
}
