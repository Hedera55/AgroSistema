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
            const [productsData, clientsData] = await Promise.all([
                db.getAll('products'),
                db.getAll('clients')
            ]);
            setProducts(productsData.filter((p: any) => !p.deleted));
            setClients(clientsData.filter((c: any) => !c.deleted));
        } catch (error) {
            console.error('Error loading inventory:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addProduct = async (product: Omit<Product, 'id'> & { id?: string }) => {
        // 1. Check if a product with same name AND brand already exists for this client
        const allProducts = await db.getAll('products');
        const existing = allProducts.find((p: Product) =>
            p.clientId === product.clientId &&
            p.name.toLowerCase().trim() === product.name.toLowerCase().trim() &&
            (p.brandName || '').toLowerCase().trim() === (product.brandName || '').toLowerCase().trim() &&
            !p.deleted
        );

        if (existing) {
            console.log('Found existing product, merging:', existing.id);
            return existing;
        }

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

        // Auto-create default Warehouses
        const harvestWarehouse = {
            id: generateId(),
            clientId: finalClient.id,
            name: 'Acopio de Granos',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            synced: false,
            deleted: false
        };
        const defaultWarehouse = {
            id: generateId(),
            clientId: finalClient.id,
            name: 'Galpón',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            synced: false,
            deleted: false
        };

        await Promise.all([
            db.put('warehouses', harvestWarehouse),
            db.put('warehouses', defaultWarehouse)
        ]);

        await refresh();
        syncService.pushChanges();
        return finalClient;
    };

    const deleteClient = async (clientId: string) => {
        const client = await db.get('clients', clientId);
        if (client) {
            await db.put('clients', {
                ...client,
                deleted: true,
                deletedAt: new Date().toISOString(),
                synced: false
            });
            await refresh();
            syncService.pushChanges();
        }
    };

    const deleteProduct = async (productId: string) => {
        const product = await db.get('products', productId);
        if (product) {
            await db.put('products', {
                ...product,
                deleted: true,
                deletedAt: new Date().toISOString(),
                synced: false
            });
            await refresh();
            syncService.pushChanges();
        }
    };

    const updateProduct = async (product: Product) => {
        const updated = { ...product, synced: false, updatedAt: new Date().toISOString() };
        await db.put('products', updated);
        await refresh();
        syncService.pushChanges();
    };

    const updateClient = async (client: Client) => {
        const updated = { ...client, synced: false, updatedAt: new Date().toISOString() };
        await db.put('clients', updated);
        await refresh();
        syncService.pushChanges();
    };

    return { products, clients, loading, addProduct, updateProduct, deleteProduct, addClient, deleteClient, updateClient, refresh };
}

export function useClientStock(clientId: string) {
    const [stock, setStock] = useState<ClientStock[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) {
            setLoading(false);
            return;
        }
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

    const deleteStock = async (id: string) => {
        await db.delete('stock', id);
        await refresh();
        syncService.pushChanges();
    };

    return { stock, loading, updateStock, deleteStock, refresh };
}

export function useClientMovements(clientId: string) {
    const [movements, setMovements] = useState<any[]>([]); // Use simplified type to avoid circular dep if needed, or import InventoryMovement
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const allMovements = await db.getAll('movements');
            const clientMovements = allMovements.filter((m: any) => m.clientId === clientId && !m.deleted);
            // Sort by date desc
            clientMovements.sort((a: any, b: any) => new Date(b.date + 'T' + (b.time || '00:00')).getTime() - new Date(a.date + 'T' + (a.time || '00:00')).getTime());
            setMovements(clientMovements);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { movements, loading, refresh };
}
