import { useState, useMemo, memo } from 'react';
import { ClientStock, Warehouse } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface StockMovementPanelProps {
    selectedIds: string[];
    stockItems: any[]; // enriched items
    warehouses: Warehouse[]; // for transfer destination
    activeWarehouseIds: string[];
    investors?: { name: string; percentage?: number }[];
    campaignShares?: Record<string, Record<string, number>>;
    campaigns?: any[];
    movements?: any[];
    onConfirm: (action: 'WITHDRAW' | 'TRANSFER', quantities: Record<string, number>, destinationWarehouseId?: string, note?: string, receiverName?: string, logistics?: any, remitoFile?: File | null) => Promise<void>;
    onCancel: () => void;
    isSaleActive?: boolean;
}

function StockMovementPanelInternal({
    selectedIds,
    stockItems,
    warehouses,
    activeWarehouseIds,
    onConfirm,
    onCancel,
    investors = [],
    campaignShares = {},
    campaigns = [],
    movements = [],
    isSaleActive = false
}: StockMovementPanelProps) {
    const [action, setAction] = useState<'WITHDRAW' | 'TRANSFER'>('WITHDRAW');
    const [destinationId, setDestinationId] = useState('');
    const [receiverName, setReceiverName] = useState('');
    const [note, setNote] = useState('');
    const [showNote, setShowNote] = useState(false);
    const [loading, setLoading] = useState(false);
    const [remitoFile, setRemitoFile] = useState<File | null>(null);

    // Logistics fields for WITHDRAW
    const [truckDriver, setTruckDriver] = useState('');
    const [plateNumber, setPlateNumber] = useState('');
    const [trailerPlate, setTrailerPlate] = useState('');
    const [destinationCompany, setDestinationCompany] = useState('');
    const [destinationAddress, setDestinationAddress] = useState('');
    const [transportCompany, setTransportCompany] = useState('');
    const [dischargeNumber, setDischargeNumber] = useState('');
    const [humidity, setHumidity] = useState('');
    const [hectoliterWeight, setHectoliterWeight] = useState('');
    const [grossWeight, setGrossWeight] = useState('');
    const [tareWeight, setTareWeight] = useState('');
    const [primarySaleCuit, setPrimarySaleCuit] = useState('');
    const [departureDateTime, setDepartureDateTime] = useState('');
    const [distanceKm, setDistanceKm] = useState('');
    const [freightTariff, setFreightTariff] = useState('');

    // Track which product groups (selected items) are expanded
    const [expandedIds, setExpandedIds] = useState<string[]>([]);

    // Track quantities for specific stock IDs within each presentation
    // Key: Specific Stock ID (from item.breakdown), Value: Selected units (multiplier) or absolute quantity
    const [subQuantities, setSubQuantities] = useState<Record<string, number>>({});

    const destinationOptions = useMemo(() => [
        <option key="default-destination" value="">Seleccione galpón de destino...</option>,
        ...warehouses.filter((w: Warehouse) => !activeWarehouseIds.includes(w.id)).map(w => (
            <option key={`destination-${w.id}`} value={w.id}>{w.name}</option>
        ))
    ], [warehouses, activeWarehouseIds]);

    const receiverOptions = useMemo(() => [
        <option key="default-receiver" value="">Seleccione...</option>,
        ...investors.map((inv) => (
            <option key={`receiver-${inv.name}`} value={inv.name}>{inv.name}</option>
        ))
    ], [investors]);

    // Filter active items from grouped stock
    const selectedItems = useMemo(() => {
        return stockItems.filter((item: any) => selectedIds.includes(item.id));
    }, [stockItems, selectedIds]);

    // Initialize subQuantities on mount/change
    useMemo(() => {
        const initialSub: Record<string, number> = { ...subQuantities };
        let updated = false;

        selectedItems.forEach((item: any) => {
            if (item.breakdown) {
                item.breakdown.forEach((b: any) => {
                    if (initialSub[b.id] === undefined) {
                        initialSub[b.id] = 0;
                        updated = true;
                    }
                });
            } else if (initialSub[item.id] === undefined) {
                initialSub[item.id] = 0;
                updated = true;
            }
        });

        if (updated) {
            setSubQuantities(initialSub);
        }
    }, [selectedItems]);

    // Calculate the absolute quantity for a specific stock item
    const getAbsoluteQty = (stockId: string, item: any) => {
        const multiplier = subQuantities[stockId] || 0;

        // Find if this stockId is in breakdown
        const bItem = item.breakdown?.find((b: any) => b.id === stockId);
        const content = bItem?.presentationContent || item.presentationContent || 0;

        if (content > 0) {
            return multiplier * content;
        }
        return multiplier; // For bulk or generic stock, input is absolute
    };

    // Calculate the total quantity for a product group based on selected sub-quantities
    const getGroupTotal = (item: any) => {
        if (item.breakdown) {
            return item.breakdown.reduce((acc: number, b: any) => acc + getAbsoluteQty(b.id, item), 0);
        }
        return getAbsoluteQty(item.id, item);
    };

    const handleSubQuantityChange = (id: string, val: string) => {
        let num = parseFloat(val.replace(',', '.')) || 0;
        if (num < 0) num = 0;
        setSubQuantities(prev => ({ ...prev, [id]: num }));
    };

    const toggleExpand = (id: string) => {
        setExpandedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    // --- Quota Logic ---
    const getPartnerQuotaInfo = (productId: string, campaignId?: string, partnerName?: string) => {
        if (!campaignId || !partnerName) return null;
        const campaign = campaigns.find(c => c.id === campaignId);
        if (campaign?.mode !== 'GRAIN' && campaign?.mode !== 'MIXED') return null;

        const percentage = campaignShares?.[campaignId]?.[partnerName] || 0;

        // Total Harvested
        const totalHarvested = movements
            .filter(m => m.productId === productId && m.campaignId === campaignId && m.type === 'HARVEST')
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        // Sales of Harvested grain (for MIXED mode)
        const totalSoldHarvest = (campaign.mode === 'MIXED') 
            ? movements
                .filter(m => m.productId === productId && m.campaignId === campaignId && m.type === 'SALE' && m.source === 'HARVEST')
                .reduce((acc, m) => acc + (m.quantity || 0), 0)
            : 0;

        // Already Withdrawn/Taken by this partner
        const alreadyWithdrawn = movements
            .filter(m =>
                m.productId === productId &&
                m.campaignId === campaignId &&
                (m.type === 'OUT' || m.type === 'HARVEST') &&
                m.receiverName === partnerName
            )
            .reduce((acc, m) => acc + (m.quantity || 0), 0);

        const netGrainPool = Math.max(0, totalHarvested - totalSoldHarvest);
        const quota = netGrainPool * (percentage / 100);
        const remaining = quota - alreadyWithdrawn;

        return { quota, remaining, percentage };
    };

    const handleSubmit = async () => {
        if (action === 'TRANSFER' && !destinationId) {
            alert('Seleccione un galpón de destino');
            return;
        }

        // Prepare the absolute quantities map to send to page.tsx
        const absoluteQuantities: Record<string, number> = {};
        let totalSelected = 0;
        let wouldGoNegative = false;

        selectedItems.forEach((item: any) => {
            if (item.breakdown) {
                item.breakdown.forEach((b: any) => {
                    const absQty = getAbsoluteQty(b.id, item);
                    if (absQty > 0) {
                        absoluteQuantities[b.id] = absQty;
                        totalSelected += absQty;
                        if (absQty > b.quantity) wouldGoNegative = true;
                    }
                });
            } else {
                const absQty = getAbsoluteQty(item.id, item);
                if (absQty > 0) {
                    absoluteQuantities[item.id] = absQty;
                    totalSelected += absQty;
                    if (absQty > item.quantity) wouldGoNegative = true;
                }
            }
        });

        if (totalSelected <= 0) {
            alert('Debe seleccionar al menos una cantidad de alguna presentación.');
            return;
        }

        // Inline warnings are shown to the user if wouldGoNegative or quota is exceeded.
        // We removed the native window.confirm() dialogs per user request.

        setLoading(true);
        try {
            const logisticsInfo = action === 'WITHDRAW' ? {
                truckDriver: truckDriver || undefined,
                plateNumber: plateNumber || undefined,
                trailerPlate: trailerPlate || undefined,
                destinationCompany: destinationCompany || undefined,
                destinationAddress: destinationAddress || undefined,
                transportCompany: transportCompany || undefined,
                dischargeNumber: dischargeNumber || undefined,
                humidity: humidity ? parseFloat(humidity.replace(',', '.')) : undefined,
                hectoliterWeight: hectoliterWeight ? parseFloat(hectoliterWeight.replace(',', '.')) : undefined,
                grossWeight: grossWeight ? parseFloat(grossWeight.replace(',', '.')) : undefined,
                tareWeight: tareWeight ? parseFloat(tareWeight.replace(',', '.')) : undefined,
                primarySaleCuit: primarySaleCuit || undefined,
                departureDateTime: departureDateTime || undefined,
                distanceKm: distanceKm ? parseFloat(distanceKm.replace(',', '.')) : undefined,
                freightTariff: freightTariff ? parseFloat(freightTariff.replace(',', '.')) : undefined,
            } : undefined;

            await onConfirm(action, absoluteQuantities, destinationId || undefined, note, receiverName, logisticsInfo, remitoFile);
        } catch (e) {
            console.error(e);
            alert('Error al procesar movimiento');
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className="bg-white border-indigo-100 shadow-lg p-4 rounded-xl animate-fadeIn mb-4 relative transition-all floating-panel">
            <button
                onClick={onCancel}
                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 z-10 transition-colors"
            >
                ✕
            </button>
            <h3 className="text-lg font-semibold text-slate-800 mb-6">
                Mover Stock Seleccionado ({selectedItems.length})
            </h3>

            <div className="flex gap-3 mb-4">
                <button
                    type="button"
                    onClick={() => setAction('WITHDRAW')}
                    className={`flex-1 py-2 rounded-lg border font-bold text-sm transition-all flex items-center justify-center gap-2 ${action === 'WITHDRAW'
                        ? '!bg-orange-50 !border-orange-200 !text-orange-700 !ring-2 !ring-orange-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"></line>
                        <polyline points="5 12 12 5 19 12"></polyline>
                    </svg>
                    Retirar Stock
                </button>
                <button
                    type="button"
                    onClick={() => setAction('TRANSFER')}
                    className={`flex-1 py-2 rounded-lg border font-bold text-sm transition-all ${action === 'TRANSFER'
                        ? 'text-orange-700 ring-2 ring-orange-100'
                        : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                        }`}
                    style={action === 'TRANSFER' ? { backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' } : {}}
                >
                    ⇆ Transferir a otro Galpón
                </button>
            </div>

            <div className="space-y-3 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedItems.map((item: any) => {
                    const isExpanded = expandedIds.includes(item.id);
                    const groupTotal = getGroupTotal(item);

                    return (
                        <div key={item.id} className="border border-slate-100 rounded-xl overflow-hidden bg-white shadow-sm">
                            {/* Header / Main Row */}
                            <div
                                onClick={() => toggleExpand(item.id)}
                                className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${isExpanded ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                            >
                                <div className="flex-1">
                                    <div className="font-black text-slate-800 text-sm uppercase flex items-center gap-2">
                                        {item.productName}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                        Stock Total: {item.quantity} {item.unit}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-400 uppercase mb-0.5">Total a Mover</div>
                                    <div className={`text-sm font-black ${groupTotal > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                                        {groupTotal.toLocaleString()} {item.unit}
                                    </div>
                                </div>
                            </div>

                            {/* Sub-rows Drawer */}
                            {isExpanded && (
                                <div className="px-3 pb-3 pt-1 bg-white border-t border-slate-50 animate-slideDown">
                                    {item.breakdown && item.breakdown.length > 0 ? (
                                        <div className="space-y-2">
                                            {item.breakdown.map((b: any, bIdx: number) => (
                                                <div key={b.id || bIdx} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 pl-4">
                                                    <div className="flex-1">
                                                        <div className="text-[11px] font-bold text-red-600 uppercase tracking-tighter">
                                                            {b.presentationLabel || 'A GRANEL'} {b.presentationContent ? b.presentationContent + item.unit : ''}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-bold">
                                                            Disp: {b.quantity} {item.unit}
                                                        </div>
                                                    </div>
                                                    <div className="w-24">
                                                        <Input
                                                            type="text"
                                                            placeholder="0"
                                                            value={subQuantities[b.id] || ''}
                                                            onChange={e => handleSubQuantityChange(b.id, e.target.value)}
                                                            className="h-8 text-right font-black text-sm pr-4 rounded-md !border-transparent !shadow-[inset_0_0_6px_rgba(0,0,0,0.25)]"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0 pl-4">
                                            <div className="flex-1">
                                                <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
                                                    Granel / Otros
                                                </div>
                                                <div className="text-[10px] text-slate-400 font-bold">
                                                    Disp: {item.quantity} {item.unit}
                                                </div>
                                            </div>
                                            <div className="w-24">
                                                <Input
                                                    type="text"
                                                    placeholder="0"
                                                    value={subQuantities[item.id] || ''}
                                                    onChange={e => handleSubQuantityChange(item.id, e.target.value)}
                                                    className="h-8 text-right font-black text-sm pr-4 rounded-md !border-transparent !shadow-[inset_0_0_6px_rgba(0,0,0,0.25)]"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {action === 'TRANSFER' && (
                <div className="mb-4 bg-slate-50 p-4 rounded-lg border border-slate-100 animate-fadeIn">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Galpón de Destino</label>
                    <select
                        className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm h-10"
                        value={destinationId}
                        onChange={e => setDestinationId(e.target.value)}
                    >
                        {destinationOptions}
                    </select>
                </div>
            )}

            {action === 'WITHDRAW' && (
                <div className="mb-4 bg-orange-50 p-4 rounded-lg border border-orange-100 animate-fadeIn">
                    <label className="block text-xs font-bold text-orange-800 uppercase mb-2">¿Quién retira?</label>
                    <select
                        className="block w-full rounded-lg border-orange-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 text-sm h-10 bg-white"
                        value={receiverName}
                        onChange={e => setReceiverName(e.target.value)}
                    >
                        {receiverOptions}
                    </select>

                    {receiverName && selectedItems.some(item => {
                        const campaign = campaigns.find(c => c.id === item.campaignId);
                        return campaign?.mode === 'GRAIN';
                    }) && (
                            <div className="mt-4 mb-2 p-3 bg-white/60 rounded border border-orange-100/50">
                                <div className="grid grid-cols-1 gap-1.5">
                                    {selectedItems.map(item => {
                                        const info = getPartnerQuotaInfo(item.productId, item.campaignId, receiverName);
                                        if (!info) return null;
                                        return (
                                            <div key={item.id} className="flex justify-between items-center">
                                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Cupo Disponible ({receiverName})</span>
                                                <span className={`text-[13px] font-black ${info.remaining > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                    {info.remaining.toLocaleString(undefined, {maximumFractionDigits: 0})} {item.unit} <span className="text-[10px] text-slate-400 font-bold lowercase ml-1">{item.productName}</span>
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    <div className="mt-4 pt-4 border-t border-orange-200/50">
                        <label className="block text-xs font-bold text-orange-800 uppercase mb-3">Datos Logísticos (Opcional)</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                            <Input
                                label="Chofer"
                                value={truckDriver}
                                onChange={e => setTruckDriver(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                            <Input
                                label="Patente Camión"
                                value={plateNumber}
                                onChange={e => setPlateNumber(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                            <Input
                                label="Patente Acoplado"
                                value={trailerPlate}
                                onChange={e => setTrailerPlate(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                            <Input
                                label="Empresa Transp."
                                value={transportCompany}
                                onChange={e => setTransportCompany(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                            <Input
                                label="Empresa Destino"
                                value={destinationCompany}
                                onChange={e => setDestinationCompany(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                            <Input
                                label="Dirección / Localidad"
                                value={destinationAddress}
                                onChange={e => setDestinationAddress(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80"
                            />
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            <Input
                                label="Nº Descarga"
                                value={dischargeNumber}
                                onChange={e => setDischargeNumber(e.target.value)}
                                className="bg-white h-9 text-right px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Humedad (%)"
                                value={humidity}
                                onChange={e => setHumidity(e.target.value)}
                                className="bg-white h-9 text-right px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="P. Hectolítrico"
                                value={hectoliterWeight}
                                onChange={e => setHectoliterWeight(e.target.value)}
                                className="bg-white h-9 text-right px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Peso Bruto"
                                value={grossWeight}
                                onChange={e => setGrossWeight(e.target.value)}
                                className="bg-white h-9 text-right font-mono px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Peso Tara"
                                value={tareWeight}
                                onChange={e => setTareWeight(e.target.value)}
                                className="bg-white h-9 text-right font-mono px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Km Recorridos"
                                value={distanceKm}
                                onChange={e => setDistanceKm(e.target.value)}
                                className="bg-white h-9 text-right px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                            <Input
                                label="CUIT Venta Primaria"
                                value={primarySaleCuit}
                                onChange={e => setPrimarySaleCuit(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Fecha y Hora Partida"
                                type="datetime-local"
                                value={departureDateTime}
                                onChange={e => setDepartureDateTime(e.target.value)}
                                className="bg-white h-9 px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                            <Input
                                label="Tarifa Flete (USD)"
                                value={freightTariff}
                                onChange={e => setFreightTariff(e.target.value)}
                                className="bg-white h-9 text-right px-2"
                                labelClassName="text-[10px] text-orange-700/80 font-bold"
                            />
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                <div className="w-full sm:w-auto flex items-center gap-4 flex-wrap">
                    {!showNote ? (
                        <button
                            type="button"
                            onClick={() => setShowNote(true)}
                            className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 shrink-0"
                        >
                            + Agregar nota
                        </button>
                    ) : (
                        <div className="flex items-center gap-2 animate-fadeIn pt-2 sm:pt-0 shrink-0">
                            <Input
                                placeholder="Nota..."
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="h-10 text-sm bg-white border-slate-200 shadow-sm w-full sm:w-64 focus:border-emerald-500 focus:ring-emerald-500 px-2"
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    setShowNote(false);
                                }}
                                className="h-10 w-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
                                title="Confirmar nota"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="M12 5v14" /></svg>
                            </button>
                        </div>
                    )}

                    <div className="w-px h-4 bg-slate-200 mx-2" />

                    <label className="text-sm font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 cursor-pointer shrink-0">
                        + Adjuntar remito
                        <input 
                            type="file" 
                            className="hidden" 
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    setRemitoFile(e.target.files[0]);
                                }
                            }} 
                        />
                    </label>

                    {remitoFile && (
                        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 px-2 py-1 rounded border border-slate-100 shrink-0">
                            <span className="truncate max-w-[150px] font-medium">{remitoFile.name}</span>
                            <button type="button" onClick={(e) => { e.preventDefault(); setRemitoFile(null); }} className="text-red-500 hover:text-red-700 font-bold">✕</button>
                        </div>
                    )}
                </div>

                {action === 'WITHDRAW' && receiverName && (
                    <div className="flex-1 text-center sm:text-right text-[11px] sm:text-xs font-bold italic text-orange-600 px-2 leading-tight">
                        {(() => {
                            let exceedsStock = false;
                            let exceedsQuota = false;
                            selectedItems.forEach((item: any) => {
                                const info = getPartnerQuotaInfo(item.productId, item.campaignId, receiverName);
                                if (info) {
                                    const totalToWithdraw = getGroupTotal(item);
                                    if (totalToWithdraw > info.remaining + 0.01) exceedsQuota = true;
                                }
                                if (item.breakdown) {
                                    item.breakdown.forEach((b: any) => {
                                        const absQty = getAbsoluteQty(b.id, item);
                                        if (absQty > b.quantity) exceedsStock = true;
                                    });
                                } else {
                                    const absQty = getAbsoluteQty(item.id, item);
                                    if (absQty > item.quantity) exceedsStock = true;
                                }
                            });

                            if (!exceedsQuota && !exceedsStock) return null;
                            if (exceedsQuota && exceedsStock) return 'El retiro es más grande que lo permitido al socio y lo existente en el galpón, se anotará una cantidad negativa';
                            if (exceedsQuota && !exceedsStock) return 'El retiro es más grande que lo permitido al socio, se anotará una cantidad negativa';
                            return 'El retiro es más grande que lo existente en el galpón, se anotará una cantidad negativa';
                        })()}
                    </div>
                )}

                <div className="flex justify-end gap-2 w-full sm:w-auto shrink-0">
                    <Button
                        onClick={handleSubmit}
                        isLoading={loading}
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed w-full sm:w-auto"
                    >
                        {action === 'WITHDRAW' ? 'Confirmar Retiro' : 'Confirmar Traslado'}
                    </Button>
                </div>
            </div>
        </div>
    );
}
export const StockMovementPanel = memo(StockMovementPanelInternal);
