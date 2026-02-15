'use client';

import { Button } from '@/components/ui/Button';
import { Farm, Lot } from '@/types';

interface OrderLocationStepProps {
    date: string;
    setDate: (date: string) => void;
    isDateRange: boolean;
    setIsDateRange: (val: boolean) => void;
    applicationDate: string;
    setApplicationDate: (date: string) => void;
    appStart: string;
    setAppStart: (date: string) => void;
    appEnd: string;
    setAppEnd: (date: string) => void;
    selectedFarmId: string;
    setSelectedFarmId: (id: string) => void;
    selectedLotIds: string[];
    setSelectedLotIds: (ids: string[]) => void;
    lotObservations: Record<string, string>;
    setLotObservations: (obs: Record<string, string>) => void;
    farms: Farm[];
    lots: Lot[];
    onNext: () => void;
}

export function OrderLocationStep({
    date,
    setDate,
    isDateRange,
    setIsDateRange,
    applicationDate,
    setApplicationDate,
    appStart,
    setAppStart,
    appEnd,
    setAppEnd,
    selectedFarmId,
    setSelectedFarmId,
    selectedLotIds,
    setSelectedLotIds,
    lotObservations,
    setLotObservations,
    farms,
    lots,
    onNext
}: OrderLocationStepProps) {
    const handleLotClick = (lotId: string) => {
        if (selectedLotIds.includes(lotId)) return;
        setSelectedLotIds([...selectedLotIds, lotId]);
    };

    const handleRemoveLot = (lotId: string) => {
        setSelectedLotIds(selectedLotIds.filter(id => id !== lotId));
        const newObs = { ...lotObservations };
        delete newObs[lotId];
        setLotObservations(newObs);
    };

    const handleObsChange = (lotId: string, value: string) => {
        setLotObservations({ ...lotObservations, [lotId]: value });
    };

    const totalHectares = lots
        .filter(l => selectedLotIds.includes(l.id))
        .reduce((acc, l) => acc + (l.hectares || 0), 0);

    return (
        <div className="space-y-6 animate-fadeIn pb-8">
            <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de emisión</label>
                <input
                    type="date"
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 space-y-4">
                <div className="flex gap-6 items-center">
                    <button
                        type="button"
                        onClick={() => setIsDateRange(true)}
                        className="flex items-center gap-2 group cursor-pointer"
                    >
                        <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${isDateRange ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'bg-white border-slate-300'}`}>
                            {isDateRange && <span className="text-white text-[10px] font-black">✕</span>}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${isDateRange ? 'text-emerald-800' : 'text-slate-500'}`}>Ventana de aplicación</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsDateRange(false)}
                        className="flex items-center gap-2 group cursor-pointer"
                    >
                        <div className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-all ${!isDateRange ? 'bg-emerald-500 border-emerald-500 shadow-sm' : 'bg-white border-slate-300'}`}>
                            {!isDateRange && <span className="text-white text-[10px] font-black">✕</span>}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors ${!isDateRange ? 'text-emerald-800' : 'text-slate-500'}`}>Fecha de aplicación</span>
                    </button>
                </div>

                {isDateRange ? (
                    <div className="grid grid-cols-2 gap-4 animate-fadeIn">
                        <div className="w-full">
                            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider mb-1">Inicio de ventana de aplicación</label>
                            <input
                                type="date"
                                className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                value={appStart}
                                onChange={e => setAppStart(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
                            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider mb-1">Fin de ventana de aplicación</label>
                            <input
                                type="date"
                                className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                                value={appEnd}
                                onChange={e => setAppEnd(e.target.value)}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="w-full animate-fadeIn text-left">
                        <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider mb-1 text-left">Día de aplicación</label>
                        <input
                            type="date"
                            className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                            value={applicationDate}
                            onChange={e => setApplicationDate(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campo</label>
                <select
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                    value={selectedFarmId}
                    onChange={e => {
                        setSelectedFarmId(e.target.value);
                        setSelectedLotIds([]);
                        setLotObservations({});
                    }}
                >
                    <option value="">Seleccione Campo...</option>
                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
            </div>

            <div className="space-y-3">
                <div className="w-full">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Seleccionar Lotes</label>
                    <select
                        className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                        value=""
                        onChange={e => {
                            if (e.target.value) handleLotClick(e.target.value);
                        }}
                        disabled={!selectedFarmId}
                    >
                        <option value="">Añadir lote...</option>
                        {lots.map(l => (
                            <option key={l.id} value={l.id} disabled={selectedLotIds.includes(l.id)}>
                                {l.name} ({l.hectares} ha)
                            </option>
                        ))}
                    </select>
                </div>

                {selectedLotIds.length > 0 && (
                    <div className="space-y-4 pt-4">
                        {selectedLotIds.map(id => {
                            const lot = lots.find(l => l.id === id);
                            if (!lot) return null;
                            return (
                                <div key={id} className="flex flex-row items-center gap-4 animate-fadeIn border-b border-slate-100 pb-3">
                                    <div className="flex-none min-w-[120px]">
                                        <span className="text-sm font-bold text-slate-700 block">{lot.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">{lot.hectares} ha</span>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            className="block w-full text-xs border-transparent bg-slate-50 rounded-md focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all py-2 px-3"
                                            placeholder="Estado del lote"
                                            value={lotObservations[id] || ''}
                                            onChange={e => handleObsChange(id, e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLot(id)}
                                        className="flex-none p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                                        title="Eliminar lote"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            );
                        })}
                        <div className="flex justify-between items-baseline pt-2">
                            <span className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Total Hectáreas</span>
                            <span className="text-xl font-mono font-black text-emerald-600">{totalHectares.toLocaleString('es-AR', { minimumFractionDigits: 1 })} ha</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-end pt-4">
                <Button
                    onClick={onNext}
                    disabled={selectedLotIds.length === 0 || !date}
                    className="px-8"
                >
                    Agregar productos
                </Button>
            </div>
        </div>
    );
}
