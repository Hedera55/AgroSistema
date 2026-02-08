'use client';

import { Button } from '@/components/ui/Button';
import { Farm, Lot } from '@/types';

interface OrderLocationStepProps {
    date: string;
    setDate: (date: string) => void;
    appStart: string;
    setAppStart: (date: string) => void;
    appEnd: string;
    setAppEnd: (date: string) => void;
    selectedFarmId: string;
    setSelectedFarmId: (id: string) => void;
    selectedLotId: string;
    setSelectedLotId: (id: string) => void;
    farms: Farm[];
    lots: Lot[];
    onNext: () => void;
}

export function OrderLocationStep({
    date,
    setDate,
    appStart,
    setAppStart,
    appEnd,
    setAppEnd,
    selectedFarmId,
    setSelectedFarmId,
    selectedLotId,
    setSelectedLotId,
    farms,
    lots,
    onNext
}: OrderLocationStepProps) {
    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de emisión</label>
                <input
                    type="date"
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                />
            </div>

            <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 grid grid-cols-2 gap-4">
                <div className="w-full">
                    <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Inicio de ventana de aplicación</label>
                    <input
                        type="date"
                        className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                        value={appStart}
                        onChange={e => setAppStart(e.target.value)}
                    />
                </div>
                <div className="w-full">
                    <label className="block text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Fin de ventana de aplicación</label>
                    <input
                        type="date"
                        className="block w-full rounded-lg border-emerald-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm"
                        value={appEnd}
                        onChange={e => setAppEnd(e.target.value)}
                    />
                </div>
            </div>

            <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Campo</label>
                <select
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                    value={selectedFarmId}
                    onChange={e => setSelectedFarmId(e.target.value)}
                >
                    <option value="">Seleccione Campo...</option>
                    {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
            </div>

            <div className="w-full">
                <label className="block text-sm font-medium text-slate-700 mb-1">Lote</label>
                <select
                    className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 py-3 px-4"
                    value={selectedLotId}
                    onChange={e => setSelectedLotId(e.target.value)}
                    disabled={!selectedFarmId}
                >
                    <option value="">Seleccione Lote...</option>
                    {lots.map(l => <option key={l.id} value={l.id}>{l.name} ({l.hectares} ha)</option>)}
                </select>
            </div>

            <div className="flex justify-end pt-4">
                <Button onClick={onNext} disabled={!selectedLotId || !date}>Agregar producto</Button>
            </div>
        </div>
    );
}
