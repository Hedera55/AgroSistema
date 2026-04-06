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
    
    const handleFillRemainder = (name: string) => {
        const remaining = 100 - totalPercentage;
        if (remaining <= 0) return;
        const newInvestors = selectedInvestors.map(i => 
            i.name === name ? { ...i, percentage: Number((i.percentage + Number(remaining.toFixed(2))).toFixed(2)) } : i
        );
        onChange(newInvestors);
    };

    const totalPercentage = selectedInvestors.reduce((acc, i) => acc + i.percentage, 0);
    const [localSelection, setLocalSelection] = React.useState("");
    const isKeyboardRef = React.useRef(false);

    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                {label}
            </label>
            <div className="flex flex-wrap items-center gap-3 py-2 px-3 bg-slate-50 rounded-xl border border-slate-100 min-h-[42px]">
                <div className="w-[180px] shrink-0">
                    <select
                        className="block w-full rounded-lg border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm h-9 bg-white"
                        value={localSelection}
                        onKeyDown={e => {
                            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                isKeyboardRef.current = true;
                            }
                            if (e.key === 'Enter' && localSelection) {
                                handleAddInvestor(localSelection);
                                setLocalSelection("");
                            }
                        }}
                        onMouseDown={() => {
                            isKeyboardRef.current = false;
                        }}
                        onChange={e => {
                            const val = e.target.value;
                            if (isKeyboardRef.current) {
                                setLocalSelection(val);
                            } else {
                                handleAddInvestor(val);
                                setLocalSelection("");
                            }
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
                            onClick={() => handleFillRemainder(inv.name)}
                            disabled={totalPercentage >= 100}
                            className={`w-5 h-5 flex items-center justify-center rounded transition-colors ${
                                totalPercentage < 100 
                                ? 'text-emerald-600 hover:bg-emerald-50' 
                                : 'text-slate-300 cursor-default opacity-50'
                            }`}
                            title="Completar hasta 100%"
                        >
                            ↓
                        </button>
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
        </div>
    );
};
