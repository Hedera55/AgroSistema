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
}

const DB_NAME = 'agronomic-db';
const DB_VERSION = 7; // Added campaigns

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
        },
    }) : Promise.resolve(null as any);

// Helper for data access
const cache = new Map<string, any[]>();

export const db = {
    async getAll<Name extends StoreNames<AgronomicDB>>(storeName: Name) {
        if (cache.has(storeName)) {
            return cache.get(storeName)!;
        }
        const db = await dbPromise;
        if (!db) return [];
        const result = await db.getAll(storeName);
        cache.set(storeName, result);
        return result;
    },
    async get<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        const db = await dbPromise;
        if (!db) return undefined;
        return db.get(storeName, key);
    },
    async put<Name extends StoreNames<AgronomicDB>>(storeName: Name, value: AgronomicDB[Name]['value']) {
        cache.delete(storeName);
        const db = await dbPromise;
        if (!db) return;
        return db.put(storeName, value);
    },
    async delete<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        cache.delete(storeName);
        const db = await dbPromise;
        if (!db) return;
        return db.delete(storeName, key);
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
        const db = await dbPromise;
        if (!db) return [];
        const allItems = await db.getAll(storeName);
        // @ts-ignore - 'synced' might not exist on all items yet
        return allItems.filter(item => item.synced !== true);
    },
    async markSynced<Name extends StoreNames<AgronomicDB>>(storeName: Name, key: string) {
        const db = await dbPromise;
        if (!db) return;
        const item = await db.get(storeName, key);
        if (!item) return;
        // @ts-ignore
        item.synced = true;
        // @ts-ignore
        await db.put(storeName, item);
    }
};
