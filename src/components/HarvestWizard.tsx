import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Warehouse, Campaign, Lot, Farm, InventoryMovement, TransportSheet } from '@/types';
import { InvestorSelector } from '@/components/InvestorSelector';
import { normalizeNumber } from '@/lib/numbers';

/**
 * Normalizes a string for robust matching (removes accents, spaces, and case)
 */
const normalizeKey = (val: string | undefined | null) => {
    if (!val) return "";
    return val.toString()
        .toLowerCase()
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") 
        .replace(/[^a-z0-9]/g, "");
};

interface HarvestData {
    date: string;
    contractor: string;
    campaignId: string;
    laborPricePerHa: number;
    investor?: string;
    investors?: Array<{ name: string; percentage: number }>;
    harvestType: 'SEMILLA' | 'GRANO';
    totalYield: number;
    technicalResponsible?: string;
    distributions: Array<{
        id: string; // unique frontend UI id
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: any;
    }>;
    transportSheets: TransportSheet[];
}

interface HarvestWizardProps {
    lot: Lot;
    farm: Farm;
    contractors: { id: string, username: string }[];
    campaigns: Campaign[];
    warehouses: Warehouse[];
    partners: { name: string, cuit?: string }[];
    investors: { name: string, percentage: number }[];
    movements: InventoryMovement[];
    campaignShares?: Record<string, Record<string, number>>;
    campaignInvestments?: Record<string, { totalUSD: number, partnersUSD: Record<string, number> }>;
    onCancel: () => void;
    onComplete: (data: HarvestData) => void;
    initialDate: string;
    initialContractor: string;
    initialLaborPrice: string;
    initialYield: string;
    initialTechnicalResponsible?: string;
    isExecutingPlan: boolean;
    initialDistributions?: any[];
    initialTransportSheets?: TransportSheet[];
    defaultWhId?: string;
}

export const HarvestWizard: React.FC<HarvestWizardProps> = ({
    lot,
    farm,
    contractors,
    campaigns,
    warehouses,
    partners,
    investors,
    movements,
    onCancel,
    onComplete,
    initialDate,
    initialContractor,
    initialLaborPrice,
    initialYield,
    isExecutingPlan,
    initialDistributions,
    initialTransportSheets,
    initialTechnicalResponsible,
    defaultWhId,
    campaignShares = {},
    campaignInvestments = {}
}) => {
    const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

    // Step 1 State
    const [harvestDate, setHarvestDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [harvestContractor, setHarvestContractor] = useState(initialContractor || '');
    const [selectedHarvestCampaignId, setSelectedHarvestCampaignId] = useState(initialDistributions?.[0]?.campaignId || initialDistributions?.[0]?.logistics?.campaignId || '');
    const [harvestLaborPrice, setHarvestLaborPrice] = useState(initialLaborPrice || '');
    const [selectedHarvestInvestors, setSelectedHarvestInvestors] = useState<Array<{ name: string; percentage: number }>>(
        initialDistributions?.[0]?.investors ||
        initialDistributions?.[0]?.logistics?.investors ||
        (initialDistributions?.[0]?.investorName ? [{ name: initialDistributions?.[0]?.investorName, percentage: 100 }] :
            initialDistributions?.[0]?.logistics?.investorName ? [{ name: initialDistributions[0].logistics.investorName, percentage: 100 }] : [])
    );
    const [harvestType, setHarvestType] = useState<'SEMILLA' | 'GRANO'>(
        (initialDistributions?.[0]?.type === 'SEMILLA' || initialDistributions?.[0]?.logistics?.type === 'SEMILLA') ? 'SEMILLA' : 'GRANO'
    );
    const [harvestTechnicalResponsible, setHarvestTechnicalResponsible] = useState(
        initialTechnicalResponsible || 
        initialDistributions?.[0]?.technicalResponsible || 
        initialDistributions?.[0]?.logistics?.technicalResponsible || ''
    );

    const [isConfirming, setIsConfirming] = useState(false);
    const [showQuotaId, setShowQuotaId] = useState<string | null>(null);

    // Global click-to-close for magnifier
    React.useEffect(() => {
        if (!showQuotaId) return;
        const handleGlobalClick = () => setShowQuotaId(null);
        window.addEventListener('mousedown', handleGlobalClick);
        return () => window.removeEventListener('mousedown', handleGlobalClick);
    }, [showQuotaId]);

    // Step 2 State (Distribution) — remains Step 2 internally for state management but swapped in UI
    const [distributions, setDistributions] = useState<Array<{
        id: string;
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: any;
    }>>(() => {
        if (initialDistributions && initialDistributions.length > 0) {
            return initialDistributions;
        }

        // For new harvests, pre-load default warehouse if available
        if (defaultWhId) {
            const defaultWh = warehouses.find(w => w.id === defaultWhId);
            if (defaultWh) {
                return [{
                    id: `default_${Date.now()}`,
                    type: 'WAREHOUSE',
                    targetId: defaultWh.id,
                    targetName: defaultWh.name,
                    amount: 0,
                    logistics: {}
                }];
            }
        }
        return [];
    });
    const [selectedDistribOption, setSelectedDistribOption] = useState('');

    // Step 3 State — Transport Sheets (use initial if provided, otherwise start with one blank)
    const [transportSheets, setTransportSheets] = useState<TransportSheet[]>(() => {
        if (initialTransportSheets && initialTransportSheets.length > 0) {
            return initialTransportSheets;
        }

        const now = new Date();
        const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const farmParts = [farm.name, farm.province, farm.city, farm.address].filter(Boolean);
        const originStr = lot.name + (farmParts.length > 0 ? `, ${farmParts.join(', ')}` : '');

        const firstSheet: TransportSheet = { 
            id: `sheet_${Date.now()}`, 
            dischargeNumber: '1',
            originAddress: originStr,
            departureDateTime: formattedNow
        };
        return [firstSheet];
    });
    const [activeSheetIndex, setActiveSheetIndex] = useState(initialTransportSheets && initialTransportSheets.length > 0 ? initialTransportSheets.length - 1 : 0);
    const [selectedProfileId, setSelectedProfileId] = useState('general');
    const [customProfiles, setCustomProfiles] = useState<Array<{ id: string; name: string; data: Partial<TransportSheet> }>>([]);

    // Dynamic Total Yield Calculation
    const calculatedTotalYield = useMemo(() => {
        return transportSheets.reduce((sum, s) => {
            const net = normalizeNumber(s.grossWeight?.toString() || '0') - normalizeNumber(s.tareWeight?.toString() || '0');
            return sum + (net > 0 ? net : 0);
        }, 0);
    }, [transportSheets]);


    const totalYieldNum = Math.floor(Number(calculatedTotalYield) || 0);
    const assignedYield = Math.floor(distributions.reduce((sum, d) => sum + d.amount, 0));
    const availableYield = Math.floor(totalYieldNum - assignedYield);

    // --- Helper for Quota Logic ---
    const getPartnerQuotaInfo = (partnerName: string) => {
        if (!selectedHarvestCampaignId) return null;

        const campaign = campaigns.find(c => c.id === selectedHarvestCampaignId);
        const isMixedOrGrain = campaign?.mode === 'MIXED' || campaign?.mode === 'GRAIN';
        
        let percentage = 0;
        const legacyInvestor = investors.find(i => i.name === partnerName);
        
        if (isMixedOrGrain) {
            // Factor in Harvest Labor Cost for real-time participation update
            const historical = campaignInvestments[selectedHarvestCampaignId] || { totalUSD: 0, partnersUSD: {} };
            const laborPrice = normalizeNumber(harvestLaborPrice) || 0;
            const currentLaborCost = laborPrice * (lot.hectares || 0);
            
            // Calculate partner's share of current labor cost
            const partnerLaborAllocation = selectedHarvestInvestors.find(i => i.name === partnerName);
            const partnerLaborShare = currentLaborCost * ((partnerLaborAllocation?.percentage || 0) / 100);
            
            const dynamicTotalUSD = historical.totalUSD + currentLaborCost;
            const dynamicPartnerUSD = (historical.partnersUSD[partnerName] || 0) + partnerLaborShare;
            
            if (dynamicTotalUSD > 0) {
                percentage = (dynamicPartnerUSD / dynamicTotalUSD) * 100;
            } else if (campaignShares[selectedHarvestCampaignId]?.[partnerName] !== undefined) {
                percentage = campaignShares[selectedHarvestCampaignId][partnerName];
            }
        } else if (legacyInvestor) {
            percentage = legacyInvestor.percentage;
        }

        if (percentage === 0 && !legacyInvestor) return null;

        const previousHarvested = movements
            .filter(m => m.campaignId === selectedHarvestCampaignId && m.type === 'HARVEST' && m.referenceId !== lot.id && !m.deleted)
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        // Include the current yield from Step 1 in the total pool
        const totalCampaignYield = previousHarvested + totalYieldNum;

        const previousRetired = movements
            .filter(m =>
                m.campaignId === selectedHarvestCampaignId &&
                m.receiverName === partnerName &&
                (m.type === 'HARVEST' || m.type === 'OUT') &&
                m.referenceId !== lot.id &&
                !m.deleted
            )
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        const totalAllotment = Math.floor(totalCampaignYield * (percentage / 100));
        const remaining = Math.floor(totalAllotment - previousRetired);

        return {
            percentage,
            remaining, // Based on floor rounding
            totalAllotment,
            previousRetired
        };
    };

    // --- Participation Ledger Logic ---
    const participationLedger = useMemo(() => {
        if (!selectedHarvestCampaignId) return [];

        const campaign = campaigns.find(c => c.id === selectedHarvestCampaignId);
        if (!campaign) return [];

        // 1. Get Campaign Shares (Target Percentages)
        const targetShares = campaignShares[selectedHarvestCampaignId] || {};

        // 2. Fetch Historical Totals from props.movements
        const campaignMovements = movements.filter(m => m.campaignId === selectedHarvestCampaignId && !m.deleted);
        const pastHarvests = campaignMovements
            .filter(m => m.type === 'HARVEST')
            .reduce((acc, m) => acc + Number(m.quantity || 0), 0);
        const pastSales = campaignMovements
            .filter(m => m.type === 'SALE')
            .reduce((acc, m) => acc + Number(m.quantity || 0), 0);

        // 3. Calculate Pool (Denominator: Total Production to date)
        const cumulativePool = Number(pastHarvests) + Number(calculatedTotalYield);

        // 4. Calculate Ledger candidates using identical logic to Step 3 distributions
        const socioWizardTotals = new Map<string, number>();
        transportSheets.forEach(s => {
            const mark = s.partnermark;
            if (mark && mark !== 'General') {
                const net = normalizeNumber(s.grossWeight?.toString() || '0') - normalizeNumber(s.tareWeight?.toString() || '0');
                const current = socioWizardTotals.get(mark) || 0;
                socioWizardTotals.set(mark, current + (net > 0 ? net : 0));
            }
        });

        return partners.map(p => {
            const pKey = p.name;
            const quotaInfo = getPartnerQuotaInfo(p.name);
            
            const pastRetired = campaignMovements
                .filter(m => m.type === 'HARVEST' && m.receiverName === pKey)
                .reduce((acc, m) => acc + Number(m.quantity || 0), 0);

            const totalWizardAmount = socioWizardTotals.get(pKey) || 0;
            const totalTaken = Number(pastRetired) + Number(totalWizardAmount);
            const targetPercent = Number(quotaInfo?.percentage || targetShares[p.name] || 0);
            const realizedPercent = cumulativePool > 0 ? (totalTaken / cumulativePool * 100) : 0;

            return {
                name: p.name,
                realizedPercent,
                targetPercent,
                totalTaken,
                cumulativePool, // Pass this for the debug label
                isExceeded: realizedPercent > targetPercent + 0.1
            };
        }).filter(p => Number(p.targetPercent) > 0);
    }, [transportSheets, calculatedTotalYield, selectedHarvestCampaignId, movements, campaignShares, partners, campaigns, campaignInvestments, harvestLaborPrice, selectedHarvestInvestors, lot]);

    // Profile options derived from distributions
    const profileOptions = useMemo(() => {
        const opts: Array<{ id: string; label: string }> = [
            { id: 'general', label: 'GENERAL (Aplica a todos)' }
        ];
        partners.forEach(p => {
            opts.push({ id: `P_${p.name}`, label: p.name });
        });

        customProfiles.forEach(p => {
            if (!opts.some(o => o.id === p.id)) {
                opts.push({ id: p.id, label: p.name });
            }
        });

        opts.push({ id: 'ACTION_ADD', label: '+ Nuevo Perfil' });
        return opts;
    }, [partners, customProfiles]);


    const currentCampaign = campaigns.find(c => c.id === selectedHarvestCampaignId);

    const allDestinations = useMemo(() => {
        const options: Array<{ label: string; value: string; disabled?: boolean; type?: 'WAREHOUSE' | 'PARTNER'; name?: string }> = [];
        options.push({ label: '--- Galpones ---', disabled: true, value: 'galpon_header' });
        warehouses.forEach(w => options.push({ label: w.name, value: `W_${w.id}`, type: 'WAREHOUSE' as const, name: w.name }));

        // Step 3 Restriction: Only Warehouses are added manually. 
        // Partners are sourced exclusively from Step 2 marks.
        return options;
    }, [warehouses]);

    const handleAddDistribution = () => {
        if (!selectedDistribOption) return;

        const option = allDestinations.find(o => o.value === selectedDistribOption);
        if (!option || option.disabled) return;

        const newId = `dist_${Date.now()}`;
        const type = option.type as 'WAREHOUSE' | 'PARTNER';

        setDistributions(prev => [...prev, {
            id: newId,
            type: type,
            targetId: type === 'WAREHOUSE' ? (option.value as string).replace('W_', '') : (option.value as string).replace('P_', ''),
            targetName: option.name as string,
            amount: 0,
            logistics: {} // gets populated via general defaults on save or overrides
        }]);
        setSelectedDistribOption('');
    };

    const handleUpdateDistributionAmount = (id: string, newAmount: number) => {
        setDistributions(prev => prev.map(d => {
            if (d.id === id) {
                return { ...d, amount: newAmount };
            }
            return d;
        }));
    };

    const handleUpdateDistributionAmountString = (id: string, val: string) => {
        const num = normalizeNumber(val);
        handleUpdateDistributionAmount(id, num);
    };

    const handleFillRemainder = (id: string) => {
        const dist = distributions.find(d => d.id === id);
        if (!dist) return;

        if (dist.type === 'PARTNER') {
            const info = getPartnerQuotaInfo(dist.targetName);
            if (info) {
                // If they have more than the quota, take it back to the quota
                // If they have less, fill up to the quota (or available yield)
                const maxInTruck = availableYield + dist.amount;
                handleUpdateDistributionAmount(id, Math.floor(Math.min(maxInTruck, info.remaining)));
                return;
            }
        }

        handleUpdateDistributionAmount(id, Math.floor(dist.amount + availableYield));
    };

    const handleDeleteDistribution = (id: string) => {
        setDistributions(prev => prev.filter(d => d.id !== id));
    };

    // --- Step 3: Transport Sheet Helpers ---
    const activeSheet = transportSheets[activeSheetIndex] || null;

    const updateSheetField = (field: keyof TransportSheet, value: any) => {
        setTransportSheets(prev => prev.map((s, i) => {
            if (i === activeSheetIndex) {
                return { ...s, [field]: value };
            }
            return s;
        }));
    };

    const getSheetValue = (field: keyof TransportSheet): string | number => {
        if (!activeSheet) return '';
        const val = activeSheet[field];
        if (typeof val === 'string' || typeof val === 'number') return val;
        return '';
    };

    const getNextDischargeNumber = (): string => {
        if (transportSheets.length === 0) return '1';
        const lastSheet = transportSheets[transportSheets.length - 1];
        const lastNum = parseInt(lastSheet.dischargeNumber || '0', 10);
        return isNaN(lastNum) ? '1' : String(lastNum + 1);
    };

    const applyProfileData = (sheet: TransportSheet, profile: Partial<TransportSheet>) => {
        const skipFields = ['id', 'dischargeNumber', 'grossWeight', 'tareWeight', 'netWeight', 'departureDateTime', 'departureTime'];
        const updatedSheet = { ...sheet };

        Object.entries(profile).forEach(([key, value]) => {
            if (skipFields.includes(key)) return;

            // Rule: Overwrite only if profile has a non-empty value (Partial Patch)
            if (value !== undefined && value !== null && value !== '' && value !== 0) {
                (updatedSheet as any)[key] = value;
            }
        });

        // Handle departureDateTime specifically if present (normalizing naming)
        if ((profile as any).departureDateTime && !(profile as any).departureDateTime.includes('T')) {
             (updatedSheet as any).departureDateTime = (profile as any).departureDateTime;
        }

        return updatedSheet;
    };

    const handleAddSheet = () => {
        // Check custom profiles first (includes 'general' if the user saved over it)
        const customProfile = customProfiles.find(p => p.id === selectedProfileId);
        let profileData: Partial<TransportSheet> = {};

        if (customProfile) {
            profileData = { ...customProfile.data };
        } else {
            // It's a distribution-based profile — pre-fill destination
            const dist = distributions.find(d => d.id === selectedProfileId);
            if (dist) {
                profileData = {
                    distributionId: dist.id,
                };
            }
        }

        const now = new Date();
        const formattedNow = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const farmParts = [farm.name, farm.province, farm.city, farm.address].filter(Boolean);
        const originStr = lot.name + (farmParts.length > 0 ? `, ${farmParts.join(', ')}` : '');

        const newSheet: TransportSheet = applyProfileData({
            id: `sheet_${Date.now()}`,
            dischargeNumber: getNextDischargeNumber(),
            profileName: profileOptions.find(p => p.id === selectedProfileId)?.label || 'GENERAL',
            departureDateTime: formattedNow,
            originAddress: originStr
        } as TransportSheet, {
            ...profileData
        });

        setTransportSheets(prev => [...prev, newSheet]);
        setActiveSheetIndex(transportSheets.length); // Navigate to new sheet
    };

    const handleDeleteSheet = () => {
        if (transportSheets.length === 0) return;
        setTransportSheets(prev => prev.filter((_, i) => i !== activeSheetIndex));
        setActiveSheetIndex(prev => Math.max(0, prev - 1));
    };

    const handleSaveProfile = () => {
        if (!activeSheet) {
            alert('No hay ficha activa para guardar como perfil.');
            return;
        }

        const existingCustom = customProfiles.find(p => p.id === selectedProfileId);

        if (existingCustom) {
            const { id, ...data } = activeSheet;
            setCustomProfiles(prev => prev.map(p =>
                p.id === selectedProfileId ? { ...p, data: data as Partial<TransportSheet> } : p
            ));
        } else {
            const presetOption = profileOptions.find(o => o.id === selectedProfileId);
            if (presetOption) {
                const { id, ...data } = activeSheet;
                setCustomProfiles(prev => [...prev, {
                    id: selectedProfileId,
                    name: presetOption.label,
                    data: data as Partial<TransportSheet>
                }]);
            } else {
                const name = prompt('Nombre del nuevo perfil:');
                if (!name) return;

                const { id, ...data } = activeSheet;
                const newId = `profile_${Date.now()}`;
                setCustomProfiles(prev => [...prev, {
                    id: newId,
                    name,
                    data: data as Partial<TransportSheet>
                }]);
                setSelectedProfileId(newId);
            }
        }
    };

    const syncMarksToDistributions = () => {
        // Collect all Socio marks from Step 2
        const socioTotals = new Map<string, number>();
        transportSheets.forEach(s => {
            if (s.partnermark && s.partnermark !== 'General') {
                const net = (normalizeNumber(s.grossWeight?.toString() || '0') - normalizeNumber(s.tareWeight?.toString() || '0'));
                const current = socioTotals.get(s.partnermark) || 0;
                socioTotals.set(s.partnermark, current + (net > 0 ? net : 0));
            }
        });

        setDistributions(prev => {
            // Keep WAREHOUSE entries
            const warehousesOnly = prev.filter(d => d.type === 'WAREHOUSE');
            
            // Rebuild PARTNER entries from marks
            const markBasedDistributions = Array.from(socioTotals.entries()).map(([name, amount]) => ({
                id: `mark_${name}`,
                type: 'PARTNER' as const,
                targetId: name,
                targetName: name,
                amount: amount,
                logistics: { isFromMark: true } as any
            }));

            return [...warehousesOnly, ...markBasedDistributions];
        });
    };

    // --- Step 4: Summary Calculations ---
    const totalNetWeight = transportSheets.reduce((sum, s) => {
        const gross = s.grossWeight || 0;
        const tare = s.tareWeight || 0;
        return sum + (gross - tare);
    }, 0);

    const weightDifference = totalNetWeight - totalYieldNum;

    const handleFinalSubmit = () => {
        if (assignedYield > totalYieldNum + 1) { // 1kg margin
            alert('Ha asignado más kilos de los cosechados.');
            return;
        }

        let finalDistributions = [...distributions];
        const remaining = totalYieldNum - assignedYield;

        if (remaining > 5) {
            // Auto-assign remainder to default warehouse
            const targetWh = warehouses.find(w => w.id === defaultWhId) || (finalDistributions.length === 0 ? warehouses[0] : null);

            if (targetWh) {
                const existingWhIndex = finalDistributions.findIndex(d => d.type === 'WAREHOUSE' && d.targetId === targetWh.id);
                if (existingWhIndex >= 0) {
                    finalDistributions[existingWhIndex] = {
                        ...finalDistributions[existingWhIndex],
                        amount: finalDistributions[existingWhIndex].amount + remaining
                    };
                } else {
                    finalDistributions.push({
                        id: `auto_${Date.now()}`,
                        type: 'WAREHOUSE',
                        targetId: targetWh.id,
                        targetName: targetWh.name,
                        amount: remaining,
                        logistics: { notes: finalDistributions.length > 0 ? 'Cosecha: asignación automática del remanente' : '' } as any
                    });
                }
            } else if (finalDistributions.length === 0) {
                alert('No hay depósitos disponibles para asignar la cosecha.');
                return;
            }
        }

        // Apply general logistics as fallbacks to all distributions
        const processedDistributions = finalDistributions.map(d => {
            return { ...d, logistics: { ...d.logistics } };
        });

        onComplete({
            date: harvestDate,
            contractor: harvestContractor,
            campaignId: selectedHarvestCampaignId,
            laborPricePerHa: normalizeNumber(harvestLaborPrice),
            investor: selectedHarvestInvestors.length > 0 ? selectedHarvestInvestors[0].name : '',
            investors: selectedHarvestInvestors,
            harvestType,
            totalYield: Number(calculatedTotalYield),
            technicalResponsible: harvestTechnicalResponsible,
            distributions: processedDistributions,
            transportSheets
        });
    };

    return (
        <>
            <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm animate-fadeIn cursor-default overflow-visible" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between mb-4 border-b border-blue-100 pb-2">
                    <h4 className="text-sm font-black text-blue-800 uppercase tracking-wide flex items-center gap-2">
                        {isExecutingPlan ? 'Registrar Cosecha' : 'Editar Cosecha'} <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">Paso {step} de 4</span>
                    </h4>
                    <button type="button" onClick={onCancel} className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 transition-colors" title="Cancelar cosecha">✕</button>
                </div>

                {/* STEP 1: PARAMETERS */}
                {step === 1 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input label="Fecha (DD/MM/YYYY)" type="date" value={harvestDate} onChange={e => setHarvestDate(e.target.value)} className="bg-white" labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1" />
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Campaña</label>
                                <select className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" value={selectedHarvestCampaignId} onChange={e => setSelectedHarvestCampaignId(e.target.value)}>
                                    <option value="">Seleccionar...</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <Input label="Responsable técnico" placeholder="" value={harvestTechnicalResponsible} onChange={e => setHarvestTechnicalResponsible(e.target.value)} className="bg-white" labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1" />
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo de Cosecha</label>
                                <select className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" value={harvestType} onChange={e => setHarvestType(e.target.value as 'SEMILLA' | 'GRANO')}>
                                    <option value="GRANO">Grano</option>
                                    <option value="SEMILLA">Semilla</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Contratista (Opcional)</label>
                                <select className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white" value={harvestContractor} onChange={e => setHarvestContractor(e.target.value)}>
                                    <option value="">Ninguno...</option>
                                    {contractors.map(c => <option key={c.id} value={c.username}>{c.username}</option>)}
                                </select>
                            </div>
                            <Input label="Precio Labor (USD/ha) (Opcional)" type="text" inputMode="decimal" value={harvestLaborPrice} onChange={e => setHarvestLaborPrice(normalizeNumber(e.target.value).toString())} className="bg-white" labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1" />
                            <div className="md:col-span-2">
                                <InvestorSelector label="Labor Pagada Por (Opcional)" availablePartners={[...(partners || []), ...(investors || [])]} selectedInvestors={selectedHarvestInvestors} onChange={setSelectedHarvestInvestors} />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: TRANSPORT SHEETS */}
                {step === 2 && (
                    <div className="space-y-4 animate-fadeIn relative z-40">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0 z-30">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Perfil de Carga</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none" value={selectedProfileId} onChange={e => {
                                        const val = e.target.value;
                                        if (val === 'ACTION_ADD') {
                                            const name = prompt('Nombre del nuevo perfil:');
                                            if (name) {
                                                const { id, ...data } = activeSheet || {};
                                                const newId = `profile_${Date.now()}`;
                                                setCustomProfiles(prev => [...prev, { id: newId, name, data: (data || {}) as Partial<TransportSheet> }]);
                                                setSelectedProfileId(newId);
                                            }
                                        } else {
                                            setSelectedProfileId(val);
                                            const customP = customProfiles.find(p => p.id === val);
                                            let pData: Partial<TransportSheet> = {};
                                            if (customP) pData = customP.data;
                                            else if (val.startsWith('P_')) pData = { partnermark: val.replace('P_', '') };
                                            if (pData) setTransportSheets(prev => prev.map((s, idx) => idx === activeSheetIndex ? applyProfileData(s, pData) : s));
                                        }
                                    }}>
                                        {profileOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                                    </select>
                                    <button type="button" onClick={handleSaveProfile} className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-colors flex-shrink-0" title="Guardar ficha actual">
                                        <span className="italic text-sm font-serif">P</span>
                                    </button>
                                </div>
                            </div>
                            <div className="p-4 flex flex-col gap-4 bg-white rounded-b-xl max-h-[50vh] overflow-y-auto">
                                {/* CALC DE DERIVADOS */}
                                {(() => {
                                    const grossF = Number(normalizeNumber(activeSheet?.grossWeight?.toString() || '0'));
                                    const taraF = Number(normalizeNumber(activeSheet?.tareWeight?.toString() || '0'));
                                    const grossP = Number(normalizeNumber(activeSheet?.grossWeightPlant?.toString() || '0'));
                                    const taraP = Number(normalizeNumber(activeSheet?.tareWeightPlant?.toString() || '0'));
                                    const netF = grossF - taraF;
                                    const netP = grossP - taraP;
                                    const diff = netP - netF;

                                    return (
                                        <div className="flex flex-col gap-4">
                                            {/* Row 1: Nro Descarga | Origen */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Nro de Descarga" placeholder="..." value={getSheetValue('dischargeNumber')} onChange={e => updateSheetField('dischargeNumber', e.target.value)} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-8">
                                                    <Input label="Origen" placeholder="..." value={getSheetValue('originAddress')} onChange={e => updateSheetField('originAddress', e.target.value)} />
                                                </div>
                                            </div>

                                            {/* Row 2: Ciudad destino | Empresa Destino | CUIT Corredor */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Ciudad destino" placeholder="..." value={getSheetValue('destinationAddress')} onChange={e => updateSheetField('destinationAddress', e.target.value)} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Empresa de Destino" placeholder="..." value={getSheetValue('destinationCompany')} onChange={e => updateSheetField('destinationCompany', e.target.value)} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="CUIT Corredor" placeholder="..." value={getSheetValue('primarySaleCuit')} onChange={e => updateSheetField('primarySaleCuit', e.target.value)} />
                                                </div>
                                            </div>

                                            {/* Row 3: Empresa Transporte | Chofer | Patente Camion | Patente Acoplado */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-6 sm:col-span-3">
                                                    <Input label="Empresa Transporte" placeholder="..." value={getSheetValue('transportCompany')} onChange={e => updateSheetField('transportCompany', e.target.value)} />
                                                </div>
                                                <div className="col-span-6 sm:col-span-3">
                                                    <Input label="Chofer" placeholder="..." value={getSheetValue('driverName')} onChange={e => updateSheetField('driverName', e.target.value)} />
                                                </div>
                                                <div className="col-span-6 sm:col-span-3">
                                                    <Input label="Patente Camión" placeholder="..." value={getSheetValue('truckPlate')} onChange={e => updateSheetField('truckPlate', e.target.value)} />
                                                </div>
                                                <div className="col-span-6 sm:col-span-3">
                                                    <Input label="Patente Acoplado" placeholder="..." value={getSheetValue('trailerPlate')} onChange={e => updateSheetField('trailerPlate', e.target.value)} />
                                                </div>
                                            </div>

                                            {/* Weights Group (Campo & Planta + Calcs) */}
                                            <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 flex flex-col gap-4">
                                                {/* Pesos Campo & Planta */}
                                                <div className="grid grid-cols-12 gap-4">
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <Input label="Peso Bruto Campo" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('grossWeight')} onChange={e => updateSheetField('grossWeight', normalizeNumber(e.target.value))} />
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <Input label="Peso Tara Campo" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('tareWeight')} onChange={e => updateSheetField('tareWeight', normalizeNumber(e.target.value))} />
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <Input label="Peso Bruto Planta" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('grossWeightPlant')} onChange={e => updateSheetField('grossWeightPlant', normalizeNumber(e.target.value))} />
                                                    </div>
                                                    <div className="col-span-6 sm:col-span-3">
                                                        <Input label="Peso Tara Planta" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('tareWeightPlant')} onChange={e => updateSheetField('tareWeightPlant', normalizeNumber(e.target.value))} />
                                                    </div>
                                                </div>

                                                {/* Netos & Dif */}
                                                <div className="grid grid-cols-12 gap-4">
                                                    <div className="col-span-12 sm:col-span-4">
                                                        <Input label="Peso Neto Campo" readOnly disabled value={netF.toLocaleString()} className="bg-white/50 border-slate-100 font-bold" />
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-4">
                                                        <Input label="Peso Neto Planta" readOnly disabled value={netP.toLocaleString()} className="bg-white/50 border-slate-100 font-bold" />
                                                    </div>
                                                    <div className="col-span-12 sm:col-span-4">
                                                        <Input label="Dif" readOnly disabled value={diff.toLocaleString()} className={`bg-white/50 border-slate-100 font-bold ${diff < 0 ? 'text-red-600' : 'text-emerald-600'}`} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Row 6: Humedad | Hectolitrico | Cuerpos Extraños */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Humedad (%)" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('humidity')} onChange={e => updateSheetField('humidity', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Peso Hectolítrico" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('hectoliterWeight')} onChange={e => updateSheetField('hectoliterWeight', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="% Cuerpos Extraños" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('foreignMatter')} onChange={e => updateSheetField('foreignMatter', normalizeNumber(e.target.value))} />
                                                </div>
                                            </div>

                                            {/* Row 7: Tierra | Verde | Fecha/Hora Partida */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="% Tierra" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('earthPercentage')} onChange={e => updateSheetField('earthPercentage', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="% Verde" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('greenPercentage')} onChange={e => updateSheetField('greenPercentage', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Fecha/Hora Partida" type="datetime-local" value={getSheetValue('departureDateTime')} onChange={e => updateSheetField('departureDateTime', e.target.value)} />
                                                </div>
                                            </div>

                                            {/* Row 8: Km | Tarifa | Socio */}
                                            <div className="grid grid-cols-12 gap-4">
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Km a recorrer" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('distanceKm')} onChange={e => updateSheetField('distanceKm', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <Input label="Tarifa Flete (USD)" type="text" inputMode="decimal" placeholder="0" value={getSheetValue('freightTariff')} onChange={e => updateSheetField('freightTariff', normalizeNumber(e.target.value))} />
                                                </div>
                                                <div className="col-span-12 sm:col-span-4">
                                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Marca de socio</label>
                                                    <select className="flex-1 w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white" value={getSheetValue('partnermark') || 'General'} onChange={e => updateSheetField('partnermark', e.target.value)}>
                                                        <option value="General">General</option>
                                                        {partners.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: DISTRIBUTION */}
                {step === 3 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                <h3 className="font-bold text-slate-800 text-sm">Distribución de Granos</h3>
                                <div className="text-xs font-black uppercase px-2 py-1 rounded bg-blue-100 text-blue-700">
                                    {assignedYield.toLocaleString()} / {totalYieldNum.toLocaleString()} kg asignados
                                </div>
                            </div>

                            <div className="mb-4 min-h-[40px]">
                                {(() => {
                                    const exceededPartners = participationLedger.filter(p => p.isExceeded);
                                    return (availableYield > 0 || exceededPartners.length > 0 || !selectedHarvestCampaignId) ? (
                                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                                            {!selectedHarvestCampaignId && (
                                                <p className="text-[10px] font-bold text-red-600 uppercase leading-none">⚠️ No se ha seleccionado campaña por lo que no se pueden calcular los máximos asignados</p>
                                            )}
                                            {availableYield > 0 && (
                                                <p className="text-[10px] font-bold text-blue-800 uppercase leading-none">Falta asignar: {availableYield.toLocaleString()} kg (irán a galpón default)</p>
                                            )}
                                            {exceededPartners.map(p => (
                                                <p key={p.name} className="text-[10px] font-bold text-blue-600 uppercase leading-none truncate">👤 {p.name} tiene más carga que la asignada</p>
                                            ))}
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="mb-6">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Agregar Galpón</label>
                                <div className="flex gap-2">
                                    <select className="flex-1 px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white" value={selectedDistribOption} onChange={e => setSelectedDistribOption(e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        {allDestinations.map((opt, i) => <option key={i} value={opt.value} disabled={opt.disabled}>{opt.label}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddDistribution} className="bg-blue-600 text-white w-9 h-9 rounded-lg font-bold">+</button>
                                </div>
                            </div>

                            <div className="space-y-2 relative">
                                {distributions.map(dist => {
                                    const isLocked = dist.type === 'PARTNER';
                                    const info = getPartnerQuotaInfo(dist.targetName);
                                    const isExceeded = dist.type === 'PARTNER' && info && dist.amount > info.remaining + 0.1;
                                    return (
                                        <div key={dist.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100 transition-all hover:border-slate-200 relative">
                                            <div className="flex-1 flex flex-col">
                                                <span className="text-xs font-bold text-slate-700">{dist.targetName}</span>
                                                <div 
                                                    className="flex items-center cursor-pointer group"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowQuotaId(dist.id === showQuotaId ? null : dist.id);
                                                    }}
                                                >
                                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400 group-hover:text-slate-600 transition-colors">
                                                        {dist.type === 'WAREHOUSE' ? 'Galpón' : 'Socio'}
                                                        {dist.type === 'PARTNER' && info && (
                                                            <span className={isExceeded ? 'text-red-500 ml-1' : 'ml-1'}>
                                                                • CUPO: {info.remaining.toLocaleString()} kg ({info.percentage.toFixed(1)}%)
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>

                                                {/* True Magnifier (Lupa) Style */}
                                                {showQuotaId === dist.id && dist.type === 'PARTNER' && info && (
                                                    <div 
                                                        className="absolute -left-6 -top-4 z-[101] animate-in fade-in zoom-in duration-100 pointer-events-none"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="bg-white p-6 rounded-lg shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-slate-200 min-w-[340px] pointer-events-auto">
                                                            <div className="flex flex-col gap-1.5">
                                                                <span className="text-xl font-bold text-slate-800">{dist.targetName}</span>
                                                                <span className={`text-[13px] font-black uppercase tracking-tight ${isExceeded ? 'text-red-500' : 'text-slate-500'}`}>
                                                                    Socio • Cupo: {info.remaining.toLocaleString()} kg ({info.percentage.toFixed(1)}%)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="relative w-40">
                                                <input type="text" inputMode="decimal" value={isExceeded && isLocked ? `${Math.round(dist.amount).toLocaleString()} / ${Math.round(info?.remaining || 0).toLocaleString()}` : dist.amount || ''} disabled={isLocked} onChange={e => handleUpdateDistributionAmountString(dist.id, e.target.value)} className={`w-full px-2 py-1.5 text-sm rounded bg-white font-bold text-right pr-9 border transition-all ${isLocked ? 'text-blue-600 border-slate-200' : isExceeded ? 'border-red-500 text-red-600 bg-red-50' : 'border-slate-200 text-blue-600'}`} />
                                                <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold uppercase ${isLocked ? 'text-slate-500' : isExceeded ? 'text-red-500' : 'text-slate-500'}`}>kg</span>
                                            </div>
                                            {dist.type === 'WAREHOUSE' && (
                                                <button type="button" onClick={() => handleFillRemainder(dist.id)} className="w-7 h-7 flex items-center justify-center rounded border border-blue-100 bg-blue-50 text-blue-600 shadow-sm" title="Llenar remanente/cupo">↓</button>
                                            )}
                                            {dist.type === 'WAREHOUSE' && (
                                                <button type="button" onClick={() => handleDeleteDistribution(dist.id)} className="w-7 h-7 flex items-center justify-center rounded border border-red-50 text-red-500">✕</button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: SUMMARY */}
                {step === 4 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 text-sm">Resumen de Camiones</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-700">{transportSheets.length} fichas</span>
                            </div>
                            <div className="max-h-[40vh] overflow-y-auto">
                                {transportSheets.map((sheet, idx) => {
                                    const net = (normalizeNumber(sheet.grossWeight?.toString() || '0') - normalizeNumber(sheet.tareWeight?.toString() || '0'));
                                    return (
                                        <div key={sheet.id} className="flex items-center gap-4 px-4 py-3 hover:bg-blue-50/50 transition-colors cursor-pointer border-b border-slate-50" onClick={() => { setActiveSheetIndex(idx); setStep(2); }}>
                                            <span className="text-sm font-black text-blue-600 min-w-[60px]">Nro {sheet.dischargeNumber || '—'}</span>
                                            <span className="text-sm text-slate-600 flex-1 truncate">{sheet.driverName || 'Sin chofer'}</span>
                                            <div className="flex flex-col items-end min-w-[80px]">
                                                <span className="text-xs font-black text-slate-700">{net.toLocaleString()} kg</span>
                                                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">{sheet.partnermark || 'General'}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer / Navigation */}
                <div className="flex items-center justify-between mt-6 pt-4 px-4 border-t border-blue-100">
                    <div className="flex-1 min-h-[32px] flex items-center">
                        {step === 1 && totalYieldNum > 0 && (
                            <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-100 text-[11px] font-black uppercase tracking-tight shadow-sm animate-fadeIn">
                                Producción: {totalYieldNum.toLocaleString()} kg | Rinde: {(totalYieldNum / (lot.hectares || 1)).toFixed(0)} kg/ha
                            </div>
                        )}
                        {(step === 2 || step === 3) && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 animate-fadeIn">
                                {participationLedger.map(p => (
                                    <span key={p.name} className={`text-xs font-bold uppercase transition-all duration-300 ${p.isExceeded ? 'text-red-700 animate-pulse' : 'text-indigo-600'}`}>
                                        {p.name}: {p.realizedPercent.toFixed(1)}% / {p.targetPercent.toFixed(1)}%
                                        <span className="ml-1 opacity-50 font-normal">({Math.round(p.totalTaken)}/{Math.round(p.cumulativePool)} kg)</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => step > 1 ? setStep((step - 1) as any) : onCancel()} className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors">
                            {step > 1 ? '← Atrás' : 'Cancelar'}
                        </button>
                        <button type="button" onClick={() => {
                            if (step === 1) { setStep(2); }
                            else if (step === 2) { syncMarksToDistributions(); setStep(3); }
                            else if (step === 3) { setStep(4); }
                            else { if (!isConfirming) { setIsConfirming(true); setTimeout(() => setIsConfirming(false), 3000); } else { handleFinalSubmit(); } }
                        }} className={`px-6 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider shadow-md transition-all ${isConfirming ? 'bg-yellow-500 hover:bg-yellow-600 scale-105' : 'bg-blue-600 hover:bg-blue-700'}`}>
                            {step < 4 ? 'Siguiente →' : isConfirming ? '¿Confirmar?' : 'Confirmar Cosecha'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Sheet Navigation (Step 2 Only) */}
            {step === 2 && (
                <div className="flex justify-center gap-3 mt-4">
                    <button type="button" onClick={() => setActiveSheetIndex(prev => Math.max(0, prev - 1))} disabled={activeSheetIndex === 0} className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-lg disabled:bg-slate-300 transition-all hover:scale-105 active:scale-95 flex items-center justify-center">‹</button>
                    <button type="button" onClick={() => setActiveSheetIndex(prev => Math.min(transportSheets.length - 1, prev + 1))} disabled={activeSheetIndex === transportSheets.length - 1} className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-lg disabled:bg-slate-300 transition-all hover:scale-105 active:scale-95 flex items-center justify-center">›</button>
                    <button type="button" onClick={handleAddSheet} className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-2xl shadow-lg transition-all hover:scale-105 active:scale-95 flex items-center justify-center">+</button>
                    <button type="button" onClick={handleDeleteSheet} disabled={transportSheets.length <= 1} className="w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-2xl shadow-lg disabled:bg-slate-300 transition-all hover:scale-105 active:scale-95 flex items-center justify-center">−</button>
                </div>
            )}
        </>
    );
};
