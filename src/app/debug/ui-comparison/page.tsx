'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

// Mock types and components to ensure it renders standalone
const mockWarehouse = { id: 'w1', name: 'Acopio de Granos' };
const mockInvestors = [{ name: 'Juan Perez', percentage: 50 }, { name: 'Empresa S.A.', percentage: 50 }];
const mockProduct = { id: 'p1', productName: 'TRIGO', unit: 'Tons' };

export default function UIComparisonPage() {
    // New States
    const [newSaleQuantity, setNewSaleQuantity] = useState('');
    const [newSalePrice, setNewSalePrice] = useState('');

    // Old States
    const [oldSaleQuantity, setOldSaleQuantity] = useState('');
    const [oldSalePrice, setOldSalePrice] = useState('');

    return (
        <div className="min-h-screen bg-slate-100 p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Comparación de UI (Fase 30)</h1>
                        <p className="text-slate-500 font-medium">Revisa las versiones anteriores vs las nuevas para decidir qué cambios mantener.</p>
                    </div>
                    <Link href="/clients" className="bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-emerald-600 transition-all">
                        Volver
                    </Link>
                </header>

                {/* SECTION 1: VENDER BOX */}
                <section>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 font-black text-xl italic">V</div>
                        <h2 className="text-xl font-bold text-slate-800">Caja de Venta (Vender)</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* OLD VERSION */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-full">Versión Original (Anterior)</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm opacity-90 grayscale-[0.2]">
                                <form className="flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex flex-wrap items-end gap-4">
                                        <div className="flex-1 min-w-[120px]">
                                            <Input label="Cantidad a Vender (Tons)" type="text" value={oldSaleQuantity} onChange={e => setOldSaleQuantity(e.target.value)} />
                                        </div>
                                        <div className="flex-1 min-w-[120px]">
                                            <Input label="Precio de Venta (USD/Tons)" type="text" value={oldSalePrice} onChange={e => setOldSalePrice(e.target.value)} />
                                        </div>
                                        <div className="flex gap-2 mb-1">
                                            <Button type="button" size="sm">Confirmar Venta</Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <Input label="Chofer" value="" onChange={() => { }} placeholder="Nombre" className="bg-white h-9" />
                                        <Input label="Patente" value="" onChange={() => { }} placeholder="AAA 123" className="bg-white h-9" />
                                        <Input label="Acoplado" value="" onChange={() => { }} placeholder="BBB 456" className="bg-white h-9" />
                                        <Input label="Destino" value="" onChange={() => { }} placeholder="Localidad" className="bg-white h-9" />
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* NEW VERSION */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full">Versión Nueva (Actual)</span>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-emerald-200 shadow-xl relative ring-4 ring-emerald-50">
                                <button type="button" className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors">✕</button>
                                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-[0.2em] mb-4">Registrar Detalle de Venta</h4>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                    <Input label="Cantidad a Vender (Tons)" type="text" value={newSaleQuantity} onChange={e => setNewSaleQuantity(e.target.value)} className="h-11 font-bold text-lg" />
                                    <Input label="Precio de Venta (USD/Tons)" type="text" value={newSalePrice} onChange={e => setNewSalePrice(e.target.value)} className="h-11 font-bold text-lg" />
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                                        <Input label="Empresa de Destino" value="" onChange={() => { }} placeholder="Planta / Acopio..." className="bg-white h-10" />
                                        <Input label="Dirección" value="" onChange={() => { }} className="bg-white h-10" />
                                        <Input label="CUIT Venta P." value="" onChange={() => { }} className="bg-white h-10" />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-6 border-t border-slate-100">
                                    <Button type="button" className="px-8 bg-emerald-600 hover:bg-emerald-700">Confirmar Venta</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 2: RETIRO BOX */}
                <section>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-black text-xl italic">R</div>
                        <h2 className="text-xl font-bold text-slate-800">Caja de Retiro (Mover / Retirar)</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* OLD VERSION */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-slate-200 text-slate-600 text-[10px] font-black uppercase rounded-full">Versión Original - "Retirar Stock"</span>
                            </div>
                            <div className="bg-white p-4 rounded-xl shadow-lg border border-indigo-100 opacity-90 grayscale-[0.2]">
                                <h3 className="text-lg font-semibold text-slate-800 mb-3">Mover Stock Seleccionado</h3>
                                <div className="flex gap-3 mb-4">
                                    <button className="flex-1 py-2 rounded-lg border-2 border-orange-200 bg-orange-50 text-orange-700 font-bold text-sm">Retirar Stock</button>
                                    <button className="flex-1 py-2 rounded-lg border border-slate-200 bg-white text-slate-400 font-bold text-sm">Transferir</button>
                                </div>
                                <div className="flex justify-end">
                                    <Button className="bg-orange-600">Confirmar Retiro</Button>
                                </div>
                            </div>
                        </div>

                        {/* NEW VERSION */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-orange-100 text-orange-700 text-[10px] font-black uppercase rounded-full">Versión Nueva - "Mover Stock"</span>
                            </div>
                            <div className="bg-white p-6 rounded-2xl shadow-2xl border-2 border-orange-200 relative ring-4 ring-orange-50">
                                <button className="absolute top-4 right-4 text-slate-400">✕</button>
                                <h3 className="text-lg font-black text-slate-800 mb-4 uppercase tracking-tighter italic">Mover Stock Seleccionado</h3>

                                <div className="flex gap-4 mb-6 p-1 bg-slate-100 rounded-xl">
                                    <button className="flex-1 py-3 rounded-lg bg-white shadow-sm text-orange-700 font-black text-sm uppercase tracking-widest">Retiro</button>
                                    <button className="flex-1 py-3 rounded-lg text-slate-400 font-bold text-sm">Transferencia</button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <Input label="Empresa Destino" placeholder="..." className="bg-white" />
                                    <Input label="Km Recorridos" placeholder="0" className="bg-white" />
                                </div>

                                <div className="flex justify-end">
                                    <Button className="bg-orange-600 px-8 py-6 text-lg font-black italic">Confirmar</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* SECTION 3: HARVEST DETAILS VS EDIT */}
                <section>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-black text-xl italic">H</div>
                        <h2 className="text-xl font-bold text-slate-800">Cosecha: Detalles vs Edición</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* CURRENT BEHAVIOR: REPLACEMENT */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full">Comportamiento Actual (Reemplaza)</span>
                            </div>
                            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
                                    <p className="text-slate-400 font-bold">El Detalle de Cosecha desaparece</p>
                                    <p className="text-slate-400 text-xs">y es reemplazado por el Formulario de Edición</p>
                                </div>
                                <div className="mt-4 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                                    <h4 className="font-bold text-blue-800 mb-2">Formulario de Edición Visible</h4>
                                    <div className="h-20 bg-white rounded border border-blue-100"></div>
                                </div>
                            </div>
                        </div>

                        {/* PROPOSED BEHAVIOR: PERSISTENT DETAILS */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-full">Propuesta (Detalles Persistentes)</span>
                            </div>
                            <div className="bg-white rounded-xl border border-emerald-200 shadow-xl overflow-hidden">
                                <div className="p-4 bg-slate-50 border-b border-slate-200">
                                    <h4 className="font-bold text-slate-700 uppercase text-xs">Detalles de Cosecha (Siempre Visible)</h4>
                                    <div className="mt-2 grid grid-cols-3 gap-2">
                                        <div className="h-12 bg-white rounded border border-slate-100"></div>
                                        <div className="h-12 bg-white rounded border border-slate-100"></div>
                                        <div className="h-12 bg-white rounded border border-slate-100"></div>
                                    </div>
                                </div>
                                <div className="p-6 bg-white ring-4 ring-emerald-50/50">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest">Panel de Edición</h4>
                                    </div>
                                    <div className="space-y-4">
                                        <Input label="Rinde Observado" value="2500" onChange={() => { }} className="h-10" />
                                        <Input label="Fecha" type="date" value="2023-10-27" onChange={() => { }} className="h-10" />
                                    </div>
                                    <div className="flex justify-end mt-6">
                                        <Button className="bg-emerald-600">Guardar Cambios</Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <div className="bg-white p-6 rounded-xl border-t-4 border-amber-500 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Nota sobre nombres de botones y campos:</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">
                        Aunque en la versión visual diga "Mover", ya tomé nota de que prefieres mantener el nombre <strong>"Retiro"</strong>.
                        Esta página es solo para comparar el <strong>layout (diseño de los campos y botones)</strong>.
                        Dime cuál diseño prefieres y yo ajustaré los textos correctamente a tus términos.
                    </p>
                </div>
            </div>
        </div>
    );
}
