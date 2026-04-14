'use client';

import { useState, useEffect } from 'react';

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
    lotHectares: Record<string, number>;
    setLotHectares: (val: Record<string, number>) => void;
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
    lotHectares,
    setLotHectares,
    lotObservations,
    setLotObservations,
    farms,
    lots,
    onNext
}: OrderLocationStepProps) {
    const [editingHectaresId, setEditingHectaresId] = useState<string | null>(null);
    const [tempHectares, setTempHectares] = useState<string>('');
    const [showMagnifierId, setShowMagnifierId] = useState<string | null>(null);

    // Global click-to-close for magnifier
    useEffect(() => {
        if (!showMagnifierId) return;
        const handleGlobalClick = () => setShowMagnifierId(null);
        window.addEventListener('mousedown', handleGlobalClick);
        return () => window.removeEventListener('mousedown', handleGlobalClick);
    }, [showMagnifierId]);

    const handleLotClick = (lotId: string) => {
        if (selectedLotIds.includes(lotId)) return;
        setSelectedLotIds([...selectedLotIds, lotId]);
    };

    const handleRemoveLot = (lotId: string) => {
        setSelectedLotIds(selectedLotIds.filter(id => id !== lotId));
        const newObs = { ...lotObservations };
        delete newObs[lotId];
        setLotObservations(newObs);

        const newHectares = { ...lotHectares };
        delete newHectares[lotId];
        setLotHectares(newHectares);
    };

    const handleObsChange = (lotId: string, value: string) => {
        setLotObservations({ ...lotObservations, [lotId]: value });
    };

    const handleHectaresConfirm = (lotId: string) => {
        const lot = lots.find(l => l.id === lotId);
        if (!lot) return;

        if (tempHectares === '') {
            setLotHectares({ ...lotHectares, [lotId]: lot.hectares });
            setEditingHectaresId(null);
            return;
        }

        let val = parseFloat(tempHectares.replace(',', '.'));
        if (isNaN(val)) val = lot.hectares;
        if (val > lot.hectares) val = lot.hectares;
        if (val < 0) val = 0;

        setLotHectares({ ...lotHectares, [lotId]: val });
        setEditingHectaresId(null);
    };

    const totalHectares = lots
        .filter(l => selectedLotIds.includes(l.id))
        .reduce((acc, l) => acc + (lotHectares[l.id] ?? (l.hectares || 0)), 0);

    return (
        <div className="space-y-6 animate-fadeIn pb-8">
            <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Fecha de emisión</label>
                <input
                    type="date"
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 bg-white"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />
            </div>

            <div className="bg-white p-4 rounded-xl border border-emerald-100 space-y-4">
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
                                className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm bg-white"
                                value={appStart}
                                onChange={e => setAppStart(e.target.value)}
                            />
                        </div>
                        <div className="w-full">
                            <label className="block text-[10px] font-bold text-emerald-800/60 uppercase tracking-wider mb-1">Fin de ventana de aplicación</label>
                            <input
                                type="date"
                                className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm bg-white"
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
                            className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm bg-white"
                            value={applicationDate}
                            onChange={e => setApplicationDate(e.target.value)}
                        />
                    </div>
                )}
            </div>

            <div className="w-full">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Campo</label>
                <select
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 bg-white"
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
                        className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4 bg-white"
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
                                <div key={id} className="flex flex-row items-center gap-4 animate-fadeIn bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-3">
                                    <div className="flex-none min-w-[120px]">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-700 block">{lot.name}</span>
                                        </div>
                                        {(lotHectares[id] === undefined || lotHectares[id] === lot.hectares) && (
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] font-mono text-slate-400 uppercase tracking-tighter">
                                                {lot.hectares} ha
                                            </div>
                                        )}
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
                                    <div className="flex items-center gap-1 min-w-[160px] justify-end">
                                        {editingHectaresId === id ? (
                                            <div className="flex items-center gap-1 animate-fadeIn">
                                                <input
                                                    type="text"
                                                    className="w-20 h-8 text-xs px-2 border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-emerald-500 bg-white font-bold text-emerald-600"
                                                    placeholder="ha..."
                                                    value={tempHectares}
                                                    onChange={e => {
                                                        let val = e.target.value.replace(/[^\d.,]/g, '');
                                                        const match = val.match(/[.,]/);
                                                        if (match) {
                                                            const sep = match[0];
                                                            const firstIdx = val.indexOf(sep);
                                                            val = val.substring(0, firstIdx + 1) + val.substring(firstIdx + 1).replace(/[.,]/g, '');
                                                        }
                                                        setTempHectares(val);
                                                    }}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleHectaresConfirm(id);
                                                        } else if (e.key === 'Escape') {
                                                            setEditingHectaresId(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleHectaresConfirm(id)}
                                                    className="w-8 h-8 flex items-center justify-center bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors shadow-sm"
                                                    title="Confirmar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingHectaresId(null)}
                                                    className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors"
                                                    title="Cancelar"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <div className="px-2 py-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-1 group">
                                                    <span 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const isChopped = lotHectares[id] !== undefined && lotHectares[id] !== lot.hectares;
                                                            if (isChopped) {
                                                                setShowMagnifierId(showMagnifierId === id ? null : id);
                                                            } else {
                                                                setEditingHectaresId(id);
                                                                setTempHectares(lotHectares[id] !== undefined ? lotHectares[id].toString() : lot.hectares.toString());
                                                            }
                                                        }}
                                                        className="text-[10px] uppercase font-bold tracking-wider cursor-pointer"
                                                        title={lotHectares[id] !== undefined && lotHectares[id] !== lot.hectares ? "Ver detalle" : "recortar ha"}
                                                    >
                                                        {lotHectares[id] !== undefined && lotHectares[id] !== lot.hectares
                                                            ? `${lotHectares[id]}/${lot.hectares} ha`
                                                            : 'recortar ha'}
                                                    </span>
                                                    <svg 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setEditingHectaresId(id);
                                                            setTempHectares(lotHectares[id] !== undefined ? lotHectares[id].toString() : lot.hectares.toString());
                                                        }}
                                                        xmlns="http://www.w3.org/2000/svg" 
                                                        className="h-3.5 w-3.5 cursor-pointer text-slate-400 group-hover:text-emerald-500 ml-0.5 opacity-60 hover:opacity-100 transition-opacity" 
                                                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                    >
                                                        <title>Editar hectáreas</title>
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </div>
                                                
                                                {/* Literal Magnifier (Lupa) Style */}
                                                {showMagnifierId === id && (
                                                    <div 
                                                        className="absolute -left-12 -top-6 z-[101] animate-in fade-in zoom-in duration-100 pointer-events-none"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        <div className="bg-white p-2 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.25)] border border-slate-200 pointer-events-auto w-max">
                                                            <div className="px-4 py-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all flex items-center gap-3 group whitespace-nowrap">
                                                                <span 
                                                                    className="text-[28px] uppercase font-bold tracking-wider cursor-pointer whitespace-nowrap"
                                                                    onClick={() => setShowMagnifierId(null)}
                                                                >
                                                                    {lotHectares[id] !== undefined ? lotHectares[id] : lot.hectares}/{lot.hectares} ha
                                                                </span>
                                                                <svg 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingHectaresId(id);
                                                                        setTempHectares(lotHectares[id] !== undefined ? lotHectares[id].toString() : lot.hectares.toString());
                                                                        setShowMagnifierId(null);
                                                                    }}
                                                                    xmlns="http://www.w3.org/2000/svg" 
                                                                    className="h-9 w-9 cursor-pointer text-slate-400 group-hover:text-emerald-500 ml-1 opacity-60 hover:opacity-100 transition-opacity" 
                                                                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                                                >
                                                                    <title>Editar hectáreas</title>
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
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
