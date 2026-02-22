'use client';

import React from 'react';

export default function SelectorDemosPage() {
    return (
        <div className="p-10 bg-slate-50 min-h-screen">
            <h1 className="text-2xl font-bold mb-8 text-slate-800">Selector Style Comparisons</h1>

            <div className="space-y-12 max-w-2xl">

                {/* Style 1: RAW / UNSTYLED */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-sm font-black uppercase text-slate-400 mb-4 tracking-widest">1. Style: Raw / Unstyled (Native)</h2>
                    <p className="text-xs text-slate-500 mb-4 italic">This is the current state of Step 3 in the Harvest Wizard.</p>
                    <select className="w-full text-sm">
                        <option>GENERAL (Aplica a todos)</option>
                        <option disabled>──────────</option>
                        <option>Acopio de Granos (1kg)</option>
                        <option>Socio: Juan Perez (500kg)</option>
                    </select>
                </section>

                {/* Style 2: WIN 95 / RETRO SYSTEM (MODIFIED) */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-sm font-black uppercase text-slate-400 mb-4 tracking-widest">2. Style: Retro System (White Background)</h2>
                    <p className="text-xs text-slate-500 mb-4 italic">Beveled edges, white background, thinner system appearance.</p>
                    <select style={{
                        width: '100%',
                        backgroundColor: '#ffffff',
                        border: '2px inset #ffffff',
                        padding: '1px 3px',
                        fontFamily: 'sans-serif',
                        fontSize: '13px',
                        appearance: 'auto',
                        cursor: 'default',
                        outline: 'none'
                    }}>
                        <option>GENERAL (Aplica a todos)</option>
                        <option disabled>──────────</option>
                        <option>Acopio de Granos (1kg)</option>
                        <option>Socio: Juan Perez (500kg)</option>
                    </select>
                </section>

                {/* Style 3: STEP 2 STYLE (THINNER & NO SHADOW) */}
                <section className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-sm font-black uppercase text-slate-400 mb-4 tracking-widest">3. Style: Step 2 Refined (Thinner & No Shadow)</h2>
                    <p className="text-xs text-slate-500 mb-4 italic">The app theme but thinner and without any depth/shadow.</p>
                    <select className="w-full px-2 py-0.5 text-sm rounded-lg border border-slate-200 bg-white focus:ring-1 focus:ring-blue-500 outline-none">
                        <option>GENERAL (Aplica a todos)</option>
                        <option disabled>──────────</option>
                        <option>Acopio de Granos (1kg)</option>
                        <option>Socio: Juan Perez (500kg)</option>
                    </select>
                </section>

                <div className="mt-10 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700 font-bold leading-relaxed">
                        I've prepared these three options for you to compare side-by-side.
                        The **Raw** version reflects what I just applied to the Wizard.
                        The **Retro** version uses hardcoded system styles, and the **App Theme** matches the standard UI.
                    </p>
                </div>
            </div>
        </div>
    );
}
