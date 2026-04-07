import { openDB, DBSchema, StoreNames } from 'idb';
import { Client, Farm, Lot, Product, ClientStock, Order } from '@/types';

interface AgronomicDB extends DBSchema {
    clients: {
        key: string;
        value: Client;
    };
    farms: {
        key: string;
        value: Farm;
        indexes: { 'by-client': string };
    };
    lots: {
        key: string;
        value: Lot;
        indexes: { 'by-farm': string };
    };
    products: {
        key: string;
        value: Product;
    };
    stock: {
        key: string; // Composite key or generated ID
        value: ClientStock;
        indexes: { 'by-client': string; 'by-product': string };
    };
    orders: {
        key: string;
        value: Order;
        indexes: { 'by-client': string; 'by-date': string; 'by-status': string };
    };
    movements: {
        key: string;
        value: import('@/types').InventoryMovement;
        indexes: { 'by-client': string; 'by-product': string; 'by-date': string };
    };
    order_activities: {
        key: string;
        value: import('@/types').OrderActivity;
        indexes: { 'by-order': string; 'by-client': string };
    };
    warehouses: {
        key: string;
        value: import('@/types').Warehouse;
        indexes: { 'by-client': string };
    };
    observations: {
        key: string;
        value: import('@/types').Observation;
        indexes: { 'by-client': string; 'by-farm': string; 'by-lot': string };
    };
    campaigns: {
        key: string;
        value: import('@/types').Campaign;
        indexes: { 'by-client': string };
    };
    campaign_snapshots: {
        key: string;
        value: import('@/types').CampaignSnapshot;
        indexes: { 'by-client': string; 'by-campaign': string };
    };
}

const DB_NAME = 'agronomic-db';
const DB_VERSION = 8; // Added campaign_snapshots

export const dbPromise = typeof window !== 'undefined'
    ? openDB<AgronomicDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            // Clients
            if (!db.objectStoreNames.contains('clients')) {
                db.createObjectStore('clients', { keyPath: 'id' });
            }

            // Farms
            if (!db.objectStoreNames.contains('farms')) {
                const store = db.createObjectStore('farms', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
            }

            // Lots
            if (!db.objectStoreNames.contains('lots')) {
                const store = db.createObjectStore('lots', { keyPath: 'id' });
                store.createIndex('by-farm', 'farmId');
            }

            // Products
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }

            // Stock
            if (!db.objectStoreNames.contains('stock')) {
                const store = db.createObjectStore('stock', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
                store.createIndex('by-product', 'productId');
            }

            // Orders
            if (!db.objectStoreNames.contains('orders')) {
                const store = db.createObjectStore('orders', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
                store.createIndex('by-date', 'date');
                store.createIndex('by-status', 'status');
            }

            // Movements
            if (!db.objectStoreNames.contains('movements')) {
                const store = db.createObjectStore('movements', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
                store.createIndex('by-product', 'productId');
                store.createIndex('by-date', 'date');
            }

            // Order Activities
            if (!db.objectStoreNames.contains('order_activities')) {
                const store = db.createObjectStore('order_activities', { keyPath: 'id' });
                store.createIndex('by-order', 'orderId');
                store.createIndex('by-client', 'clientId');
            }

            // Warehouses
            if (!db.objectStoreNames.contains('warehouses')) {
                const store = db.createObjectStore('warehouses', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
            }
            // Observations
            if (!db.objectStoreNames.contains('observations')) {
                const store = db.createObjectStore('observations', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
                store.createIndex('by-farm', 'farmId');
                store.createIndex('by-lot', 'lotId');
            }
            if (!db.objectStoreNames.contains('campaigns')) {
                const store = db.createObjectStore('campaigns', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
            }
            if (!db.objectStoreNames.contains('campaign_snapshots')) {
                const store = db.createObjectStore('campaign_snapshots', { keyPath: 'id' });
                store.createIndex('by-client', 'clientId');
                store.createIndex('by-campaign', 'campaignId');
            }
        },
    }) : Promise.resolve(null as any);

// Helper for data access
const cache = new Map<string, any[]>();

export const db = {
    // Helper to clear cache entries for a store (handles both global and client-keyed caches)
    invalidateCache(storeName: string) {
        const keys = Array.from(cache.keys());
        keys.forEach(key => {
            if (key === storeName || key.startsWith(`${storeName}:`)) {
                cache.delete(key);
            }
        });
    },

    async getAll<Name extends StoreNames<AgronomicDB>>(storeName: Name) {
        if (cache.has(storeName)) {
            return cache.get(storeName)!;
        }
        const dbInstance = await dbPromise;
        if (!dbInstance) return [];
        const result = await dbInstance.getAll(storeName);
        cache.set(storeName, result);
        return result;
    },

    async getAllByClient<Name extends StoreNames<AgronomicDB>>(storeName: Name, clientId: string) {
        const cacheKey = `${storeName}:${clientId}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey)!;
        }
        const dbInstance = await dbPromise;
        if (!dbInstance) return [];
        
        let result;
        try {
            const tx = dbInstance.transaction(storeName, 'readonly');
            const store = tx.store;
            if (store.indexNames.contains('by-client')) {
                result = await dbInstance.getAllFromIndex(storeName, 'by-client', clientId);
            } else {
                // Fallback filtering if index doesn't exist
                const all = await dbInstance.getAll(storeName);
                result = all.filter((item: any) => item.clientId === clientId || !item.clientId);
            }
        } catch (e) {
            console.warn(`DB Error in getAllByClient for ${storeName}:`, e);
            const all = await dbInstance.getAll(storeName);
            result = all.filter((item: any) => item.clientId === clientId || !item.clientId);
        }
        
        cache.set(cacheKey, result);
        return result;
    },
    async get<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        const dbInstance = await dbPromise;
        if (!dbInstance) return undefined;
        return dbInstance.get(storeName, key);
    },
    async put<Name extends StoreNames<AgronomicDB>>(storeName: Name, value: AgronomicDB[Name]['value']) {
        // Dev-mode safeguard: ensure clientId is present for mandatory fields
        const mandatoryClientIdStores = ['orders', 'movements', 'stock', 'farms', 'lots', 'warehouses', 'observations', 'order_activities'];
        if (mandatoryClientIdStores.includes(storeName) && !(value as any).clientId) {
            console.error(`❌ DB: Attempted to put item into "${storeName}" without clientId! This will break sync. Item ID: ${(value as any).id}`);
            // We still allow the put to prevent UI crashes, but the console error will alert developers.
        }

        this.invalidateCache(storeName);
        const dbInstance = await dbPromise;
        if (!dbInstance) return;
        return dbInstance.put(storeName, value);
    },
    async delete<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        this.invalidateCache(storeName);
        const dbInstance = await dbPromise;
        if (!dbInstance) return;
        return dbInstance.delete(storeName, key);
    },
    async logOrderActivity(activity: Omit<import('@/types').OrderActivity, 'id' | 'timestamp'>) {
        return this.put('order_activities', {
            ...activity,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            synced: false
        });
    },
    // New Sync Helpers
    async getUnsynced<Name extends StoreNames<AgronomicDB>>(storeName: Name) {
        const dbInstance = await dbPromise;
        if (!dbInstance) return [];
        const allItems = await dbInstance.getAll(storeName);
        // @ts-ignore - 'synced' might not exist on all items yet
        return allItems.filter(item => item.synced !== true);
    },
    async markSynced<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        const dbInstance = await dbPromise;
        if (!dbInstance) return;
        const item = await dbInstance.get(storeName, key);
        if (!item) return;
        // @ts-ignore
        item.synced = true;
        // @ts-ignore
        await dbInstance.put(storeName, item);
    }
};
