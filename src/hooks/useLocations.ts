import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { Farm, Lot } from '@/types';
import { syncService } from '@/services/sync';

export function useFarms(clientId: string) {
    const [farms, setFarms] = useState<Farm[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) return;
        setLoading(true);
        try {
            const allFarms = await db.getAll('farms');
            const clientFarms = allFarms.filter((f: Farm) => f.clientId === clientId && !f.deleted);
            setFarms(clientFarms);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addFarm = async (farm: Farm) => {
        const finalFarm = { ...farm, synced: false, updatedAt: new Date().toISOString() };
        await db.put('farms', finalFarm);
        await refresh();
        syncService.pushChanges();
    };

    const updateFarm = async (farm: Farm) => {
        const existing = await db.get('farms', farm.id);
        const updates = Object.fromEntries(
            Object.entries(farm).filter(([_, v]) => v !== undefined && v !== null)
        );
        const finalFarm = {
            ...existing,
            ...updates,
            synced: false,
            updatedAt: new Date().toISOString()
        };
        await db.put('farms', finalFarm);
        await refresh();
        syncService.pushChanges();
    };

    const deleteFarm = async (id: string, deletedBy?: string) => {
        const existing = await db.get('farms', id);
        if (!existing) return;

        const timestamp = new Date().toISOString();
        const user = deletedBy || 'Sistema';

        // 1. Soft-delete the farm
        await db.put('farms', {
            ...existing,
            deleted: true,
            deletedAt: timestamp,
            deletedBy: user,
            synced: false,
            updatedAt: timestamp
        });

        // 2. Soft-delete associated lots
        const allLots = await db.getAll('lots');
        const farmLots = allLots.filter((l: Lot) => l.farmId === id);
        for (const lot of farmLots) {
            await db.put('lots', {
                ...lot,
                deleted: true,
                deletedAt: timestamp,
                deletedBy: user,
                synced: false,
                updatedAt: timestamp
            });
        }

        await refresh();
        syncService.pushChanges();
    };

    return { farms, loading, addFarm, updateFarm, deleteFarm, refresh };
}

export function useLots(farmId: string) {
    const [lots, setLots] = useState<Lot[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!farmId) {
            setLots([]);
            return;
        }
        setLoading(true);
        try {
            const allLots = await db.getAll('lots');
            const farmLots = allLots.filter((l: Lot) => l.farmId === farmId && !l.deleted);
            setLots(farmLots);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [farmId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addLot = async (lot: Lot) => {
        const finalLot = { ...lot, synced: false, updatedAt: new Date().toISOString() };
        await db.put('lots', finalLot);
        await refresh();
        syncService.pushChanges();
    };

    const updateLot = async (lot: Lot) => {
        const existing = await db.get('lots', lot.id);
        const updates = Object.fromEntries(
            Object.entries(lot).filter(([_, v]) => v !== undefined && v !== null)
        );
        const finalLot = {
            ...existing,
            ...updates,
            synced: false,
            updatedAt: new Date().toISOString()
        };
        await db.put('lots', finalLot);
        await refresh();
        syncService.pushChanges();
    };

    const deleteLot = async (id: string, deletedBy?: string) => {
        const existing = await db.get('lots', id);
        if (!existing) return;

        await db.put('lots', {
            ...existing,
            deleted: true,
            deletedAt: new Date().toISOString(),
            deletedBy: deletedBy || 'Sistema',
            synced: false,
            updatedAt: new Date().toISOString()
        });
        await refresh();
        syncService.pushChanges();
    };

    return { lots, loading, addLot, updateLot, deleteLot, refresh };
}
