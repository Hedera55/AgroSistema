import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Warehouse, Campaign, Lot, Farm, InventoryMovement, TransportSheet } from '@/types';
import { InvestorSelector } from '@/components/InvestorSelector';
import { normalizeNumber } from '@/lib/numbers';

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
    const [observedYield, setObservedYield] = useState(initialYield || '');
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
        const firstSheet: TransportSheet = { id: `sheet_${Date.now()}`, dischargeNumber: '1' };
        if (farm?.address) firstSheet.originAddress = farm.address;
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

    // Sync observedYield with trucks for downstream compatibility
    React.useEffect(() => {
        setObservedYield(calculatedTotalYield.toString());
    }, [calculatedTotalYield]);

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
            .reduce((acc, m) => acc + (m.quantity || 0), 0);
        const pastSales = campaignMovements
            .filter(m => m.type === 'SALE')
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        // 3. Calculate Pool (Denominator)
        const cumulativePool = pastHarvests + calculatedTotalYield - pastSales;

        // 4. Calculate Taken per Partner (Numerator)
        return partners.map(p => {
            const pastRetired = campaignMovements
                .filter(m => m.type === 'HARVEST' && m.receiverName === p.name)
                .reduce((acc, m) => acc + (m.quantity || 0), 0);

            const currentWizardMarks = transportSheets
                .filter(s => s.partnermark === p.name)
                .reduce((acc, s) => acc + (normalizeNumber(s.grossWeight?.toString() || '0') - normalizeNumber(s.tareWeight?.toString() || '0')), 0);

            const totalTaken = pastRetired + currentWizardMarks;
            const targetPercent = targetShares[p.name] || 0;
            const realizedPercent = cumulativePool > 0 ? (totalTaken / cumulativePool * 100) : 0;

            return {
                name: p.name,
                realizedPercent,
                targetPercent,
                totalTaken,
                isExceeded: realizedPercent > targetPercent + 0.1
            };
        }).filter(p => p.targetPercent > 0);
    }, [selectedHarvestCampaignId, calculatedTotalYield, transportSheets, movements, campaignShares, partners]);

    // Profile options derived from distributions
    const profileOptions = useMemo(() => {
        const opts: Array<{ id: string; label: string }> = [
            { id: 'general', label: 'GENERAL (Aplica a todos)' }
        ];
        // Add Partners as profile options (Marks)
        partners.forEach(p => {
            opts.push({ id: `P_${p.name}`, label: `Marca: ${p.name}` });
        });

        customProfiles.forEach(p => {
            if (!opts.some(o => o.id === p.id)) {
                opts.push({ id: p.id, label: p.name });
            }
        });

        opts.push({ id: 'ACTION_ADD', label: '+ Nuevo Perfil' });
        return opts;
    }, [partners, customProfiles]);

    const totalYieldNum = Math.floor(normalizeNumber(observedYield) || 0);
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
        const skipFields = ['id', 'dischargeNumber', 'grossWeight', 'tareWeight', 'netWeight', 'departureDateTime'];
        const updatedSheet = { ...sheet };

        Object.entries(profile).forEach(([key, value]) => {
            if (skipFields.includes(key)) return;

            // Rule: Overwrite only if profile has a non-empty value
            if (value !== undefined && value !== null && value !== '' && value !== 0) {
                (updatedSheet as any)[key] = value;
            }
        });

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

        const newSheet: TransportSheet = applyProfileData({
            id: `sheet_${Date.now()}`,
            dischargeNumber: getNextDischargeNumber(),
            profileName: profileOptions.find(p => p.id === selectedProfileId)?.label || 'GENERAL'
        } as TransportSheet, {
            originAddress: farm?.address || '',
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
            totalYield: totalYieldNum,
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
                    <button
                        type="button"
                        onClick={onCancel}
                        className="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        title="Cancelar cosecha"
                    >
                        ✕
                    </button>
                </div>

                {/* STEP 1: YIELD */}
                {step === 1 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Input
                                label="Fecha (DD/MM/YYYY)"
                                type="date"
                                value={harvestDate}
                                onChange={e => setHarvestDate(e.target.value)}
                                className="bg-white"
                                labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1"
                            />
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Campaña</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                    value={selectedHarvestCampaignId}
                                    onChange={e => setSelectedHarvestCampaignId(e.target.value)}
                                >
                                    <option value="">Seleccionar...</option>
                                    {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <Input
                                label="Responsable técnico"
                                placeholder="Nombre del encargado..."
                                value={harvestTechnicalResponsible}
                                onChange={e => setHarvestTechnicalResponsible(e.target.value)}
                                className="bg-white"
                                labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1"
                            />
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Tipo de Cosecha</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                    value={harvestType}
                                    onChange={e => setHarvestType(e.target.value as 'SEMILLA' | 'GRANO')}
                                >
                                    <option value="GRANO">Grano</option>
                                    <option value="SEMILLA">Semilla</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Contratista (Opcional)</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                    value={harvestContractor}
                                    onChange={e => setHarvestContractor(e.target.value)}
                                >
                                    <option value="">Ninguno...</option>
                                    {contractors.map(c => <option key={c.id} value={c.username}>{c.username}</option>)}
                                </select>
                            </div>
                            <Input
                                label="Precio Labor (USD/ha) (Opcional)"
                                type="text"
                                inputMode="decimal"
                                value={harvestLaborPrice}
                                onChange={e => setHarvestLaborPrice(normalizeNumber(e.target.value).toString())}
                                className="bg-white"
                                labelClassName="block text-[10px] uppercase font-bold text-slate-500 mb-1"
                            />
                            <div className="md:col-span-2">
                                <InvestorSelector
                                    label="Labor Pagada Por (Opcional)"
                                    availablePartners={[...(partners || []), ...(investors || [])]}
                                    selectedInvestors={selectedHarvestInvestors}
                                    onChange={setSelectedHarvestInvestors}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: TRANSPORT SHEETS (formerly Step 3) */}
                {step === 2 && (
                    <div className="space-y-4 animate-fadeIn relative z-40">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0 z-30">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Perfil de Carga</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={selectedProfileId}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'ACTION_ADD') {
                                                const name = prompt('Nombre del nuevo perfil:');
                                                if (name) {
                                                    const { id, ...data } = activeSheet || {};
                                                    const newId = `profile_${Date.now()}`;
                                                    setCustomProfiles(prev => [...prev, {
                                                        id: newId,
                                                        name,
                                                        data: (data || {}) as Partial<TransportSheet>
                                                    }]);
                                                    setSelectedProfileId(newId);
                                                }
                                            } else {
                                                setSelectedProfileId(val);
                                                const customP = customProfiles.find(p => p.id === val);
                                                let pData: Partial<TransportSheet> = {};
                                                if (customP) {
                                                    pData = customP.data;
                                                } else if (val.startsWith('P_')) {
                                                    pData = { partnermark: val.replace('P_', '') };
                                                }
                                                if (pData) {
                                                    setTransportSheets(prev => prev.map((s, idx) => {
                                                        if (idx === activeSheetIndex) {
                                                            return applyProfileData(s, pData);
                                                        }
                                                        return s;
                                                    }));
                                                }
                                            }
                                        }}
                                    >
                                        {profileOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleSaveProfile}
                                        className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
                                        title="Guardar ficha actual en el perfil"
                                    >
                                        <span className="italic text-sm font-serif">P</span>
                                    </button>
                                </div>
                            </div>

                            {totalYieldNum === 0 && (
                                <div className="mx-4 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                                    <span className="text-amber-600 text-sm">⚠️</span>
                                    <p className="text-[10px] font-black text-amber-800 uppercase">El peso neto de camiones es 0</p>
                                </div>
                            )}

                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white rounded-b-xl max-h-[40vh] overflow-y-auto">
                                <Input label="Nro de Descarga" value={getSheetValue('dischargeNumber')} onChange={e => updateSheetField('dischargeNumber', e.target.value)} />
                                <Input label="Dirección / Origen" value={getSheetValue('originAddress')} onChange={e => updateSheetField('originAddress', e.target.value)} />
                                <Input label="Empresa Transporte" value={getSheetValue('transportCompany')} onChange={e => updateSheetField('transportCompany', e.target.value)} />
                                <Input label="Patente Camión" value={getSheetValue('truckPlate')} onChange={e => updateSheetField('truckPlate', e.target.value)} />
                                <Input label="Chofer" value={getSheetValue('driverName')} onChange={e => updateSheetField('driverName', e.target.value)} />
                                <Input label="Peso Bruto (kg)" type="text" inputMode="decimal" value={getSheetValue('grossWeight')} onChange={e => updateSheetField('grossWeight', normalizeNumber(e.target.value))} />
                                <Input label="Peso Tara (kg)" type="text" inputMode="decimal" value={getSheetValue('tareWeight')} onChange={e => updateSheetField('tareWeight', normalizeNumber(e.target.value))} />
                                <Input label="Empresa de Destino" value={getSheetValue('destinationCompany')} onChange={e => updateSheetField('destinationCompany', e.target.value)} />
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Marca de socio</label>
                                    <select
                                        className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                        value={getSheetValue('partnermark') || 'General'}
                                        onChange={e => updateSheetField('partnermark', e.target.value)}
                                    >
                                        <option value="General">General</option>
                                        {partners.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: DISTRIBUTION (formerly Step 2) */}
                {step === 3 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                                <h3 className="font-bold text-slate-800 text-sm">Distribución de Granos</h3>
                                <div className={`text-xs font-black uppercase px-2 py-1 rounded bg-blue-100 text-blue-700`}>
                                    {assignedYield} / {totalYieldNum} kg asignados
                                </div>
                            </div>

                            <div className="mb-4">
                                {(() => {
                                    const exceededPartner = participationLedger.find(p => p.isExceeded);
                                    return (availableYield > 0 || exceededPartner) ? (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                                            {availableYield > 0 && (
                                                <p className="text-xs font-bold text-blue-800 uppercase">
                                                    Falta asignar cosecha: el remanente ({totalYieldNum - assignedYield} kg) se enviará al galpón por default
                                                </p>
                                            )}
                                            {exceededPartner && (
                                                <p className="text-xs font-bold text-red-600 uppercase">
                                                    ⚠️ Socio {exceededPartner.name} está retirando más grano de lo que permite su participación
                                                </p>
                                            )}
                                        </div>
                                    ) : null;
                                })()}
                            </div>

                            <div className="mb-6">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Agregar Destino (Sólo Galpones)</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white"
                                        value={selectedDistribOption}
                                        onChange={e => setSelectedDistribOption(e.target.value)}
                                    >
                                        <option value="">Seleccionar depósito...</option>
                                        {allDestinations.map((opt, i) => (
                                            <option key={i} value={opt.value} disabled={opt.disabled}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <button type="button" onClick={handleAddDistribution} className="bg-blue-600 text-white w-9 h-9 rounded-lg font-bold">+</button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {distributions.map(dist => {
                                    const isLocked = dist.type === 'PARTNER';
                                    return (
                                        <div key={dist.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <div className="flex-1">
                                                <span className="text-xs font-bold text-slate-700">{dist.targetName}</span>
                                                <span className="block text-[9px] font-black uppercase text-slate-400">
                                                    {dist.type === 'WAREHOUSE' ? 'Galpón' : 'Socio (Desde Camiones - Bloqueado)'}
                                                </span>
                                            </div>
                                            <input
                                                type="text"
                                                value={dist.amount || ''}
                                                disabled={isLocked}
                                                onChange={e => handleUpdateDistributionAmountString(dist.id, e.target.value)}
                                                className={`w-32 px-2 py-1 text-sm bg-white border rounded text-right font-bold ${isLocked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'text-blue-600'}`}
                                            />
                                            {!isLocked && (
                                                <button type="button" onClick={() => handleDeleteDistribution(dist.id)} className="text-red-500 px-2">✕</button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}


                {/* STEP 3: TRANSPORT SHEETS (CARROUSEL) */}
                {step === 3 && (
                    <div className="space-y-4 animate-fadeIn relative z-40">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                            {/* Profile Selector */}
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0 z-30">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Perfil de Carga</label>
                                <div className="flex gap-2">
                                    <select
                                        className="flex-1 px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={selectedProfileId}
                                        onChange={e => {
                                            const val = e.target.value;
                                            if (val === 'ACTION_ADD') {
                                                const name = prompt('Nombre del nuevo perfil:');
                                                if (name) {
                                                    const { id, ...data } = activeSheet || {};
                                                    const newId = `profile_${Date.now()}`;
                                                    setCustomProfiles(prev => [...prev, {
                                                        id: newId,
                                                        name,
                                                        data: (data || {}) as Partial<TransportSheet>
                                                    }]);
                                                    setSelectedProfileId(newId);
                                                }
                                            } else if (val === 'ACTION_DELETE') {
                                                if (confirm(`¿Desea eliminar el perfil seleccionado?`)) {
                                                    setCustomProfiles(prev => prev.filter(p => p.id !== selectedProfileId));
                                                    setSelectedProfileId('general');
                                                }
                                            } else {
                                                setSelectedProfileId(val);
                                                
                                                // Apply profile immediately to current sheet
                                                const customP = customProfiles.find(p => p.id === val);
                                                let pData: Partial<TransportSheet> = {};
                                                
                                                if (customP) {
                                                    pData = customP.data;
                                                } else {
                                                    const dist = distributions.find(d => d.id === val);
                                                    if (dist) {
                                                        pData = {
                                                            distributionId: dist.id,
                                                            // Could also pull logistics from the distribution object if we store it there
                                                        };
                                                    }
                                                }
                                                
                                                if (pData) {
                                                    setTransportSheets(prev => prev.map((s, idx) => {
                                                        if (idx === activeSheetIndex) {
                                                            return applyProfileData(s, pData);
                                                        }
                                                        return s;
                                                    }));
                                                }
                                            }
                                        }}
                                    >
                                        {profileOptions.map(opt => (
                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={handleSaveProfile}
                                        className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-lg flex items-center justify-center shadow-sm transition-colors flex-shrink-0"
                                        title="Guardar ficha actual en el perfil"
                                    >
                                        <span className="italic text-sm font-serif">P</span>
                                    </button>
                                </div>
                            </div>

                            {/* Sheet Form Fields — always visible */}
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white rounded-b-xl max-h-[40vh] overflow-y-auto">
                                <Input
                                    label="Nro de Descarga"
                                    placeholder="..."
                                    value={getSheetValue('dischargeNumber')}
                                    onChange={e => updateSheetField('dischargeNumber', e.target.value)}
                                />
                                <Input
                                    label="Dirección / Origen"
                                    placeholder="Ruta, Localidad..."
                                    value={getSheetValue('originAddress')}
                                    onChange={e => updateSheetField('originAddress', e.target.value)}
                                />
                                <Input
                                    label="CUIT Corredor"
                                    placeholder="..."
                                    value={getSheetValue('primarySaleCuit')}
                                    onChange={e => updateSheetField('primarySaleCuit', e.target.value)}
                                />
                                <Input
                                    label="Empresa Transporte"
                                    placeholder="..."
                                    value={getSheetValue('transportCompany')}
                                    onChange={e => updateSheetField('transportCompany', e.target.value)}
                                />
                                <Input
                                    label="Patente Camión"
                                    placeholder="..."
                                    value={getSheetValue('truckPlate')}
                                    onChange={e => updateSheetField('truckPlate', e.target.value)}
                                />
                                <Input
                                    label="Patente Acoplado"
                                    placeholder="..."
                                    value={getSheetValue('trailerPlate')}
                                    onChange={e => updateSheetField('trailerPlate', e.target.value)}
                                />
                                <Input
                                    label="Chofer"
                                    placeholder="..."
                                    value={getSheetValue('driverName')}
                                    onChange={e => updateSheetField('driverName', e.target.value)}
                                />
                                <Input
                                    label="Humedad (%)"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('humidity')}
                                    onChange={e => updateSheetField('humidity', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Peso Hectolítrico"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('hectoliterWeight')}
                                    onChange={e => updateSheetField('hectoliterWeight', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Peso Bruto (kg)"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('grossWeight')}
                                    onChange={e => updateSheetField('grossWeight', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Peso Tara (kg)"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('tareWeight')}
                                    onChange={e => updateSheetField('tareWeight', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Empresa de Destino"
                                    placeholder="Planta / Acopio..."
                                    value={getSheetValue('destinationCompany')}
                                    onChange={e => updateSheetField('destinationCompany', e.target.value)}
                                />
                                <Input
                                    label="Dirección / Localidad Destino"
                                    placeholder="..."
                                    value={getSheetValue('destinationAddress')}
                                    onChange={e => updateSheetField('destinationAddress', e.target.value)}
                                />
                                <Input
                                    label="Fecha y Horario Partida"
                                    type="datetime-local"
                                    value={getSheetValue('departureDateTime')}
                                    onChange={e => updateSheetField('departureDateTime', e.target.value.replace('T', ' '))}
                                />
                                <Input
                                    label="Km a recorrer"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('distanceKm')}
                                    onChange={e => updateSheetField('distanceKm', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Tarifa Flete (USD)"
                                    type="text"
                                    inputMode="decimal"
                                    placeholder="0"
                                    value={getSheetValue('freightTariff')}
                                    onChange={e => updateSheetField('freightTariff', normalizeNumber(e.target.value))}
                                />
                                <Input
                                    label="Marca de socio"
                                    placeholder="..."
                                    value={getSheetValue('partnermark')}
                                    onChange={e => updateSheetField('partnermark', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 4: SUMMARY */}
                {step === 4 && (
                    <div className="space-y-4 animate-fadeIn">
                        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 text-sm">Fichas de Transporte</h3>
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                                    {transportSheets.length} ficha{transportSheets.length !== 1 ? 's' : ''}
                                </span>
                            </div>

                            <div className="max-h-[50vh] overflow-y-auto">
                                {transportSheets.length === 0 ? (
                                    <div className="p-8 text-center text-sm text-slate-400 italic">
                                        No se cargaron fichas de transporte.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {transportSheets.map((sheet, idx) => {
                                            const net = (sheet.grossWeight || 0) - (sheet.tareWeight || 0);
                                            return (
                                                <div
                                                    key={sheet.id}
                                                    className="flex items-center gap-4 px-4 py-3 hover:bg-blue-50/50 transition-colors cursor-pointer"
                                                    onClick={() => { setActiveSheetIndex(idx); setStep(3); }}
                                                >
                                                    <span className="text-sm font-black text-blue-600 min-w-[60px]">
                                                        Nro {sheet.dischargeNumber || '—'}
                                                    </span>
                                                    <span className="text-sm text-slate-600 flex-1 truncate">
                                                        {sheet.driverName || 'Sin chofer'}
                                                    </span>
                                                    <span className="text-sm text-slate-500 truncate">
                                                        {sheet.destinationCompany || 'Sin destino'}
                                                    </span>
                                                    <div className="flex flex-col items-end min-w-[80px]">
                                                        <span className="text-xs font-black text-slate-700">{net.toLocaleString()} kg</span>
                                                        <span className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Peso Neto</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Weight Validation Warning skipped as they are synced by design now */}
                        </div>
                    </div>
                )}

                <div className={`flex flex-col mt-6 pt-3 border-t border-blue-100 relative`}>
                    {/* INDIGO LEDGER (Step 2 Only) */}
                    {step === 2 && participationLedger.length > 0 && (
                        <div className="absolute -top-12 left-0 right-0 flex justify-center px-4 animate-slideUp">
                            <div className="bg-indigo-600 text-white px-4 py-2 rounded-full shadow-lg text-[11px] font-black tracking-wide flex gap-4 border-2 border-indigo-400 whitespace-nowrap overflow-x-auto no-scrollbar">
                                <span className="text-indigo-200 uppercase">Participación:</span>
                                {participationLedger.map(p => (
                                    <span key={p.name} className={p.isExceeded ? 'text-red-300' : ''}>
                                        {p.name} {p.realizedPercent.toFixed(1)}/{p.targetPercent.toFixed(1)}%
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between w-full">
                        {step === 1 && totalYieldNum > 0 && (
                            <div className="flex items-center gap-2 bg-blue-100 px-3 py-1.5 rounded-lg border border-blue-200">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Producción Total</span>
                                    <span className="text-xs font-bold text-blue-700 leading-none">{totalYieldNum.toLocaleString()} kg</span>
                                </div>
                                <div className="w-px h-6 bg-blue-200 mx-1"></div>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-blue-400 uppercase tracking-tighter">Rinde Estimado</span>
                                    <span className="text-xs font-bold text-blue-700 leading-none">{lot?.hectares ? Math.round(totalYieldNum / lot.hectares) : 'N/A'} kg/ha</span>
                                </div>
                            </div>
                        )}

                        {step === 3 && !selectedHarvestCampaignId && (
                            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-3">
                                Falta asignar campaña, no se cuentan los cupos asignados
                            </span>
                        )}

                        <div className="flex items-center gap-3 ml-auto">
                            <button
                                type="button"
                                onClick={() => {
                                    if (step > 1) {
                                        setStep((step - 1) as 1 | 2 | 3);
                                    } else {
                                        onCancel();
                                    }
                                }}
                                className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors border ${step > 1 ? 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50' : 'bg-transparent text-slate-500 border-transparent hover:bg-white hover:border-slate-200'}`}
                            >
                                {step > 1 ? '← Atrás' : 'Cancelar'}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (step === 1) {
                                        setStep(2);
                                    } else if (step === 2) {
                                        if (totalYieldNum === 0) return alert('El peso neto de camiones es 0. Cargue algún camión antes de continuar.');
                                        syncMarksToDistributions();
                                        setStep(3);
                                    } else if (step === 3) {
                                        if (availableYield > 5) {
                                             if (!confirm(`Quedan ${availableYield} kg por asignar. Se enviarán al galpón por defecto. ¿Continuar?`)) return;
                                        }
                                        setStep(4);
                                    } else {
                                        if (!isExecutingPlan) {
                                            handleFinalSubmit();
                                        } else if (!isConfirming) {
                                            setIsConfirming(true);
                                            setTimeout(() => setIsConfirming(false), 3000);
                                        } else {
                                            handleFinalSubmit();
                                        }
                                    }
                                }}
                                className={`px-6 py-2 rounded-lg text-white text-xs font-bold uppercase tracking-wider shadow-sm transition-all ${isConfirming && step === 4 ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {step < 4 ? 'Siguiente →' : isConfirming ? '¿Confirmar Cosecha?' : (isExecutingPlan ? 'Confirmar Cosecha' : 'Confirmar Cambios')}
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            {/* Step 2: Floating Navigation Buttons (formerly Step 3) */}
            {step === 2 && (
                <div className="flex justify-center gap-4 mt-6">
                    <button
                        type="button"
                        onClick={() => setActiveSheetIndex(prev => Math.max(0, prev - 1))}
                        disabled={activeSheetIndex <= 0}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg transition-colors"
                        title="Ficha anterior"
                    >
                        ‹
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSheetIndex(prev => Math.min(transportSheets.length - 1, prev + 1))}
                        disabled={activeSheetIndex >= transportSheets.length - 1}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-2xl shadow-lg transition-colors"
                        title="Ficha siguiente"
                    >
                        ›
                    </button>
                    <button
                        type="button"
                        onClick={handleAddSheet}
                        className="bg-blue-600 hover:bg-blue-700 text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-3xl shadow-lg transition-colors"
                        title="Agregar ficha"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteSheet}
                        disabled={transportSheets.length <= 1}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white w-14 h-14 rounded-xl flex items-center justify-center font-bold text-3xl shadow-lg transition-colors"
                        title="Eliminar ficha actual"
                    >
                        −
                    </button>
                </div>
            )}
        </>
    );
};
