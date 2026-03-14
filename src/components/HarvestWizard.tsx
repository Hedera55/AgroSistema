import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Warehouse, Campaign, Lot, Farm, InventoryMovement } from '@/types';
import { InvestorSelector } from '@/components/InvestorSelector';

interface HarvestData {
    date: string;
    contractor: string;
    campaignId: string;
    laborPricePerHa: number;
    investor?: string;
    investors?: Array<{ name: string; percentage: number }>;
    harvestType: 'SEMILLA' | 'GRANO';
    totalYield: number;
    distributions: Array<{
        id: string; // unique frontend UI id
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: any;
    }>;
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
    onCancel: () => void;
    onComplete: (data: HarvestData) => void;
    initialDate: string;
    initialContractor: string;
    initialLaborPrice: string;
    initialYield: string;
    isExecutingPlan: boolean;
    initialDistributions?: any[];
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
    initialDistributions
}) => {
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Step 1 State
    const [harvestDate, setHarvestDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
    const [harvestContractor, setHarvestContractor] = useState(initialContractor || '');
    const [selectedHarvestCampaignId, setSelectedHarvestCampaignId] = useState(initialDistributions?.[0]?.logistics?.campaignId || '');
    const [observedYield, setObservedYield] = useState(initialYield || '');
    const [harvestLaborPrice, setHarvestLaborPrice] = useState(initialLaborPrice || '');
    const [selectedHarvestInvestors, setSelectedHarvestInvestors] = useState<Array<{ name: string; percentage: number }>>(
        initialDistributions?.[0]?.logistics?.investors || (initialDistributions?.[0]?.logistics?.investorName ? [{ name: initialDistributions[0].logistics.investorName, percentage: 100 }] : [])
    );
    const [harvestType, setHarvestType] = useState<'SEMILLA' | 'GRANO'>(initialDistributions?.[0]?.logistics?.type === 'GRANO' ? 'GRANO' : 'GRANO'); // Default to Grano, will refine mapping if needed 

    // Step 2 State
    const [distributions, setDistributions] = useState<Array<{
        id: string;
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: any;
    }>>(initialDistributions || []);
    const [selectedDistribOption, setSelectedDistribOption] = useState('');

    // Step 3 State
    const [activeTabId, setActiveTabId] = useState('general');
    const [generalLogistics, setGeneralLogistics] = useState<any>({});

    const totalYieldNum = parseFloat(observedYield) || 0;
    const assignedYield = distributions.reduce((sum, d) => sum + d.amount, 0);
    const availableYield = totalYieldNum - assignedYield;

    // --- Helper for Quota Logic ---
    const getPartnerQuotaInfo = (partnerName: string) => {
        if (!selectedHarvestCampaignId) return null;

        const investor = investors.find(i => i.name === partnerName);
        if (!investor) return null;

        // 1. Total Harvested in this campaign so far (excluding current yield being entered)
        // Note: m.referenceId !== lot.id is used to exclude the current lot's PREVIOUS harvest (if editing)
        // or we just look for all HARVEST movements in this campaign.
        // Actually, let's keep it simple: Total Campaign Yield = previously recorded + current yield
        const previousHarvested = movements
            .filter(m => m.campaignId === selectedHarvestCampaignId && m.type === 'HARVEST' && m.referenceId !== lot.id)
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        const totalCampaignYield = previousHarvested + totalYieldNum;

        // 2. Already Retired by this partner in this campaign
        // We look for:
        // - HARVEST movements directly to partner (receiverName)
        // - OUT movements to partner (receiverName)
        // We EXCLUDE movements linked to the current lot (m.referenceId !== lot.id) to calculate "previously taken"
        const previousRetired = movements
            .filter(m =>
                m.campaignId === selectedHarvestCampaignId &&
                m.receiverName === partnerName &&
                (m.type === 'HARVEST' || m.type === 'OUT') &&
                m.referenceId !== lot.id
            )
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        const maxAllotment = totalCampaignYield * (investor.percentage / 100);
        const remaining = maxAllotment - previousRetired;

        return {
            percentage: investor.percentage,
            remaining: Math.max(0, remaining),
            totalAllotment: maxAllotment,
            previousRetired
        };
    };

    const currentCampaign = campaigns.find(c => c.id === selectedHarvestCampaignId);

    const allDestinations = useMemo(() => {
        const options: Array<{ label: string; value: string; disabled?: boolean; type?: 'WAREHOUSE' | 'PARTNER'; name?: string }> = [];
        options.push({ label: '--- Galpones ---', disabled: true, value: 'galpon_header' });
        warehouses.forEach(w => options.push({ label: w.name, value: `W_${w.id}`, type: 'WAREHOUSE' as const, name: w.name }));

        // 🟢 RESTRICTION: Hide partners if campaign is MONEY mode
        if (currentCampaign?.mode !== 'MONEY') {
            options.push({ label: '--- Socios ---', disabled: true, value: 'socio_header' });
            const allPartners = [...(partners || []), ...(investors || [])];
            allPartners.forEach((p: any) => {
                let name = '';
                if (typeof p === 'string') {
                    if (p.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(p);
                            name = parsed.name || p;
                        } catch (e) {
                            name = p;
                        }
                    } else {
                        name = p;
                    }
                } else {
                    name = p?.name || '';
                }
                if (!name) return;
                options.push({ label: name, value: `P_${name}`, type: 'PARTNER' as const, name: name });
            });
        }
        return options;
    }, [warehouses, partners, investors, currentCampaign]);

    const handleAddDistribution = () => {
        if (!selectedDistribOption) return;
        if (availableYield <= 0) {
            alert('No hay más kilogramos disponibles para asignar.');
            return;
        }

        const option = allDestinations.find(o => o.value === selectedDistribOption);
        if (!option || option.disabled) return;

        const newId = `dist_${Date.now()}`;
        const type = option.type as 'WAREHOUSE' | 'PARTNER';

        let amount = availableYield;
        if (type === 'PARTNER') {
            const info = getPartnerQuotaInfo(option.name as string);
            if (info) {
                amount = Math.min(availableYield, info.remaining);
            }
        }

        setDistributions(prev => [...prev, {
            id: newId,
            type: type,
            targetId: type === 'WAREHOUSE' ? (option.value as string).replace('W_', '') : (option.value as string).replace('P_', ''),
            targetName: option.name as string,
            amount: amount,
            logistics: {} // gets populated via general defaults on save or overrides
        }]);
        setSelectedDistribOption('');
    };

    const handleUpdateDistributionAmount = (id: string, newAmount: number) => {
        const dist = distributions.find(d => d.id === id);
        if (dist?.type === 'PARTNER') {
            const info = getPartnerQuotaInfo(dist.targetName);
            if (info && newAmount > info.remaining + 0.1) { // 0.1 margin for float
                if (!confirm(`⚠️ El monto asignado (${newAmount.toLocaleString()} kg) supera el cupo restante del socio (${info.remaining.toLocaleString()} kg, Cuota: ${info.percentage}%).\n\n¿Desea forzar esta cantidad?`)) {
                    return;
                }
            }
        }

        setDistributions(prev => prev.map(d => {
            if (d.id === id) {
                return { ...d, amount: newAmount };
            }
            return d;
        }));
    };

    const handleUpdateDistributionAmountString = (id: string, val: string) => {
        const normalized = val.replace(',', '.');
        const num = parseFloat(normalized) || 0;
        handleUpdateDistributionAmount(id, num);
    };

    const handleDeleteDistribution = (id: string) => {
        setDistributions(prev => prev.filter(d => d.id !== id));
        if (activeTabId === id) setActiveTabId('general');
    };

    const updateLogistics = (distId: string, field: keyof InventoryMovement, value: any) => {
        if (distId === 'general') {
            setGeneralLogistics((prev: any) => ({ ...prev, [field]: value }));
        } else {
            setDistributions((prev: any[]) => prev.map(d => {
                if (d.id === distId) {
                    return { ...d, logistics: { ...d.logistics, [field]: value } };
                }
                return d;
            }));
        }
    };

    const getLogisticsValue = (distId: string, field: keyof InventoryMovement): string | number => {
        if (distId === 'general') {
            // Include farm defaults if not set in general
            if (field === 'originAddress' && (generalLogistics[field] === undefined || generalLogistics[field] === '')) return farm?.address || '';
            if (field === 'departureDateTime' && (generalLogistics[field] === undefined || generalLogistics[field] === '')) return harvestDate;
            const val = generalLogistics[field];
            if (typeof val === 'string' || typeof val === 'number') return val;
            return '';
        }
        const dist = distributions.find(d => d.id === distId);
        if (!dist) return '';
        // If dist has the field explicitly set, use it. Otherwise fall back to general.
        const distVal = dist.logistics[field];
        if (distVal !== undefined && distVal !== '') {
            if (typeof distVal === 'string' || typeof distVal === 'number') return distVal;
        }

        const genVal = generalLogistics[field];
        if (genVal !== undefined && genVal !== '') {
            if (typeof genVal === 'string' || typeof genVal === 'number') return genVal;
        }

        // Farm Fallbacks
        if (field === 'originAddress') return farm?.address || '';
        if (field === 'departureDateTime') return harvestDate;

        return '';
    };

    const handleFinalSubmit = () => {
        if (distributions.length === 0 && totalYieldNum > 0) {
            alert('Debe asignar al menos un destino para el grano (Depósito o Socio).');
            return;
        }
        if (assignedYield > totalYieldNum + 1) { // 1kg margin
            alert('Ha asignado más kilos de los cosechados.');
            return;
        }

        // Apply general logistics as fallbacks to all distributions
        const finalDistributions = distributions.map(d => {
            const finalLogistics: Partial<InventoryMovement> = { ...d.logistics };
            const fields: (keyof InventoryMovement)[] = [
                'originAddress', 'primarySaleCuit', 'destinationCompany', 'destinationAddress',
                'departureDateTime', 'distanceKm', 'freightTariff', 'trailerPlate',
                'humidity', 'dischargeNumber', 'transportCompany', 'hectoliterWeight',
                'grossWeight', 'tareWeight'
            ];

            fields.forEach(f => {
                if (finalLogistics[f] === undefined) {
                    if (generalLogistics[f] !== undefined) {
                        (finalLogistics as any)[f] = generalLogistics[f];
                    } else if (f === 'originAddress' && farm?.address) {
                        (finalLogistics as any)[f] = farm.address;
                    } else if (f === 'departureDateTime' && harvestDate) {
                        (finalLogistics as any)[f] = harvestDate;
                    }
                }
            });

            return { ...d, logistics: finalLogistics };
        });

        onComplete({
            date: harvestDate,
            contractor: harvestContractor,
            campaignId: selectedHarvestCampaignId,
            laborPricePerHa: parseFloat(harvestLaborPrice) || 0,
            investor: selectedHarvestInvestors.length > 0 ? selectedHarvestInvestors[0].name : '',
            investors: selectedHarvestInvestors,
            harvestType,
            totalYield: totalYieldNum,
            distributions: finalDistributions
        });
    };

    return (
        <div className="mt-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100 shadow-sm animate-fadeIn cursor-default overflow-visible" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4 border-b border-blue-100 pb-2">
                <h4 className="text-sm font-black text-blue-800 uppercase tracking-wide flex items-center gap-2">
                    {isExecutingPlan ? 'Registrar Cosecha' : 'Editar Cosecha'} <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">Paso {step} de 3</span>
                </h4>
            </div>

            {/* STEP 1: YIELD EXCEPTS */}
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
                            label="PRODUCCIÓN TOTAL (kg)"
                            type="text"
                            inputMode="decimal"
                            placeholder="Ej. 65000"
                            value={observedYield}
                            onChange={e => setObservedYield(e.target.value.replace(',', '.'))}
                            className="bg-white border-blue-300 focus:ring-blue-500"
                            labelClassName="block text-[10px] uppercase font-bold text-blue-600 mb-1"
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
                        {totalYieldNum > 0 && (
                            <div className="flex items-end pb-2">
                                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-100 px-2 py-1 rounded">
                                    Rinde Estimado: {lot?.hectares ? Math.round(totalYieldNum / lot.hectares) : 'N/A'} kg/ha
                                </span>
                            </div>
                        )}
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
                            onChange={e => setHarvestLaborPrice(e.target.value.replace(',', '.'))}
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

            {/* STEP 2: DISTRIBUTION */}
            {step === 2 && (
                <div className="space-y-4 animate-fadeIn">
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-2">
                            <h3 className="font-bold text-slate-800 text-sm">Distribución de Granos</h3>
                            <div className={`text-xs font-black uppercase px-2 py-1 rounded ${availableYield < 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                {assignedYield} / {totalYieldNum} kg asignados
                            </div>
                        </div>

                        {availableYield > 0 && (
                            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                                <span className="text-amber-600 text-sm">⚠️</span>
                                <p className="text-xs font-bold text-blue-800 uppercase leading-none mb-1">
                                    Falta asignar cosecha: el remanente ({totalYieldNum - assignedYield} kg) se enviará al galpón por default para cosechas
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 items-end mb-6">
                            <div className="flex-1">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Agregar Destino</label>
                                <select
                                    className="w-full px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                    value={selectedDistribOption}
                                    onChange={e => setSelectedDistribOption(e.target.value)}
                                >
                                    <option value="">Seleccionar destino...</option>
                                    {allDestinations.map((opt, i) => (
                                        <option key={i} value={opt.value} disabled={opt.disabled} className={opt.disabled ? 'font-bold bg-slate-50' : ''}>
                                            {opt.label?.replace(/🌍 |🏢 |👤 /g, '') || 'Sin nombre'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddDistribution}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm transition-colors"
                            >
                                +
                            </button>
                        </div>

                        <div className="space-y-2">
                            {distributions.length === 0 ? (
                                <p className="text-center text-xs text-slate-400 py-4 italic">No hay destinos agregados. Agregue galpones o socios arriba.</p>
                            ) : (
                                distributions.map(dist => (
                                    <div key={dist.id} className="flex items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                        <div className="flex-1 flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{dist.targetName}</span>
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                                {dist.type === 'WAREHOUSE' ? 'Galpón' : 'Socio'}
                                                {dist.type === 'PARTNER' && (() => {
                                                    const info = getPartnerQuotaInfo(dist.targetName);
                                                    return info ? ` • Cupo: ${Math.round(info.remaining).toLocaleString()} kg (${info.percentage}%)` : '';
                                                })()}
                                            </span>
                                        </div>
                                        <div className="w-32">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={dist.amount || ''}
                                                    onChange={e => handleUpdateDistributionAmountString(dist.id, e.target.value)}
                                                    className="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded text-right pr-6 font-bold text-blue-600"
                                                    placeholder="0"
                                                />
                                                <span className="absolute right-2 top-1.5 text-xs text-slate-400 font-bold">kg</span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteDistribution(dist.id)}
                                            className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* STEP 3: LOGISTICS */}
            {step === 3 && (
                <div className="space-y-4 animate-fadeIn relative z-40">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                        {/* Selector de Destino */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0 z-30">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Detalles de Destino</label>
                            <select
                                className="w-full px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none"
                                value={activeTabId}
                                onChange={e => setActiveTabId(e.target.value)}
                            >
                                <option value="general">GENERAL (Aplica a todos)</option>
                                <option disabled>──────────</option>
                                {distributions.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.targetName} ({d.amount}kg)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Campos de Logística */}
                        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-white rounded-b-xl max-h-[40vh] overflow-y-auto">
                            <Input
                                label="Dirección / Origen"
                                placeholder="Ruta, Localidad..."
                                value={getLogisticsValue(activeTabId, 'originAddress')}
                                onChange={e => updateLogistics(activeTabId, 'originAddress', e.target.value)}
                            />
                            <Input
                                label="CUIT Corredor / Venta Primaria"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'primarySaleCuit')}
                                onChange={e => updateLogistics(activeTabId, 'primarySaleCuit', e.target.value)}
                            />
                            <Input
                                label="Empresa Transporte"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'transportCompany')}
                                onChange={e => updateLogistics(activeTabId, 'transportCompany', e.target.value)}
                            />
                            <Input
                                label="Patente Camión"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'plateNumber')}
                                onChange={e => updateLogistics(activeTabId, 'plateNumber', e.target.value)}
                            />
                            <Input
                                label="Patente Acoplado"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'trailerPlate')}
                                onChange={e => updateLogistics(activeTabId, 'trailerPlate', e.target.value)}
                            />
                            <Input
                                label="Chofer"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'truckDriver')}
                                onChange={e => updateLogistics(activeTabId, 'truckDriver', e.target.value)}
                            />
                            <Input
                                label="Humedad (%)"
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'humidity')}
                                onChange={e => updateLogistics(activeTabId, 'humidity', e.target.value.replace(',', '.'))}
                            />
                            <Input
                                label="Nro de Descarga"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'dischargeNumber')}
                                onChange={e => updateLogistics(activeTabId, 'dischargeNumber', e.target.value)}
                            />
                            <Input
                                label="Peso Hectolítrico"
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'hectoliterWeight')}
                                onChange={e => updateLogistics(activeTabId, 'hectoliterWeight', e.target.value.replace(',', '.'))}
                            />
                            <Input
                                label="Peso Bruto (kg)"
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'grossWeight')}
                                onChange={e => updateLogistics(activeTabId, 'grossWeight', e.target.value.replace(',', '.'))}
                            />
                            <Input
                                label="Peso Tara (kg)"
                                type="text"
                                inputMode="decimal"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'tareWeight')}
                                onChange={e => updateLogistics(activeTabId, 'tareWeight', e.target.value.replace(',', '.'))}
                            />
                            <Input
                                label="Empresa de Destino"
                                placeholder="Planta / Acopio..."
                                value={getLogisticsValue(activeTabId, 'destinationCompany')}
                                onChange={e => updateLogistics(activeTabId, 'destinationCompany', e.target.value)}
                            />
                            <Input
                                label="Dirección / Localidad Destino"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'destinationAddress')}
                                onChange={e => updateLogistics(activeTabId, 'destinationAddress', e.target.value)}
                            />
                            <Input
                                label="Fecha y Horario Partida"
                                type="datetime-local"
                                value={getLogisticsValue(activeTabId, 'departureDateTime')}
                                onChange={e => updateLogistics(activeTabId, 'departureDateTime', e.target.value.replace('T', ' '))}
                            />
                            <Input
                                label="Km a recorrer"
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'distanceKm')}
                                onChange={e => updateLogistics(activeTabId, 'distanceKm', parseFloat(e.target.value))}
                            />
                            <Input
                                label="Tarifa Flete (USD)"
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'freightTariff')}
                                onChange={e => updateLogistics(activeTabId, 'freightTariff', parseFloat(e.target.value))}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Footer Navigation */}
            <div className={`flex items-center mt-6 pt-3 border-t border-blue-100 ${step > 1 ? 'justify-between' : 'justify-end'}`}>
                <button
                    type="button"
                    onClick={() => {
                        if (step > 1) {
                            setStep(step - 1 as 1 | 2);
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
                            if (!observedYield || parseFloat(observedYield) <= 0) return alert('Ingrese la producción total');
                            setStep(2);
                        } else if (step === 2) {
                            setStep(3);
                        } else {
                            handleFinalSubmit();
                        }
                    }}
                    className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-xs font-bold uppercase tracking-wider shadow-sm transition-all"
                >
                    {step < 3 ? 'Siguiente →' : isExecutingPlan ? 'Confirmar Cosecha' : 'Confirmar Cambios'}
                </button>
            </div>
        </div>
    );
};
