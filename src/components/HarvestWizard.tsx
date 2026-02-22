import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/Input';
import { Warehouse, Campaign, Lot, Farm, InventoryMovement } from '@/types';

interface HarvestData {
    date: string;
    contractor: string;
    campaignId: string;
    laborPricePerHa: number;
    investor: string;
    harvestType: 'SEMILLA' | 'GRANO';
    totalYield: number;
    distributions: Array<{
        id: string; // unique frontend UI id
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: Partial<InventoryMovement>;
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
    const [selectedHarvestInvestor, setSelectedHarvestInvestor] = useState(initialDistributions?.[0]?.logistics?.investorName || '');
    const [harvestType, setHarvestType] = useState<'SEMILLA' | 'GRANO'>(initialDistributions?.[0]?.logistics?.type === 'SEMILLA' ? 'SEMILLA' : 'GRANO');

    // Step 2 State
    const [distributions, setDistributions] = useState<Array<{
        id: string;
        type: 'WAREHOUSE' | 'PARTNER';
        targetId: string;
        targetName: string;
        amount: number;
        logistics: Partial<InventoryMovement>;
    }>>(initialDistributions || []);
    const [selectedDistribOption, setSelectedDistribOption] = useState('');

    // Step 3 State
    const [activeTabId, setActiveTabId] = useState('general');
    const [generalLogistics, setGeneralLogistics] = useState<Partial<InventoryMovement>>({});

    const totalYieldNum = parseFloat(observedYield) || 0;
    const assignedYield = distributions.reduce((sum, d) => sum + d.amount, 0);
    const availableYield = totalYieldNum - assignedYield;

    const allDestinations = useMemo(() => {
        const options: Array<{ label: string; value: string; disabled?: boolean; type?: 'WAREHOUSE' | 'PARTNER'; name?: string }> = [];
        options.push({ label: '--- Galpones ---', disabled: true, value: 'galpon_header' });
        warehouses.forEach(w => options.push({ label: w.name, value: `W_${w.id}`, type: 'WAREHOUSE' as const, name: w.name }));
        options.push({ label: '--- Socios ---', disabled: true, value: 'socio_header' });
        const allPartners = [...(partners || []), ...(investors || [])];
        allPartners.forEach(p => options.push({ label: p.name, value: `P_${p.name}`, type: 'PARTNER' as const, name: p.name }));
        return options;
    }, [warehouses, partners, investors]);

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
        setDistributions(prev => [...prev, {
            id: newId,
            type: type,
            targetId: type === 'WAREHOUSE' ? (option.value as string).replace('W_', '') : (option.value as string).replace('P_', ''),
            targetName: option.name as string,
            amount: availableYield, // default to remaining
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

    const handleDeleteDistribution = (id: string) => {
        setDistributions(prev => prev.filter(d => d.id !== id));
        if (activeTabId === id) setActiveTabId('general');
    };

    const updateLogistics = (distId: string, field: keyof InventoryMovement, value: any) => {
        if (distId === 'general') {
            setGeneralLogistics(prev => ({ ...prev, [field]: value }));
        } else {
            setDistributions(prev => prev.map(d => {
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
            if (field === 'originAddress' && (generalLogistics[field] === undefined || generalLogistics[field] === '')) return farm.address || '';
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
        if (field === 'originAddress') return farm.address || '';
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
                    } else if (f === 'originAddress' && farm.address) {
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
            investor: selectedHarvestInvestor,
            harvestType,
            totalYield: totalYieldNum,
            distributions: finalDistributions
        });
    };

    return (
        <div className="mt-3 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-slideUp cursor-default border-t-4 border-t-emerald-500" onClick={e => e.stopPropagation()}>
            <div className="bg-slate-50 px-8 py-4 border-b border-slate-200 flex justify-between items-center">
                <div>
                    <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                        Paso {step} de 3
                    </span>
                    <h3 className="font-bold text-slate-800 text-lg mt-1">
                        {isExecutingPlan ? 'Registrar Cosecha' : 'Editar Cosecha'}
                    </h3>
                </div>
                <button type="button" onClick={onCancel} className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-400">
                    ✕
                </button>
            </div>

            {/* STEP 1: YIELD EXCEPTS */}
            {step === 1 && (
                <div className="p-8 space-y-6 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha (DD/MM/YYYY)</label>
                            <input
                                type="date"
                                value={harvestDate}
                                onChange={e => setHarvestDate(e.target.value)}
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Campaña</label>
                            <select
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                value={selectedHarvestCampaignId}
                                onChange={e => setSelectedHarvestCampaignId(e.target.value)}
                            >
                                <option value="">Seleccionar...</option>
                                {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-emerald-600 uppercase">PRODUCCIÓN TOTAL (kg)</label>
                            <input
                                type="number"
                                placeholder="Ej. 65000"
                                value={observedYield}
                                onChange={e => setObservedYield(e.target.value)}
                                className="w-full mt-1 border border-emerald-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                            />
                            {totalYieldNum > 0 && (
                                <div className="mt-2">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded">
                                        Rinde Estimado: {Math.round(totalYieldNum / lot.hectares)} kg/ha
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de Cosecha</label>
                            <select
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                value={harvestType}
                                onChange={e => setHarvestType(e.target.value as 'SEMILLA' | 'GRANO')}
                            >
                                <option value="GRANO">Grano</option>
                                <option value="SEMILLA">Semilla</option>
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Contratista (Opcional)</label>
                            <select
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                value={harvestContractor}
                                onChange={e => setHarvestContractor(e.target.value)}
                            >
                                <option value="">Ninguno...</option>
                                {contractors.map(c => <option key={c.id} value={c.username}>{c.username}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Precio Labor (USD/ha) (Opcional)</label>
                            <input
                                type="number"
                                value={harvestLaborPrice}
                                onChange={e => setHarvestLaborPrice(e.target.value)}
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700"
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Labor Pagada Por (Opcional)</label>
                            <select
                                className="w-full mt-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                                value={selectedHarvestInvestor}
                                onChange={e => setSelectedHarvestInvestor(e.target.value)}
                            >
                                <option value="">Seleccionar...</option>
                                {partners?.map((p: any) => <option key={p.name} value={p.name}>{p.name}</option>)}
                                {(!partners || partners.length === 0) && investors?.map((inv: any) => <option key={inv.name} value={inv.name}>{inv.name}</option>)}
                            </select>
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
                            <div className={`text-xs font-black uppercase px-2 py-1 rounded ${availableYield < 0 ? 'bg-red-100 text-red-700' : availableYield === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                {assignedYield} / {totalYieldNum} kg asignados
                            </div>
                        </div>

                        {availableYield > 0 && (
                            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 animate-fadeIn">
                                <span className="text-amber-600 text-sm">⚠️</span>
                                <p className="text-[10px] text-amber-800 font-bold uppercase leading-tight">
                                    Falta asignar cosecha: el remanente ({availableYield} kg) se enviará al galpón por default.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-2 items-end mb-6">
                            <div className="flex-1">
                                <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Agregar Destino</label>
                                <select
                                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                    value={selectedDistribOption}
                                    onChange={e => setSelectedDistribOption(e.target.value)}
                                >
                                    <option value="">Seleccionar destino...</option>
                                    {allDestinations.map((opt, i) => (
                                        <option key={i} value={opt.value} disabled={opt.disabled} className={opt.disabled ? 'font-bold bg-slate-50' : ''}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddDistribution}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white w-9 h-9 rounded-lg flex items-center justify-center font-bold text-lg shadow-sm transition-colors"
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
                                            </span>
                                        </div>
                                        <div className="w-32">
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={dist.amount || ''}
                                                    onChange={e => handleUpdateDistributionAmount(dist.id, parseFloat(e.target.value) || 0)}
                                                    className="w-full px-2 py-1 text-sm bg-white border border-slate-200 rounded text-right pr-6"
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
                    <p className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200 shadow-sm leading-tight">
                        <strong>Opcional:</strong> Ingrese los datos de logística y transporte. Los datos ingresados en <span className="text-blue-600 font-bold">"General"</span> se copiarán automáticamente a los demás destinos salvo que tengan los suyos propios.
                    </p>

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-visible">
                        {/* Selector de Destino */}
                        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 rounded-t-xl sticky top-0 z-30">
                            <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Destino a Editar</label>
                            <select
                                className="w-full px-3 py-2 text-sm font-bold rounded-lg border border-slate-200 bg-white text-slate-800 shadow-sm"
                                value={activeTabId}
                                onChange={e => setActiveTabId(e.target.value)}
                            >
                                <option value="general">🌍 GENERAL (Aplica a todos)</option>
                                <option disabled>──────────</option>
                                {distributions.map(d => (
                                    <option key={d.id} value={d.id}>
                                        {d.type === 'WAREHOUSE' ? '🏢' : '👤'} {d.targetName} ({d.amount}kg)
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
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'humidity')}
                                onChange={e => updateLogistics(activeTabId, 'humidity', parseFloat(e.target.value))}
                            />
                            <Input
                                label="Nro de Descarga"
                                placeholder="..."
                                value={getLogisticsValue(activeTabId, 'dischargeNumber')}
                                onChange={e => updateLogistics(activeTabId, 'dischargeNumber', e.target.value)}
                            />
                            <Input
                                label="Peso Hectolítrico"
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'hectoliterWeight')}
                                onChange={e => updateLogistics(activeTabId, 'hectoliterWeight', parseFloat(e.target.value))}
                            />
                            <Input
                                label="Peso Bruto (kg)"
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'grossWeight')}
                                onChange={e => updateLogistics(activeTabId, 'grossWeight', parseFloat(e.target.value))}
                            />
                            <Input
                                label="Peso Tara (kg)"
                                type="number"
                                placeholder="0"
                                value={getLogisticsValue(activeTabId, 'tareWeight')}
                                onChange={e => updateLogistics(activeTabId, 'tareWeight', parseFloat(e.target.value))}
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
                                label="Tarifa Flete ($)"
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
