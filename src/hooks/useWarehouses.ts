import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { Warehouse } from '@/types';
import { generateId } from '@/lib/uuid';
import { syncService } from '@/services/sync';

export function useWarehouses(clientId: string) {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) return;
        try {
            const all = await db.getAll('warehouses');
            const filtered = all.filter((w: Warehouse) => w.clientId === clientId);
            if (filtered.length === 0 && clientId) {
                // Return a temporary item or create it
                await addWarehouse('Galpón');
                return; // refresh will be called by addWarehouse
            }
            setWarehouses(filtered);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addWarehouse = async (name: string) => {
        // Check for duplicates
        if (warehouses.some(w => w.name.toLowerCase() === name.toLowerCase())) {
            alert(`Ya existe un galpón con el nombre "${name}". Por favor usa un nombre diferente.`);
            return null;
        }

        const item: Warehouse = {
            id: generateId(),
            clientId,
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            synced: false
        };
        await db.put('warehouses', item);
        await syncService.pushChanges();
        await refresh();
        return item;
    };

    const updateWarehouse = async (warehouse: Warehouse) => {
        // Check for duplicates (excluding itself)
        if (warehouses.some(w => w.id !== warehouse.id && w.name.toLowerCase() === warehouse.name.toLowerCase())) {
            alert(`Ya existe otro galpón llamado "${warehouse.name}".`);
            return;
        }

        const item = { ...warehouse, updatedAt: new Date().toISOString(), synced: false };
        await db.put('warehouses', item);
        await syncService.pushChanges();
        await refresh();
    };

    const deleteWarehouse = async (id: string) => {
        await db.delete('warehouses', id);
        await syncService.pushChanges();
        await refresh();
    };

    return { warehouses, loading, addWarehouse, updateWarehouse, deleteWarehouse, refresh };
}
