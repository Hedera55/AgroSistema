import { supabase } from '@/lib/supabase';
import { db } from './db';
import { Client, Farm, Lot, Product, Order, InventoryMovement, ClientStock, OrderActivity, Observation } from '@/types';

// Explicit mappers for each entity to ensure correct column names and data types for Supabase
const mappers = {
    client: (c: Client) => ({
        id: c.id,
        name: c.name,
        investors: c.investors || [],
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || new Date().toISOString(),
        deleted: c.deleted || false,
        deleted_at: c.deletedAt,
        deleted_by: c.deletedBy
    }),
    farm: (f: Farm) => ({
        id: f.id,
        client_id: f.clientId,
        name: f.name,
        boundary: f.boundary,
        kml_data: f.kmlData,
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
        crop_species: l.cropSpecies,
        yield: l.yield || 0,
        observed_yield: l.observedYield || 0,
        status: l.status || 'EMPTY',
        boundary: l.boundary,
        kml_data: l.kmlData,
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
            price: p.price || 0,
            created_at: p.createdAt || new Date().toISOString(),
            deleted: p.deleted || false,
            deleted_at: p.deletedAt,
            deleted_by: p.deletedBy
        };
    },
    stock: (s: ClientStock) => ({
        id: s.id,
        client_id: s.clientId,
        warehouse_id: s.warehouseId || null,
        product_id: s.productId,
        product_brand: s.productBrand || null,
        quantity: s.quantity,
        updated_at: s.updatedAt || s.lastUpdated || new Date().toISOString()
    }),
    order: (o: Order) => ({
        id: o.id,
        order_number: o.orderNumber,
        client_id: o.clientId,
        farm_id: o.farmId,
        lot_id: o.lotId,
        warehouse_id: o.warehouseId,
        type: o.type,
        status: o.status,
        date: o.date,
        time: o.time,
        application_start: o.applicationStart,
        application_end: o.applicationEnd,
        planting_density: o.plantingDensity,
        planting_density_unit: o.plantingDensityUnit,
        planting_spacing: o.plantingSpacing,
        treated_area: o.treatedArea,
        items: o.items,
        applicator_name: o.applicatorName,
        service_price: o.servicePrice || 0,
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
        warehouse_id: m.warehouseId,
        product_id: m.productId,
        product_name: m.productName,
        product_brand: m.productBrand,
        type: m.type,
        quantity: m.quantity,
        unit: m.unit,
        date: m.date,
        time: m.time,
        sale_price: m.salePrice || 0,
        purchase_price: m.purchasePrice || 0,
        reference_id: m.referenceId,
        notes: m.notes,
        factura_image_url: m.facturaImageUrl,
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
    }),
    observation: (o: Observation) => ({
        id: o.id,
        client_id: o.clientId,
        farm_id: o.farmId,
        lot_id: o.lotId,
        user_name: o.userName,
        date: o.date,
        comments: o.comments,
        created_at: o.createdAt || new Date().toISOString(),
        deleted: o.deleted || false,
        deleted_by: o.deletedBy,
        deleted_at: o.deletedAt
    }),
    warehouse: (w: any) => ({
        id: w.id,
        client_id: w.clientId,
        name: w.name,
        created_at: w.createdAt || new Date().toISOString(),
        updated_at: w.updatedAt || new Date().toISOString(),
        deleted: w.deleted || false,
        deleted_at: w.deletedAt,
        deleted_by: w.deletedBy
    })
};

// Reverse mappers (Supabase -> Local)
const reverseMappers = {
    client: (c: any): Client => ({
        id: c.id,
        name: c.name,
        investors: c.investors || [],
        createdAt: c.created_at,
        updatedAt: c.updated_at,
        deleted: c.deleted,
        deletedAt: c.deleted_at,
        deletedBy: c.deleted_by,
        synced: true
    }),
    farm: (f: any): Farm => ({
        id: f.id,
        clientId: f.client_id,
        name: f.name,
        boundary: f.boundary,
        kmlData: f.kml_data,
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
        cropSpecies: l.crop_species,
        yield: l.yield,
        observedYield: l.observed_yield || 0,
        status: l.status || 'EMPTY',
        boundary: l.boundary,
        kmlData: l.kml_data,
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
        price: p.price,
        createdAt: p.created_at,
        deleted: p.deleted,
        deletedAt: p.deleted_at,
        deletedBy: p.deleted_by,
        synced: true
    }),
    stock: (s: any): ClientStock => ({
        id: s.id,
        clientId: s.client_id,
        warehouseId: s.warehouse_id,
        productId: s.product_id,
        productBrand: s.product_brand,
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
        warehouseId: o.warehouse_id,
        type: o.type,
        status: o.status,
        date: o.date,
        time: o.time,
        applicationStart: o.application_start,
        applicationEnd: o.application_end,
        plantingDensity: o.planting_density,
        plantingDensityUnit: o.planting_density_unit,
        plantingSpacing: o.planting_spacing,
        treatedArea: o.treated_area,
        items: o.items,
        applicatorName: o.applicator_name,
        servicePrice: o.service_price || 0,
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
        warehouseId: m.warehouse_id,
        productId: m.product_id,
        productName: m.product_name || 'Unknown',
        productBrand: m.product_brand,
        type: m.type,
        quantity: m.quantity,
        unit: m.unit || 'L',
        date: m.date,
        time: m.time,
        salePrice: m.sale_price || 0,
        purchasePrice: m.purchase_price || 0,
        referenceId: m.reference_id || 'manual',
        notes: m.notes,
        facturaImageUrl: m.factura_image_url,
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
    }),
    observation: (o: any): Observation => ({
        id: o.id,
        clientId: o.client_id,
        farmId: o.farm_id,
        lotId: o.lot_id,
        userName: o.user_name,
        date: o.date,
        comments: o.comments,
        createdAt: o.created_at,
        deleted: o.deleted,
        deletedBy: o.deleted_by,
        deletedAt: o.deleted_at,
        synced: true
    }),
    warehouse: (w: any) => ({
        id: w.id,
        clientId: w.client_id,
        name: w.name,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
        synced: true,
        deleted: w.deleted,
        deletedAt: w.deleted_at,
        deletedBy: w.deleted_by
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
        await this.pushStore('warehouses', 'warehouses', mappers.warehouse); // Changed from (w: any) => w
        await this.pushStore('stock', 'stock', mappers.stock);
        await this.pushStore('orders', 'orders', mappers.order);
        await this.pushStore('movements', 'inventory_movements', mappers.movement);
        await this.pushStore('order_activities', 'order_activities', mappers.activity);
        await this.pushStore('observations', 'observations', mappers.observation);
    }

    private async pullChangesInternal() {
        console.log('⬇️ Pulling changes...');
        await this.pullStore('clients', 'clients', reverseMappers.client);
        await this.pullStore('products', 'products', reverseMappers.product);
        await this.pullStore('farms', 'farms', reverseMappers.farm);
        await this.pullStore('lots', 'lots', reverseMappers.lot);
        await this.pullStore('warehouses', 'warehouses', reverseMappers.warehouse); // Changed from (w: any) => w
        await this.pullStore('stock', 'stock', reverseMappers.stock);
        await this.pullStore('orders', 'orders', reverseMappers.order);
        await this.pullStore('movements', 'inventory_movements', reverseMappers.movement);
        await this.pullStore('order_activities', 'order_activities', reverseMappers.activity);
        await this.pullStore('observations', 'observations', reverseMappers.observation);
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

                        // Auto-fix for legacy grain IDs or references that are not UUIDs
                        if (error.message.includes('invalid input syntax for type uuid') &&
                            (
                                (item.id as string).startsWith('grain-') ||
                                // Check potential UUID fields for legacy/invalid values
                                ['productId', 'product_id', 'referenceId', 'reference_id'].some(key => {
                                    const val = (item as any)[key];
                                    return typeof val === 'string' && (val.startsWith('grain-') || val.startsWith('SERVICE-'));
                                })
                            )
                        ) {
                            console.warn(`🗑️ Auto-deleting item with invalid UUID reference: ${item.id}`);
                            try {
                                await db.delete(localStoreName, item.id);
                                console.log(`✅ Deleted invalid item ${item.id}. Sync should recover on next retry.`);
                            } catch (delError) {
                                console.error(`Failed to auto-delete invalid item ${item.id}`, delError);
                            }
                        }
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
