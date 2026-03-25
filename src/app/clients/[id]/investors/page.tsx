'use client';

import React, { use, useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Client, InventoryMovement, Order, Product, Campaign, CampaignMode } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useInventory, useClientMovements } from '@/hooks/useInventory';
import { useOrders } from '@/hooks/useOrders';
import { useCampaigns } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { generateId } from '@/lib/uuid';
import { syncService } from '@/services/sync';
import { CampaignSnapshot, ClientStock } from '@/types';

export default function ContaduriaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const { isMaster, role, profile } = useAuth();
    const isReadOnly = role === 'CLIENT' || (!isMaster && !profile?.assigned_clients?.includes(id));
    const [client, setClient] = useState<Client | null>(null);
    const { movements, loading: movementsLoading } = useClientMovements(id);
    const { products, loading: productsLoading } = useInventory();
    const { orders, loading: ordersLoading } = useOrders(id);
    const scrollRef = useHorizontalScroll();
    const partnersScrollRef = useHorizontalScroll();
    const [loading, setLoading] = useState(true);

    const [showEditInvestors, setShowEditInvestors] = useState(false);
    const [partners, setPartners] = useState<{ name: string; cuit?: string }[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [historyLimit, setHistoryLimit] = useState(10);
    const [editingPartnerIdx, setEditingPartnerIdx] = useState<number | null>(null);
    const [backupPartner, setBackupPartner] = useState<{ name: string; cuit?: string } | null>(null);
    const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

    // Campaigns state
    const { campaigns, addCampaign, updateCampaign, deleteCampaign, loading: campaignsLoading } = useCampaigns(id);
    const [showEditCampaigns, setShowEditCampaigns] = useState(false);
    const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
    const [newCampaignName, setNewCampaignName] = useState('');
    const [newCampaignMode, setNewCampaignMode] = useState<CampaignMode>('MONEY');
    const [viewCampaignId, setViewCampaignId] = useState<string>('all');

    // Campaign Snapshots
    const [snapshots, setSnapshots] = useState<CampaignSnapshot[]>([]);
    const [isSnapshotting, setIsSnapshotting] = useState(false);


    useEffect(() => {
        db.get('clients', id).then(c => {
            setClient(c || null);
            if (c?.partners && c.partners.length > 0) {
                // Migration: handle string[] or JSON strings if encountered
                const migrated = c.partners.map((p: any) => {
                    if (typeof p === 'string') {
                        try {
                            const parsed = JSON.parse(p);
                            if (parsed && parsed.name) {
                                return { name: parsed.name, cuit: parsed.cuit || '' };
                            }
                        } catch (e) {
                            // Valid bare string
                        }
                        return { name: p, cuit: '' };
                    }
                    return p;
                });
                setPartners(migrated);
            } else if (c?.investors && c.investors.length > 0) {
                // Automatic migration: extract names from old investors
                setPartners(c.investors.map((i: any) => ({ name: i.name, cuit: '' })));
            }
            setLoading(false);
        });

        loadSnapshots();

        return () => {
            // Trigger sync when leaving Contaduría to ensure configuration changes are pushed/pulled
            syncService.sync().catch(err => console.error('Auto-sync on leave failed:', err));
        };
    }, [id]);

    const loadSnapshots = async () => {
        try {
            const allSnapshots = await db.getAll('campaign_snapshots');
            setSnapshots(allSnapshots.filter((s: CampaignSnapshot) => s.clientId === id));
        } catch (e) {
            console.error('Error loading snapshots', e);
        }
    };

    const handleCerrarCampaña = async (campaignId: string) => {
        if (!confirm('¿Está seguro de cerrar esta campaña y guardar una copia de seguridad del stock? (Snapshot)')) return;
        setIsSnapshotting(true);
        try {
            const allStock = await db.getAll('stock');
            const clientStock = allStock.filter((s: ClientStock) => s.clientId === id);

            const snapshot: CampaignSnapshot = {
                id: generateId(),
                clientId: id,
                campaignId: campaignId,
                createdAt: new Date().toISOString(),
                stockSnapshot: clientStock,
                synced: false
            };

            await db.put('campaign_snapshots', snapshot);
            alert('Campaña cerrada y snapshot guardado.');
            await loadSnapshots();
        } catch (e) {
            console.error(e);
            alert('Error al guardar snapshot');
        } finally {
            setIsSnapshotting(false);
        }
    };

    const handleRecrearArchivo = async (campaignId: string) => {
        // Find existing snapshot
        const existing = snapshots.find(s => s.campaignId === campaignId);
        if (!existing) return alert('No hay snapshot anterior para recrear.');
        if (!confirm('Esto reemplazará el archivo de cierre de esta campaña con el stock actual reconstruido hasta su último movimiento. ¿Continuar?')) return;

        setIsSnapshotting(true);
        try {
            // Note: Recalculation logic will go here if needed. 
            // For now, in Contaduría, this just saves a new snapshot of the *current* state 
            // under this campaign, effectively updating the snapshot if movements were edited.
            const allStock = await db.getAll('stock');
            const clientStock = allStock.filter((s: ClientStock) => s.clientId === id);

            const newSnapshot: CampaignSnapshot = {
                ...existing,
                stockSnapshot: clientStock,
                createdAt: new Date().toISOString(),
                synced: false
            };

            await db.put('campaign_snapshots', newSnapshot);
            alert('Archivo de campaña recreado con éxito.');
            await loadSnapshots();
        } catch (e) {
            console.error(e);
            alert('Error recreando archivo');
        } finally {
            setIsSnapshotting(false);
        }
    };

    const handleSaveInvestors = async () => {
        if (!client) return;

        setIsSaving(true);
        try {
            const updatedClient = {
                ...client,
                partners,
                updatedAt: new Date().toISOString(),
                synced: false
            };
            await db.put('clients', updatedClient);
            setClient(updatedClient);
            setShowEditInvestors(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar socios');
        } finally {
            setIsSaving(false);
        }
    };

    const addPartner = () => {
        const newPartner = { name: '', cuit: '' };
        setPartners([...partners, newPartner]);
        setEditingPartnerIdx(partners.length);
        setBackupPartner(newPartner);
    };

    const updatePartner = (idx: number, field: 'name' | 'cuit', value: string) => {
        const newPartners = [...partners];
        newPartners[idx] = { ...newPartners[idx], [field]: value };
        setPartners(newPartners);
    };

    const removePartner = (idx: number) => {
        const name = partners[idx].name || 'este socio';
        if (window.confirm(`¿Está seguro que desea eliminar a ${name}?`)) {
            setPartners(partners.filter((_, i) => i !== idx));
        }
    };

    const cancelEdit = (idx: number) => {
        if (backupPartner) {
            if (!backupPartner.name && !backupPartner.cuit) {
                // If it was a newly added partner (empty), remove it
                setPartners(partners.filter((_, i) => i !== idx));
            } else {
                const newPartners = [...partners];
                newPartners[idx] = backupPartner;
                setPartners(newPartners);
            }
        }
        setEditingPartnerIdx(null);
        setBackupPartner(null);
    };

    const stats = useMemo(() => {
        let investedMovements = 0;
        let serviceCosts = 0;
        let sold = 0;

        const perPartner: Record<string, number> = {}; // Monetary investment per partner (current view)
        const perPartnerIncome: Record<string, number> = {}; // Monetary income (sales) per partner (current view)

        // Tracking for grain logic
        const investmentByCampaignPartner: Record<string, Record<string, number>> = {}; // [campaignId][partnerName] = USD
        const totalInvestmentByCampaign: Record<string, number> = {}; // [campaignId] = USD
        const harvestByCampaignCrop: Record<string, Record<string, number>> = {}; // [campaignId][crop] = KG
        const soldHarvestByCampaignCrop: Record<string, Record<string, number>> = {}; // [campaignId][crop] = KG (Sales where source: 'HARVEST')
        const withdrawalsByPartnerCrop: Record<string, Record<string, number>> = {}; // [partnerName][crop] = KG (physical OUT)

        // Helper to normalize partner names
        const getPartnerName = (name?: string) => {
            if (!name) return 'Sin Asignar';
            let pName = name;
            if (pName.startsWith('{')) {
                try {
                    const parsed = JSON.parse(pName);
                    if (parsed && parsed.name) pName = parsed.name;
                } catch (e) { }
            }
            if (pName.toLowerCase().trim() === 'sin asignar' || pName.toLowerCase().trim() === 'sin_asignar') return 'Sin Asignar';
            return pName;
        };

        const currentCampaigns = campaigns.filter(c => viewCampaignId === 'all' || c.id === viewCampaignId);

        movements.forEach((m: InventoryMovement) => {
            if (m.deleted) return;
            if (viewCampaignId === 'none') {
                if (m.campaignId) return;
            } else if (viewCampaignId !== 'all' && m.campaignId !== viewCampaignId) return;

            const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
            if (isTransfer) return;

            const campaign = campaigns.find(c => c.id === m.campaignId);
            const campaignMode = campaign?.mode || 'MONEY';

            if (m.type === 'IN' || m.type === 'PURCHASE' || m.type === 'SERVICE') {
                let amount = 0;
                if (m.type === 'SERVICE') {
                    amount = m.amount || (m.quantity * (m.purchasePrice || 0));
                } else if (m.productId === 'CONSOLIDATED' && m.items) {
                    amount = m.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 0)), 0);
                } else {
                    amount = m.quantity * (m.purchasePrice || 0);
                }

                if (amount > 0) {
                    investedMovements += amount;
                    const distributors = (m.investors && m.investors.length > 0)
                        ? m.investors.map(inv => ({ name: getPartnerName(inv.name), amount: amount * (inv.percentage / 100) }))
                        : [{ name: getPartnerName(m.investorName), amount }];

                    distributors.forEach(d => {
                        perPartner[d.name] = (perPartner[d.name] || 0) + d.amount;
                        if (m.campaignId) {
                            if (!investmentByCampaignPartner[m.campaignId]) investmentByCampaignPartner[m.campaignId] = {};
                            investmentByCampaignPartner[m.campaignId][d.name] = (investmentByCampaignPartner[m.campaignId][d.name] || 0) + d.amount;
                            totalInvestmentByCampaign[m.campaignId] = (totalInvestmentByCampaign[m.campaignId] || 0) + d.amount;
                        }
                    });
                }
            } else if (m.type === 'SALE') {
                const saleValue = (m.quantity * (m.salePrice || 0));
                sold += saleValue;

                // Track sold harvested grain for MIXED mode
                // Robust check for harvest source: explicit tag OR existence of harvest movement for this product/campaign
                // Only perform this lookup if source is null/undefined as requested by user
                let isHarvestSource = m.source === 'HARVEST';
                if (!isHarvestSource && !m.source && m.campaignId) {
                    const hasBeenHarvested = !!harvestByCampaignCrop[m.campaignId]?.[m.productName || 'Granos'];
                    if (hasBeenHarvested) isHarvestSource = true;
                }

                if (m.campaignId && isHarvestSource) {
                    const crop = (m.productName || 'Granos').toLowerCase().trim();
                    if (!soldHarvestByCampaignCrop[m.campaignId]) soldHarvestByCampaignCrop[m.campaignId] = {};
                    soldHarvestByCampaignCrop[m.campaignId][crop] = (soldHarvestByCampaignCrop[m.campaignId][crop] || 0) + m.quantity;
                }

                // Income distribution: Sales income is distributed proportionally to investment in that campaign
                if (m.campaignId && totalInvestmentByCampaign[m.campaignId] > 0) {
                    const campaignId = m.campaignId;
                    const cInvestment = investmentByCampaignPartner[campaignId] || {};
                    Object.entries(cInvestment).forEach(([pName, pInvested]) => {
                        const ratio = pInvested / totalInvestmentByCampaign[campaignId];
                        perPartnerIncome[pName] = (perPartnerIncome[pName] || 0) + (saleValue * ratio);
                    });
                } else {
                    // Fallback to "Sin Asignar" if no campaign or no investment detected
                    perPartnerIncome['Sin Asignar'] = (perPartnerIncome['Sin Asignar'] || 0) + saleValue;
                }
            } else if (m.type === 'OUT' && m.campaignId) {
                // Physical withdrawal from a campaign
                const pName = getPartnerName(m.receiverName || m.investorName);
                const crop = m.productName || 'Granos';
                if (!withdrawalsByPartnerCrop[pName]) withdrawalsByPartnerCrop[pName] = {};
                withdrawalsByPartnerCrop[pName][crop] = (withdrawalsByPartnerCrop[pName][crop] || 0) + m.quantity;
            } else if (m.type === 'HARVEST' && m.campaignId) {
                // Tracking total harvest for grain allocation
                const crop = m.productName || 'Granos';
                if (!harvestByCampaignCrop[m.campaignId]) harvestByCampaignCrop[m.campaignId] = {};
                harvestByCampaignCrop[m.campaignId][crop] = (harvestByCampaignCrop[m.campaignId][crop] || 0) + m.quantity;
            }
        });

        orders.forEach((o: Order) => {
            if (o.deleted) return;
            if (viewCampaignId !== 'all' && o.campaignId !== viewCampaignId) return;

            if (o.servicePrice && o.servicePrice > 0) {
                const amount = (o.servicePrice * o.treatedArea);
                serviceCosts += amount;

                const distributors = (o.investors && o.investors.length > 0)
                    ? o.investors.map(inv => ({ name: getPartnerName(inv.name), amount: amount * (inv.percentage / 100) }))
                    : [{ name: getPartnerName(o.investorName), amount }];

                distributors.forEach(d => {
                    perPartner[d.name] = (perPartner[d.name] || 0) + d.amount;
                    if (o.campaignId) {
                        if (!investmentByCampaignPartner[o.campaignId]) investmentByCampaignPartner[o.campaignId] = {};
                        investmentByCampaignPartner[o.campaignId][d.name] = (investmentByCampaignPartner[o.campaignId][d.name] || 0) + d.amount;
                        totalInvestmentByCampaign[o.campaignId] = (totalInvestmentByCampaign[o.campaignId] || 0) + d.amount;
                    }
                });
            }
        });

        // Derive grain assignments per partner
        const grainAssignments: Record<string, Record<string, number>> = {}; // [partner][crop] = KG
        Object.keys(investmentByCampaignPartner).forEach(campId => {
            const campaignInfo = campaigns.find(c => c.id === campId);
            if (!campaignInfo || (campaignInfo.mode !== 'GRAIN' && campaignInfo.mode !== 'MIXED')) return;

            const cInvestments = investmentByCampaignPartner[campId];
            const cTotalInvest = totalInvestmentByCampaign[campId];
            const cHarvests = harvestByCampaignCrop[campId] || {};
            const cSalesHarvestCount = soldHarvestByCampaignCrop[campId] || {};

            if (cTotalInvest <= 0) return;

            Object.entries(cHarvests).forEach(([crop, totalKg]) => {
                const normalizedCrop = crop.toLowerCase().trim();
                const soldKg = cSalesHarvestCount[normalizedCrop] || 0;
                const netKg = campaignInfo.mode === 'MIXED' ? Math.max(0, totalKg - soldKg) : totalKg;

                Object.entries(cInvestments).forEach(([pName, pInvested]) => {
                    const ratio = pInvested / cTotalInvest;
                    if (!grainAssignments[pName]) grainAssignments[pName] = {};
                    grainAssignments[pName][crop] = (grainAssignments[pName][crop] || 0) + (netKg * ratio);
                });
            });
        });

        const totalInvested = investedMovements + serviceCosts;

        // Group by campaign for overview
        const perCampaign: Record<string, { invested: number; sold: number; total: number }> = {};
        campaigns.forEach(c => {
            let cInvested = 0;
            let cSold = 0;

            movements.forEach(m => {
                if (m.deleted) return;
                if (m.campaignId !== c.id) return;
                const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
                if (isTransfer) return;

                if (m.type === 'IN' || m.type === 'PURCHASE' || m.type === 'SERVICE') {
                    if (m.type === 'SERVICE') cInvested += m.amount || (m.quantity * (m.purchasePrice || 0));
                    else if (m.productId === 'CONSOLIDATED' && m.items) cInvested += m.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 0)), 0);
                    else cInvested += m.quantity * (m.purchasePrice || 0);
                } else if (m.type === 'SALE') cSold += (m.quantity * (m.salePrice || 0));
            });

            orders.forEach(o => {
                if (o.deleted) return;
                if (o.campaignId !== c.id) return;
                if (o.servicePrice && o.servicePrice > 0) cInvested += (o.servicePrice * o.treatedArea);
            });

            perCampaign[c.id] = { invested: cInvested, sold: cSold, total: cSold - cInvested };
        });

        return {
            investedMovements,
            serviceCosts,
            totalInvested,
            sold,
            total: sold - totalInvested,
            perPartner, // Total investment in current view
            perPartnerIncome, // Total sales income in current view
            grainAssignments,
            withdrawalsByPartnerCrop,
            perCampaign
        };
    }, [movements, products, orders, viewCampaignId, campaigns]);

    const formatLedgerDate = (dateStr: string, timeStr?: string) => {
        if (!dateStr) return { date: '-', time: '-' };

        let day = '-', month = '-', year = '-';
        let formattedTime = '-';

        // ALWAYS extract date via string splitting (timezone-safe)
        const datePart = dateStr.split('T')[0];
        const parts = datePart.split('-');
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                // YYYY-MM-DD
                year = parts[0]; month = parts[1]; day = parts[2];
            } else {
                // DD-MM-YYYY
                day = parts[0]; month = parts[1]; year = parts[2];
            }
        }

        // Extract time from ISO string if no explicit timeStr
        if (!timeStr && dateStr.includes('T')) {
            const tPart = dateStr.split('T')[1];
            const match = tPart?.match(/(\d+):(\d+)/);
            if (match) {
                // Use Date object ONLY for time (UTC→local conversion is correct for time)
                const dateObj = new Date(dateStr);
                if (!isNaN(dateObj.getTime())) {
                    const h = dateObj.getHours();
                    const m = String(dateObj.getMinutes()).padStart(2, '0');
                    const ampm = h >= 12 ? 'p.m.' : 'a.m.';
                    const displayHours = h % 12 || 12;
                    formattedTime = `${displayHours}:${m} ${ampm}`;
                }
            }
        }

        if (timeStr) {
            const timePart = timeStr.split(' ')[0];
            const [h, m] = timePart.split(':');
            if (h && m) {
                const hours = parseInt(h);
                const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
                const displayHours = hours % 12 || 12;
                formattedTime = `${displayHours}:${m.split(' ')[0]} ${ampm}`;
            }
        }

        return {
            date: day !== '-' ? `${day}-${month}-${year}` : dateStr,
            time: formattedTime
        };
    };

    const financialHistory = useMemo(() => {
        const history: {
            id: string,
            date: string,
            time: string,
            type: 'PURCHASE' | 'SALE' | 'SERVICE',
            description: string,
            amount: number,
            detail?: string
        }[] = [];

        const normalizeDateTime = (dStr: string, tStr?: string) => {
            let date = dStr || '';
            let time = tStr || '';

            // 1. Handle concatenated values like "30-01-202610:44 p.m."
            if (!date.includes('T') && date.length > 10 && !date.includes(' ')) {
                const potentialTime = date.substring(10).trim();
                if (potentialTime.includes(':')) {
                    time = potentialTime;
                    date = date.substring(0, 10);
                }
            } else if (date.includes('T')) {
                const parts = date.split('T');
                date = parts[0];
                if (!time) time = parts[1]?.substring(0, 5);
            }

            // 2. Normalize Date to YYYY-MM-DD
            if (date.includes('-')) {
                const parts = date.split('-');
                if (parts[0].length === 2) { // DD-MM-YYYY
                    date = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            }

            // 3. Normalize Time to 24h HH:mm
            if (time) {
                const lower = time.toLowerCase();
                const match = lower.match(/(\d+):(\d+)/);
                if (match) {
                    let hrs = parseInt(match[1]);
                    let mins = parseInt(match[2]);
                    if (lower.includes('p.m.') || lower.includes('pm')) {
                        if (hrs < 12) hrs += 12;
                    } else if (lower.includes('a.m.') || lower.includes('am')) {
                        if (hrs === 12) hrs = 0;
                    }
                    time = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
                } else {
                    time = '00:00';
                }
            } else {
                time = '00:00';
            }

            return { normalizedDate: date, normalizedTime: time };
        };

        movements.forEach(m => {
            const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
            if (isTransfer) return;
            if (viewCampaignId === 'none') {
                if (m.campaignId) return;
            } else if (viewCampaignId !== 'all' && m.campaignId !== viewCampaignId) return;

            const { normalizedDate, normalizedTime } = normalizeDateTime(m.date, m.time);

            if (m.type === 'IN' || m.type === 'PURCHASE') {
                if (m.items && m.items.length > 0) {
                    const totalAmount = m.items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price || 0)), 0);
                    const desc = m.items.length > 1 ? 'Varios' : m.items[0].productName;
                    history.push({
                        id: m.id,
                        date: normalizedDate,
                        time: normalizedTime,
                        type: 'PURCHASE',
                        description: `Compra: ${desc}`,
                        amount: totalAmount,
                        detail: m.items.map((i: any) => `${i.productName}: ${i.quantity} ${i.unit || ''} x USD ${i.price}`).join(', ')
                    });
                } else {
                    const product = products.find(p => p.id === m.productId);
                    const purchasePrice = (m.purchasePrice !== undefined && m.purchasePrice !== null) ? m.purchasePrice : 0;
                    history.push({
                        id: m.id,
                        date: normalizedDate,
                        time: normalizedTime,
                        type: 'PURCHASE',
                        description: `Compra: ${product?.name || 'Insumo'}`,
                        amount: m.quantity * purchasePrice,
                        detail: `${product?.name || 'Insumo'}: ${m.quantity} ${product?.unit || 'u.'} x USD ${purchasePrice.toLocaleString()}`
                    });
                }
            } else if (m.type === 'SALE') {
                const product = products.find(p => p.id === m.productId);
                const salePrice = m.salePrice || 0;
                history.push({
                    id: m.id,
                    date: normalizedDate,
                    time: normalizedTime,
                    type: 'SALE',
                    description: `Venta: ${product?.name || 'Insumo'}`,
                    amount: m.quantity * salePrice,
                    detail: `${product?.name || 'Insumo'}: ${m.quantity} ${product?.unit || 'u.'} x USD ${salePrice.toLocaleString()}`
                });
            } else if (m.type === 'SERVICE') {
                const amount = m.amount || (m.quantity * (m.purchasePrice || 0));
                history.push({
                    id: m.id,
                    date: normalizedDate,
                    time: normalizedTime,
                    type: 'SERVICE',
                    description: `Servicio: ${m.notes || 'Sin descripción'}`,
                    amount: amount,
                    detail: m.notes || 'Pago de servicio ad-hoc'
                });
            }
        });

        orders.forEach(o => {
            if (viewCampaignId !== 'all' && o.campaignId !== viewCampaignId) return;
            if (o.servicePrice && o.servicePrice > 0) {
                const { normalizedDate, normalizedTime } = normalizeDateTime(o.appliedAt || o.date, o.time);
                history.push({
                    id: o.id,
                    date: normalizedDate,
                    time: normalizedTime,
                    type: 'SERVICE',
                    description: o.type === 'HARVEST' ? 'Servicio de cosecha' :
                        (o.type === 'SOWING' ? 'Siembra' : 'Pulverización') +
                        `: Orden No ${o.orderNumber || '---'} (${o.treatedArea} ha)`,
                    amount: o.servicePrice * o.treatedArea,
                    detail: `${o.type === 'HARVEST' ? 'Cosecha' : 'Labor'}: ${o.treatedArea} ha x USD ${o.servicePrice.toLocaleString()}`
                });
            }
        });

        return history.sort((a, b) => {
            const valA = a.date + 'T' + a.time;
            const valB = b.date + 'T' + b.time;
            if (valB !== valA) return valB.localeCompare(valA);
            return b.id.localeCompare(a.id);
        });

    }, [movements, products, orders, viewCampaignId]);

    const investorBreakdown = useMemo(() => {
        const partnersMap = stats.perPartner;
        const incomeMap = stats.perPartnerIncome;
        const totalInvested = stats.totalInvested || 0;

        // Base rows: Main financial summary per partner
        const constRows: any[] = [];

        // Detailed rows: Grain activity per crop
        const grainRows: any[] = [];

        // All potential partners
        const allPartnerNames = new Set([
            ...partners.map(p => p.name),
            ...Object.keys(partnersMap),
            ...Object.keys(stats.grainAssignments),
            ...Object.keys(stats.withdrawalsByPartnerCrop)
        ]);

        allPartnerNames.forEach(pName => {
            if (!pName) return;
            const amount = partnersMap[pName] || 0;
            const income = incomeMap[pName] || 0;
            const percentage = totalInvested > 0 ? (amount / totalInvested) * 100 : 0;

            // Add Main row
            constRows.push({
                name: pName,
                cropName: '-', // Main row indicator
                percentage,
                shareInvestment: amount,
                shareValue: income - amount,
                assigned: 0,
                withdrawn: 0,
                isMain: true
            });

            // Add Grain rows
            const gAssigned = stats.grainAssignments[pName] || {};
            const gWithdrawn = stats.withdrawalsByPartnerCrop[pName] || {};
            const crops = new Set([...Object.keys(gAssigned), ...Object.keys(gWithdrawn)]);

            crops.forEach(crop => {
                grainRows.push({
                    name: pName,
                    cropName: crop,
                    percentage: 0, // Individual crops don't show collective %
                    shareInvestment: 0,
                    shareValue: 0,
                    assigned: gAssigned[crop] || 0,
                    withdrawn: gWithdrawn[crop] || 0,
                    isMain: false
                });
            });
        });

        // Merge and sort
        // We want: Socio A (Main), Socio A (Crop 1), Socio A (Crop 2), Socio B (Main)...
        const finalRows: any[] = [];
        const sortedPartners = constRows.sort((a, b) => b.shareInvestment - a.shareInvestment);

        sortedPartners.forEach(pMain => {
            finalRows.push(pMain);
            const pGrains = grainRows.filter(gr => gr.name === pMain.name);
            finalRows.push(...pGrains);
        });

        return finalRows;
    }, [stats, partners]);

    if (loading || movementsLoading || productsLoading || ordersLoading) {
        return <div className="p-8 text-center text-slate-500">Cargando datos financieros...</div>;
    }

    if (!client) return <div className="p-8 text-center text-red-500">Empresa no encontrada</div>;

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4">
                <div>
                    <Link href={`/clients/${id}`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Dashboard</Link>
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 tracking-tight leading-none">Contaduría</h1>
                            <p className="text-slate-500 mt-1">Resumen de inversión y ventas para <strong>{client.name}</strong></p>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar Campaña:</span>
                            <select
                                className="bg-white border-slate-200 text-sm font-bold text-slate-700 rounded-xl px-4 py-2 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all cursor-pointer shadow-sm"
                                value={viewCampaignId}
                                onChange={e => setViewCampaignId(e.target.value)}
                            >
                                <option value="all">Todas las Campañas</option>
                                <option value="none">Sin Campaña</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Balance Final</h3>
                </div>
                <table className="min-w-full">
                    <tbody className="divide-y divide-slate-200 text-sm">
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-bold uppercase tracking-wider">Total Invertido (-)</td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-red-500">
                                    -USD {stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-emerald-600 font-bold uppercase tracking-wider">Total Vendido (+)</td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-emerald-600">
                                    +USD {stats.sold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className={`${stats.total >= 0 ? 'bg-emerald-50/50' : 'bg-red-50/50'}`}>
                            <td className="px-6 py-5 font-black text-slate-800 uppercase tracking-widest">Balance Final</td>
                            <td className="px-6 py-5 text-right">
                                <span className={`text-base font-black ${stats.total >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                    USD {stats.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>


            {/* Financial History */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Historial de Movimientos</h3>
                </div>
                <div
                    className="overflow-x-auto"
                    ref={scrollRef}
                >
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tipo</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descripción</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Monto Total</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {financialHistory.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No hay movimientos financieros registrados.</td>
                                </tr>
                            ) : (
                                financialHistory.slice(0, historyLimit).map((item) => (
                                    <React.Fragment key={item.id}>
                                        <tr
                                            onClick={() => item.type === 'PURCHASE' ? setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id) : null}
                                            className={`transition-colors ${item.type === 'PURCHASE' ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50'}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-slate-500">
                                                <div className="flex flex-col">
                                                    <span>{formatLedgerDate(item.date, item.time).date}</span>
                                                    <span className="text-[10px] text-slate-400 font-normal uppercase tracking-tighter">
                                                        {formatLedgerDate(item.date, item.time).time}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${item.type === 'SALE' ? 'bg-emerald-100 text-emerald-700' :
                                                    item.type === 'PURCHASE' ? 'bg-orange-100 text-orange-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {item.type === 'SALE' ? 'Ingreso' : 'Egreso'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-600 font-medium italic">
                                                {item.description}
                                                {item.type === 'PURCHASE' && (
                                                    <span className="ml-2 text-[10px] text-emerald-500 font-bold uppercase tracking-tighter">
                                                        {expandedHistoryId === item.id ? '↑' : '↓'}
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className={`px-6 py-4 whitespace-nowrap text-right font-mono font-bold ${item.type === 'SALE' ? 'text-emerald-600' : 'text-red-500'
                                                    }`}>
                                                {item.type === 'SALE' ? '+' : '-'}USD {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                        {expandedHistoryId === item.id && item.detail && (
                                            <tr className="bg-slate-50/50 animate-fadeIn">
                                                <td colSpan={4} className="px-8 py-3">
                                                    <div className="text-xs text-slate-500 space-y-1 border-l-2 border-emerald-300 pl-4 py-1">
                                                        <div className="font-bold text-slate-400 uppercase tracking-widest mb-1">Desglose de compra:</div>
                                                        {item.detail.split(', ').map((d, i) => (
                                                            <div key={i} className="flex gap-24 max-w-2xl">
                                                                <span className="font-medium text-slate-600 w-56 shrink-0">{d.split(': ')[0]}</span>
                                                                <span className="font-mono text-emerald-600 font-bold whitespace-nowrap">
                                                                    {d.split(': ')[1]}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>

                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {(financialHistory.length > historyLimit || historyLimit > 10) && (
                    <div className="p-2 bg-slate-50 border-t border-slate-100 text-center flex justify-center gap-4">
                        {financialHistory.length > historyLimit && (
                            <button
                                onClick={() => setHistoryLimit(prev => prev + 10)}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                            >
                                Cargar 10 más
                            </button>
                        )}
                        {historyLimit > 10 && (
                            <button
                                onClick={() => setHistoryLimit(prev => Math.max(10, prev - 10))}
                                className="text-xs font-bold text-slate-400 hover:text-slate-600 uppercase tracking-widest"
                            >
                                Cargar 10 menos
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Campaigns Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Campañas</h3>
                    {!isReadOnly && (
                        <button
                            onClick={() => setShowEditCampaigns(!showEditCampaigns)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                        >
                            {showEditCampaigns ? 'Cerrar edición' : '✏️ Gestionar campañas'}
                        </button>
                    )}
                </div>

                <div className="py-0">
                    {showEditCampaigns && (
                        /* Minimalist Creation Row - Floating style */
                        <div className="px-6 py-3 mb-2 border-b border-slate-200 pb-4 animate-fadeIn">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Input
                                        placeholder="Nombre de nueva campaña"
                                        value={newCampaignName}
                                        onChange={e => setNewCampaignName(e.target.value)}
                                        className="bg-white border-slate-200 focus:border-emerald-500 h-8 text-sm placeholder:text-slate-400"
                                    />
                                </div>
                                <div className="flex items-center gap-2 whitespace-nowrap">
                                    <span className="text-[10px] font-medium text-slate-900 uppercase tracking-widest">Repartición de</span>
                                    <select
                                        value={newCampaignMode}
                                        onChange={e => setNewCampaignMode(e.target.value as CampaignMode)}
                                        className="h-8 px-2 bg-white border border-slate-200 rounded text-xs font-medium text-slate-600 outline-none focus:ring-1 focus:ring-emerald-500"
                                    >
                                        <option value="MONEY">Saldo Monetario</option>
                                        <option value="GRAIN">Granos</option>
                                        <option value="MIXED">Mixta (Granos + Saldo)</option>
                                    </select>
                                </div>
                                <button
                                    onClick={async () => {
                                        if (!newCampaignName) return alert('Ingrese un nombre');
                                        await addCampaign({ name: newCampaignName, mode: newCampaignMode });
                                        setNewCampaignName('');
                                    }}
                                    disabled={!newCampaignName}
                                    className="h-8 w-8 shrink-0 flex items-center justify-center bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="space-y-0 divide-y divide-slate-200">

                        {campaigns.map(camp => (
                            <div key={camp.id} className="px-6 animate-fadeIn">
                                {showEditCampaigns ? (
                                    editingCampaignId === camp.id ? (
                                        /* Edit Mode Row - Matching Creation layout */
                                        <div className="flex items-center gap-4 py-2">
                                            <div className="flex-1">
                                                <Input
                                                    value={camp.name}
                                                    onChange={e => updateCampaign({ ...camp, name: e.target.value })}
                                                    className="bg-white border-emerald-200 text-sm h-8"
                                                    autoFocus
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 whitespace-nowrap">
                                                <span className="text-[10px] font-medium text-slate-900 uppercase tracking-widest">Repartición de</span>
                                                <select
                                                    value={camp.mode}
                                                    onChange={e => updateCampaign({ ...camp, mode: e.target.value as CampaignMode })}
                                                    className="h-8 px-2 bg-white border border-emerald-200 rounded text-xs font-medium text-slate-600 outline-none"
                                                >
                                                    <option value="MONEY">Saldo Monetario</option>
                                                    <option value="GRAIN">Granos</option>
                                                    <option value="MIXED">Mixta (Granos + Saldo)</option>
                                                </select>
                                            </div>
                                            <button
                                                onClick={() => setEditingCampaignId(null)}
                                                className="h-8 w-8 shrink-0 flex items-center justify-center bg-emerald-500 text-white rounded hover:bg-emerald-600 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        /* Management Mode - Floating with icons */
                                        /* Management Mode - Floating with icons */
                                        <div className="flex flex-col md:flex-row md:items-center justify-between py-2 group gap-3">
                                            {/* Left - Label Area (takes priority) */}
                                            <div className="flex-1 min-w-0">
                                                <span className="font-semibold text-slate-900 text-sm truncate block" title={camp.name}>
                                                    {camp.name}
                                                </span>
                                            </div>

                                            {/* Right - Actions & Metadata */}
                                            <div className="flex items-center gap-4 shrink-0 px-2 py-1">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] whitespace-nowrap">
                                                    Repartición de {camp.mode === 'GRAIN' ? 'Granos' : camp.mode === 'MIXED' ? 'Mixta' : 'Saldo Monetario'}
                                                </span>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => setEditingCampaignId(camp.id)}
                                                        className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                        title="Editar detalles de campaña"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                    </button>

                                                    {snapshots.some(s => s.campaignId === camp.id) ? (
                                                        <button
                                                            onClick={() => handleRecrearArchivo(camp.id)}
                                                            disabled={isSnapshotting}
                                                            title="Recalcular todos los movimientos históricos y actualizar el cierre"
                                                            className="px-2.5 py-1.5 bg-orange-50 text-orange-600 hover:bg-orange-100 text-[9px] font-black uppercase tracking-wider rounded transition-colors whitespace-nowrap shadow-sm border border-orange-100"
                                                        >
                                                            {isSnapshotting ? 'Procesando...' : 'Recrear Archivo'}
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleCerrarCampaña(camp.id)}
                                                            disabled={isSnapshotting}
                                                            title="cerrar campaña y guardar copia"
                                                            className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[9px] font-black uppercase tracking-wider rounded transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-sm border border-emerald-100"
                                                        >
                                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                                            {isSnapshotting ? 'Guardando...' : 'Cerrar Campaña'}
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`¿Eliminar campaña ${camp.name}? Los movimientos asociados quedarán huérfanos.`)) {
                                                                deleteCampaign(camp.id);
                                                            }
                                                        }}
                                                        className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                                                        title="Eliminar campaña"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                ) : (
                                    /* Normal Mode - Clean Floating text */
                                    <div className="flex justify-between items-center py-2.5">
                                        <span className="font-medium text-slate-800 text-sm">{camp.name}</span>
                                        <span className={`text-[10px] font-medium uppercase tracking-widest text-slate-900`}>
                                            Repartición de {camp.mode === 'GRAIN' ? 'Granos' : camp.mode === 'MIXED' ? 'Mixta' : 'Saldo Monetario'}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                        {campaigns.length === 0 && <div className="text-center py-6 text-slate-400 text-sm italic">No hay campañas registradas.</div>}
                    </div>
                </div>
            </div>

            {/* Investors Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Desglose por Socio</h3>
                    {!isReadOnly && (
                        <button
                            onClick={() => setShowEditInvestors(!showEditInvestors)}
                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase tracking-widest"
                        >
                            {showEditInvestors ? 'Cerrar edición' : '✏️ Gestionar socios'}
                        </button>
                    )}
                </div>

                {showEditInvestors ? (
                    <div className="p-6 space-y-4 animate-fadeIn">
                        <div className="flex justify-between items-center border-b pb-2 mb-4">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Listado de Socios / Inversores</span>
                            <button
                                onClick={addPartner}
                                className="text-xs font-bold text-emerald-600 hover:text-emerald-700 uppercase"
                            >
                                + Agregar Socio
                            </button>
                        </div>

                        {partners.length === 0 ? (
                            <p className="text-sm text-slate-400 italic">No hay socios definidos.</p>
                        ) : (
                            <div className="space-y-2">
                                {partners.map((p, idx) => (
                                    <div key={idx} className="group flex gap-2 items-start">
                                        {editingPartnerIdx === idx ? (
                                            <>
                                                <div className="flex-1 space-y-2">
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Nombre</label>
                                                        <Input
                                                            value={p.name}
                                                            onChange={e => updatePartner(idx, 'name', e.target.value)}
                                                            placeholder="Nombre del socio"
                                                            className="h-10 px-3 text-sm focus:ring-emerald-500 border-emerald-500"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">CUIT</label>
                                                        <Input
                                                            value={p.cuit || ''}
                                                            onChange={e => updatePartner(idx, 'cuit', e.target.value)}
                                                            placeholder="CUIT (e.g. 20-12345678-9)"
                                                            className="h-10 px-3 text-sm focus:ring-emerald-500 border-slate-200"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 pt-5">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPartnerIdx(null);
                                                            setBackupPartner(null);
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                        title="Confirmar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => cancelEdit(idx)}
                                                        className="h-10 w-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-lg hover:bg-slate-100 transition-colors"
                                                        title="Cancelar edición"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1 min-h-10 px-4 py-2 flex flex-col justify-center bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm transition-all group-hover:border-slate-300">
                                                    <div className="font-bold">{p.name || <span className="text-slate-400 italic font-normal">Socio sin nombre</span>}</div>
                                                    {p.cuit && <div className="text-[10px] text-slate-400 font-mono">CUIT: {p.cuit}</div>}
                                                </div>
                                                <div className="flex gap-1 h-10 items-center">
                                                    <button
                                                        onClick={() => {
                                                            setBackupPartner(partners[idx]);
                                                            setEditingPartnerIdx(idx);
                                                        }}
                                                        className="h-10 w-10 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100"
                                                        title="Editar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" /></svg>
                                                    </button>
                                                    <button
                                                        onClick={() => removePartner(idx)}
                                                        className="h-10 w-10 flex items-center justify-center text-slate-300 hover:text-red-500 rounded-lg transition-colors"
                                                        title="Eliminar"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex justify-end items-center pt-4 border-t mt-4">
                            <Button
                                size="sm"
                                onClick={handleSaveInvestors}
                                isLoading={isSaving}
                            >
                                Guardar Lista de Socios
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto" ref={partnersScrollRef}>
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Socio</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Participación</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Inversión (USD)</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Saldo Monetario (USD)</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Cultivo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cosecha Asignada</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Cosecha Retirada</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {investorBreakdown.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-8 text-center text-slate-400 italic">No hay inversores registrados para esta empresa o campaña.</td>
                                    </tr>
                                ) : (
                                    investorBreakdown.map((inv, idx) => (
                                        <tr key={idx} className={`hover:bg-slate-50 transition-colors ${inv.isMain ? 'bg-white' : 'bg-slate-50/20'}`}>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${inv.isMain ? 'text-slate-900 border-l-4 border-emerald-500' : 'text-slate-400 pl-10'}`}>
                                                {inv.isMain ? inv.name : (idx > 0 && investorBreakdown[idx - 1].name === inv.name ? '' : inv.name)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-600">
                                                {inv.isMain ? `${inv.percentage.toFixed(2)}%` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-red-600">
                                                {inv.isMain ? `-USD ${inv.shareInvestment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold ${inv.shareValue >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {inv.isMain ? `${inv.shareValue < 0 ? '-USD ' : 'USD '}${Math.abs(inv.shareValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${inv.cropName === '-' ? 'text-slate-300' : 'text-slate-600 italic'}`}>
                                                {inv.cropName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-slate-700">
                                                {inv.cropName !== '-' ? `${inv.assigned.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-mono font-bold text-orange-600">
                                                {inv.cropName !== '-' ? `${inv.withdrawn.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg` : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Investment Breakdown at the bottom */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 px-6 py-3 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">Desglose de inversiones</h3>
                </div>
                <table className="min-w-full">
                    <tbody className="divide-y divide-slate-200">
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 tracking-wider">Compras Insumos</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-slate-700">
                                    USD {stats.investedMovements.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-sm font-bold text-slate-500 tracking-wider">Servicios (Órdenes)</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-bold text-slate-700">
                                    USD {stats.serviceCosts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                        <tr className="bg-slate-50/50">
                            <td className="px-6 py-4 flex items-center gap-3">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Inversión Total</span>
                            </td>
                            <td className="px-6 py-4 text-right">
                                <span className="text-base font-black text-slate-900">
                                    USD {stats.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div className="flex justify-center pt-4">
                <Link
                    href={`/clients/${id}/investors/details`}
                    className="group flex items-center gap-2 bg-white border border-slate-200 px-6 py-3 rounded-xl shadow-sm hover:border-emerald-500 hover:shadow-md transition-all"
                >
                    <span className="text-sm font-bold text-slate-600 group-hover:text-emerald-700 uppercase tracking-widest">Más detalle</span>
                    <span className="text-emerald-500 group-hover:translate-x-1 transition-transform">→</span>
                </Link>
            </div>
        </div >
    );
}
