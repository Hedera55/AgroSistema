'use client';

import React, { useMemo } from 'react';

interface Investor {
    name: string;
    percentage: number;
}

interface InvestorSelectorProps {
    availablePartners: (string | { name: string })[];
    selectedInvestors: Investor[];
    onChange: (investors: Investor[]) => void;
    label?: string;
}

export const InvestorSelector: React.FC<InvestorSelectorProps> = ({
    availablePartners,
    selectedInvestors,
    onChange,
    label = "Pagado por"
}) => {
    const partnerNames = useMemo(() => {
        return availablePartners.map((p: any) => {
            if (typeof p === 'string') {
                if (p.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(p);
                        return parsed.name || p;
                    } catch (e) {
                        return p;
                    }
                }
                return p;
            }
            return p?.name || '';
        }).filter(Boolean);
    }, [availablePartners]);

    const handleAddInvestor = (name: string) => {
        if (!name) return;
        if (selectedInvestors.find(i => i.name === name)) return;

        const newInvestors = [
            ...selectedInvestors,
            { name, percentage: selectedInvestors.length === 0 ? 100 : 0 }
        ];
        onChange(newInvestors);
    };

    const handleRemoveInvestor = (name: string) => {
        const newInvestors = selectedInvestors.filter(i => i.name !== name);
        onChange(newInvestors);
    };

    const handleUpdatePercentage = (name: string, pctStr: string) => {
        const pct = parseFloat(pctStr) || 0;
        const newInvestors = selectedInvestors.map(i => 
            i.name === name ? { ...i, percentage: pct } : i
        );
        onChange(newInvestors);
    };

    const totalPercentage = selectedInvestors.reduce((acc, i) => acc + i.percentage, 0);

    return (
        <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 leading-none">
                {label}
            </label>
            <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[50px]">
                <div className="w-[180px] shrink-0">
                    <select
                        className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-9 bg-white"
                        value=""
                        onChange={e => {
                            handleAddInvestor(e.target.value);
                            e.target.value = "";
                        }}
                    >
                        <option value="">Seleccionar socio...</option>
                        {partnerNames.map((name, idx) => (
                            <option key={`${name}-${idx}`} value={name}>{name}</option>
                        ))}
                    </select>
                </div>

                {selectedInvestors.map((inv, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-1 pl-2 pr-1 rounded-lg border border-slate-200 shadow-sm animate-fadeIn">
                        <div className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{inv.name}</div>
                        <div className="flex items-center gap-1 bg-slate-50 rounded px-1">
                            <input
                                type="number"
                                min="0"
                                max="100"
                                step="any"
                                value={inv.percentage}
                                onChange={(e) => handleUpdatePercentage(inv.name, e.target.value)}
                                className="w-10 h-6 text-right text-xs rounded border-none bg-transparent focus:ring-0 p-0 font-mono font-bold text-emerald-600 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                            <span className="text-slate-400 text-[10px]">%</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => handleRemoveInvestor(inv.name)}
                            className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Eliminar"
                        >
                            ✕
                        </button>
                    </div>
                ))}

                {selectedInvestors.length === 0 && (
                    <span className="text-xs text-slate-400 italic">No hay socios seleccionados</span>
                )}
            </div>
            {selectedInvestors.length > 0 && Math.abs(totalPercentage - 100) > 0.01 && (
                <p className="text-[10px] font-bold text-orange-500 uppercase tracking-tight">
                    ⚠️ El total es {totalPercentage.toFixed(1)}% (Debe ser 100%)
                </p>
            )}
        </div>
    );
};
