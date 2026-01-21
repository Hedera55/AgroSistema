import { supabase } from '@/lib/supabase';
import { db } from './db';
import { Client, Farm, Lot, Product, Order, InventoryMovement, ClientStock, OrderActivity } from '@/types';

// Explicit mappers for each entity to ensure correct column names and data types for Supabase
const mappers = {
    client: (c: Client) => ({
        id: c.id,
        name: c.name,
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || new Date().toISOString()
    }),
    farm: (f: Farm) => ({
        id: f.id,
        client_id: f.clientId,
        name: f.name,
        boundary: f.boundary,
        created_by: f.createdBy,
        last_updated_by: f.lastUpdatedBy,
        created_at: f.createdAt || new Date().toISOString(),
        updated_at: f.updatedAt || new Date().toISOString()
    }),
    lot: (l: Lot) => ({
        id: l.id,
        farm_id: l.farmId,
        name: l.name,
        hectares: l.hectares,
        boundary: l.boundary,
        created_by: l.createdBy,
        last_updated_by: l.lastUpdatedBy,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: l.updatedAt || new Date().toISOString()
    }),
    product: (p: Product) => {
        return {
            id: p.id,
            client_id: p.clientId,
            name: p.name,
            type: p.type,
            unit: p.unit,
            created_at: p.createdAt || new Date().toISOString()
        };
    },
    stock: (s: ClientStock) => ({
        id: s.id,
        client_id: s.clientId,
        product_id: s.productId,
        quantity: s.quantity,
        updated_at: s.updatedAt || s.lastUpdated || new Date().toISOString()
    }),
    order: (o: Order) => ({
        id: o.id,
        order_number: o.orderNumber,
        client_id: o.clientId,
        farm_id: o.farmId,
        lot_id: o.lotId,
        type: o.type,
        status: o.status,
        date: o.date,
        time: o.time,
        treated_area: o.treatedArea,
        items: o.items,
        applicator_name: o.applicatorName,
        notes: o.notes,
        created_by: o.createdBy,
        updated_by: o.updatedBy,
        created_at: o.createdAt || new Date().toISOString(),
        updated_at: o.updatedAt || new Date().toISOString(),
        synced: true
    }),
    movement: (m: InventoryMovement) => ({
        id: m.id,
        client_id: m.clientId,
        product_id: m.productId,
        product_name: m.productName,
        type: m.type,
        quantity: m.quantity,
        unit: m.unit,
        date: m.date,
        time: m.time,
        reference_id: m.referenceId,
        notes: m.notes,
        created_by: m.createdBy,
        created_at: m.createdAt || new Date(m.date).toISOString()
    }),
    activity: (a: OrderActivity) => ({
        id: a.id,
        order_id: a.orderId,
        order_number: a.orderNumber,
        client_id: a.clientId,
        action: a.action,
        description: a.description,
        user_name: a.userName,
        timestamp: a.timestamp
    })
};

// Reverse mappers (Supabase -> Local)
const reverseMappers = {
    client: (c: any): Client => ({
        id: c.id,
        name: c.name,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        synced: true
    }),
    farm: (f: any): Farm => ({
        id: f.id,
        clientId: f.client_id,
        name: f.name,
        boundary: f.boundary,
        createdBy: f.created_by,
        lastUpdatedBy: f.last_updated_by,
        createdAt: f.created_at,
        updatedAt: f.updated_at,
        synced: true
    }),
    lot: (l: any): Lot => ({
        id: l.id,
        farmId: l.farm_id,
        name: l.name,
        hectares: l.hectares,
        boundary: l.boundary,
        createdBy: l.created_by,
        lastUpdatedBy: l.last_updated_by,
        createdAt: l.created_at,
        updatedAt: l.updated_at,
        synced: true
    }),
    product: (p: any): Product => ({
        id: p.id,
        clientId: p.client_id,
        name: p.name,
        type: p.type,
        unit: p.unit,
        createdAt: p.created_at,
        synced: true
    }),
    stock: (s: any): ClientStock => ({
        id: s.id,
        clientId: s.client_id,
        productId: s.product_id,
        quantity: s.quantity,
        updatedAt: s.updated_at,
        lastUpdated: s.updated_at,
        synced: true
    }),
    order: (o: any): Order => ({
        id: o.id,
        orderNumber: o.order_number,
        clientId: o.client_id,
        farmId: o.farm_id,
        lotId: o.lot_id,
        type: o.type,
        status: o.status,
        date: o.date,
        time: o.time,
        treatedArea: o.treated_area,
        items: o.items,
        applicatorName: o.applicator_name,
        notes: o.notes,
        createdBy: o.created_by,
        updatedBy: o.updated_by,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
        synced: true
    }),
    movement: (m: any): InventoryMovement => ({
        id: m.id,
        clientId: m.client_id,
        productId: m.product_id,
        productName: m.product_name || 'Unknown',
        type: m.type,
        quantity: m.quantity,
        unit: m.unit || 'L',
        date: m.date,
        time: m.time,
        referenceId: m.reference_id || 'manual',
        notes: m.notes,
        createdBy: m.created_by,
        createdAt: m.created_at,
        synced: true
    }),
    activity: (a: any): OrderActivity => ({
        id: a.id,
        orderId: a.order_id,
        orderNumber: a.order_number,
        clientId: a.client_id,
        action: a.action,
        description: a.description,
        userName: a.user_name,
        timestamp: a.timestamp,
        synced: true
    })
};

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export class SyncService {
    private isSyncing = false;
    private channel: any = null;
    private listeners: ((status: SyncStatus) => void)[] = [];

    onStatusChange(callback: (status: SyncStatus) => void) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify(status: SyncStatus) {
        this.listeners.forEach(l => l(status));
    }

    async sync() {
        if (this.isSyncing) return;
        this.isSyncing = true;
        this.notify('syncing');

        try {
            console.log('🔄 Starting sync...');
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.warn('⚠️ No active session, skipping sync.');
                this.notify('idle');
                return;
            }

            await this.pushChangesInternal();
            await this.pullChangesInternal();

            console.log('✅ Sync completed.');
            this.notify('success');

            // Revert to idle after 3 seconds
            setTimeout(() => this.notify('idle'), 3000);
        } catch (error) {
            console.error('❌ Sync error:', error);
            this.notify('error');
            setTimeout(() => this.notify('idle'), 3000);
        } finally {
            this.isSyncing = false;
        }
    }

    async pushChanges() {
        this.sync().catch(console.error);
    }

    // Realtime Subscription
    subscribeToChanges() {
        if (this.channel) return;

        console.log('📡 Subscribing to Realtime changes...');
        this.channel = supabase.channel('db-changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                async (payload) => {
                    console.log('🔔 Change received:', payload);
                    await this.handleRealtimeEvent(payload);
                }
            )
            .subscribe();
    }

    unsubscribe() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }
    }

    private async handleRealtimeEvent(payload: any) {
        const { table, eventType, new: newRecord, old: oldRecord } = payload;

        try {
            let localStore: any = null;
            let mapper: any = null;

            switch (table) {
                case 'clients': localStore = 'clients'; mapper = reverseMappers.client; break;
                case 'farms': localStore = 'farms'; mapper = reverseMappers.farm; break;
                case 'lots': localStore = 'lots'; mapper = reverseMappers.lot; break;
                case 'products': localStore = 'products'; mapper = reverseMappers.product; break;
                case 'stock': localStore = 'stock'; mapper = reverseMappers.stock; break;
                case 'orders': localStore = 'orders'; mapper = reverseMappers.order; break;
                case 'inventory_movements': localStore = 'movements'; mapper = reverseMappers.movement; break;
                case 'order_activities': localStore = 'order_activities'; mapper = reverseMappers.activity; break;
            }

            if (!localStore || !mapper) return;

            if (eventType === 'DELETE') {
                if (oldRecord && oldRecord.id) {
                    await db.delete(localStore, oldRecord.id);
                }
            } else if (eventType === 'INSERT' || eventType === 'UPDATE') {
                if (newRecord) {
                    const mappedItem = mapper(newRecord);
                    const localItem = await db.get(localStore, newRecord.id);

                    if (localItem) {
                        const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                        const remoteTime = new Date(mappedItem.updatedAt || mappedItem.createdAt || 0).getTime();

                        if (remoteTime > localTime) {
                            // Preserve boundary if remote is blank but local exists
                            if (!mappedItem.boundary && localItem.boundary) {
                                mappedItem.boundary = localItem.boundary;
                            }
                            await db.put(localStore, mappedItem);
                        }
                    } else {
                        await db.put(localStore, mappedItem);
                    }
                }
            }
        } catch (e) {
            console.error('Error handling realtime event:', e);
        }
    }

    private async pushChangesInternal() {
        console.log('⬆️ Pushing changes...');
        await this.pushStore('clients', 'clients', mappers.client);
        await this.pushStore('products', 'products', mappers.product);
        await this.pushStore('farms', 'farms', mappers.farm);
        await this.pushStore('lots', 'lots', mappers.lot);
        await this.pushStore('stock', 'stock', mappers.stock);
        await this.pushStore('orders', 'orders', mappers.order);
        await this.pushStore('movements', 'inventory_movements', mappers.movement);
        await this.pushStore('order_activities', 'order_activities', mappers.activity);
    }

    private async pullChangesInternal() {
        console.log('⬇️ Pulling changes...');
        await this.pullStore('clients', 'clients', reverseMappers.client);
        await this.pullStore('products', 'products', reverseMappers.product);
        await this.pullStore('farms', 'farms', reverseMappers.farm);
        await this.pullStore('lots', 'lots', reverseMappers.lot);
        await this.pullStore('stock', 'stock', reverseMappers.stock);
        await this.pullStore('orders', 'orders', reverseMappers.order);
        await this.pullStore('movements', 'inventory_movements', reverseMappers.movement);
        await this.pullStore('order_activities', 'order_activities', reverseMappers.activity);
    }

    private async pushStore<T extends { id: string }>(
        localStoreName: any,
        tableName: string,
        mapper: (item: any) => any
    ) {
        const unsyncedItems = await db.getUnsynced(localStoreName);
        if (unsyncedItems.length === 0) return;

        console.log(`Pushing ${unsyncedItems.length} items from ${localStoreName}...`);

        for (const item of unsyncedItems) {
            try {
                if (tableName === 'products' && !(item as Product).clientId) continue;

                const payload = mapper(item);
                const { error } = await supabase.from(tableName).upsert(payload);

                if (error) {
                    if (error.message.includes("schema cache") || error.message.includes("column")) {
                        console.error(`⚠️ Schema mismatch on ${tableName}: ${error.message}. Please ensure migrations are run.`);
                    } else {
                        console.error(`Failed to push ${localStoreName}/${item.id}:`, error.message);
                    }
                } else {
                    await db.markSynced(localStoreName, item.id);
                }
            } catch (innerError) {
                console.error(`Error processing item ${item.id}:`, innerError);
            }
        }
    }

    private async pullStore(
        localStoreName: any,
        remoteTable: string,
        mapper: (item: any) => any
    ) {
        const { data, error } = await supabase.from(remoteTable).select('*');
        if (error) {
            console.error(`Failed to pull ${remoteTable}:`, error.message);
            return;
        }
        if (!data || data.length === 0) return;

        for (const remoteItem of data) {
            try {
                const localItem = await db.get(localStoreName, remoteItem.id);
                const mappedItem = mapper(remoteItem);

                if (localItem) {
                    const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();
                    const remoteTime = new Date(mappedItem.updatedAt || mappedItem.createdAt || 0).getTime();

                    if (remoteTime > localTime) {
                        // Preserve boundary if remote is blank but local exists
                        if (!mappedItem.boundary && localItem.boundary) {
                            mappedItem.boundary = localItem.boundary;
                        }
                        await db.put(localStoreName, mappedItem);
                    }
                } else {
                    await db.put(localStoreName, mappedItem);
                }
            } catch (e) {
                console.error(`Error pulling item ${remoteItem.id} into ${localStoreName}:`, e);
            }
        }
    }
}

export const syncService = new SyncService();
