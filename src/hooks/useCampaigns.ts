import { useState, useEffect, useCallback } from 'react';
import { db } from '@/services/db';
import { Campaign } from '@/types';
import { generateId } from '@/lib/uuid';
import { syncService } from '@/services/sync';

export function useCampaigns(clientId: string) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        if (!clientId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const allCampaigns = await db.getAll('campaigns');
            const clientCampaigns = allCampaigns.filter((c: Campaign) => c.clientId === clientId && !c.deleted);
            // Sort by name or createdAt
            clientCampaigns.sort((a: Campaign, b: Campaign) => (b.name || '').localeCompare(a.name || ''));
            setCampaigns(clientCampaigns);
        } catch (e) {
            console.error('Error loading campaigns:', e);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const addCampaign = async (campaign: Omit<Campaign, 'id' | 'clientId'>) => {
        const newCampaign: Campaign = {
            ...campaign,
            id: generateId(),
            clientId,
            synced: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await db.put('campaigns', newCampaign);
        await refresh();
        syncService.pushChanges();
        return newCampaign;
    };

    const updateCampaign = async (campaign: Campaign) => {
        const updated: Campaign = {
            ...campaign,
            synced: false,
            updatedAt: new Date().toISOString()
        };
        await db.put('campaigns', updated);
        await refresh();
        syncService.pushChanges();
        return updated;
    };

    const deleteCampaign = async (id: string) => {
        const campaign = await db.get('campaigns', id);
        if (campaign) {
            await db.put('campaigns', {
                ...campaign,
                deleted: true,
                deletedAt: new Date().toISOString(),
                synced: false
            });
            await refresh();
            syncService.pushChanges();
        }
    };

    return { campaigns, loading, addCampaign, updateCampaign, deleteCampaign, refresh };
}
