'use client';

import React, { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

export default function OldBoxDebugPage() {
    // Mock states to simulate the legacy Box environment
    const [saleQuantity, setSaleQuantity] = useState('');
    const [salePrice, setSalePrice] = useState('');
    const [saleTruckDriver, setSaleTruckDriver] = useState('');
    const [salePlateNumber, setSalePlateNumber] = useState('');
    const [saleTrailerPlate, setSaleTrailerPlate] = useState('');
    const [saleDestination, setSaleDestination] = useState('');
    const [saleTransportCompany, setSaleTransportCompany] = useState('');
    const [saleDischargeNumber, setSaleDischargeNumber] = useState('');
    const [saleHumidity, setSaleHumidity] = useState('');
    const [saleHectoliterWeight, setSaleHectoliterWeight] = useState('');
    const [saleGrossWeight, setSaleGrossWeight] = useState('');
    const [saleTareWeight, setSaleTareWeight] = useState('');
    const [showSaleNote, setShowSaleNote] = useState(false);
    const [saleNote, setSaleNote] = useState('');
    const [saleFacturaFile, setSaleFacturaFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [facturaUploading, setFacturaUploading] = useState(false);

    const handleSaleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        alert('Venta confirmada (mock)');
    };

    return (
        <div className="min-h-screen bg-slate-100 p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                <header>
                    <h1 className="text-2xl font-bold text-slate-900 uppercase">Legacy "Old Box" Preview</h1>
                    <p className="text-slate-500">Renderizando el código exacto de StockTable.tsx (root) para comparación visual.</p>
                </header>

                <div className="bg-emerald-50/50 p-8 rounded-xl border border-emerald-200">
                    <h2 className="text-xs font-black text-emerald-800 uppercase tracking-widest mb-4">Ubicación Original: StockTable.tsx (Line 290+)</h2>

                    {/* BEGIN EXACT REPLICA OF LEGACY CODE */}
                    <form onSubmit={handleSaleSubmit} className="flex flex-col gap-4 bg-white p-4 rounded-lg border border-emerald-200 shadow-sm" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap items-end gap-4">
                            <div className="flex-1 min-w-[120px]">
                                <Input
                                    label="Cantidad a Vender (Tons)"
                                    type="text"
                                    inputMode="decimal"
                                    value={saleQuantity}
                                    onChange={e => setSaleQuantity(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex-1 min-w-[120px]">
                                <Input
                                    label="Precio de Venta (USD/Tons)"
                                    type="text"
                                    inputMode="decimal"
                                    value={salePrice}
                                    onChange={e => setSalePrice(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex gap-2 mb-1">
                                <Button type="submit" size="sm" disabled={isSubmitting || facturaUploading}>Confirmar Venta</Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <Input
                                label="Chofer (Transportista)"
                                value={saleTruckDriver}
                                onChange={e => setSaleTruckDriver(e.target.value)}
                                placeholder="Nombre Completo"
                                className="bg-white h-9"
                            />
                            <Input
                                label="Patente Camión"
                                value={salePlateNumber}
                                onChange={e => setSalePlateNumber(e.target.value)}
                                placeholder="AAA 123"
                                className="bg-white h-9"
                            />
                            <Input
                                label="Patente Acoplado"
                                value={saleTrailerPlate}
                                onChange={e => setSaleTrailerPlate(e.target.value)}
                                placeholder="BBB 456"
                                className="bg-white h-9"
                            />
                            <Input
                                label="Destino"
                                value={saleDestination}
                                onChange={e => setSaleDestination(e.target.value)}
                                placeholder="Localidad"
                                className="bg-white h-9"
                            />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <Input
                                label="Emb. Transportista"
                                value={saleTransportCompany}
                                onChange={e => setSaleTransportCompany(e.target.value)}
                                placeholder="Empresa"
                                className="bg-white h-9"
                            />
                            <Input
                                label="Nro de descarga"
                                value={saleDischargeNumber}
                                onChange={e => setSaleDischargeNumber(e.target.value)}
                                placeholder="0001"
                                className="bg-white h-9"
                            />
                            <Input
                                label="Humedad (%)"
                                value={saleHumidity}
                                onChange={e => setSaleHumidity(e.target.value)}
                                placeholder="14.5"
                                className="bg-white h-9"
                            />
                            <Input
                                label="P. Hectolítrico"
                                value={saleHectoliterWeight}
                                onChange={e => setSaleHectoliterWeight(e.target.value)}
                                placeholder="78"
                                className="bg-white h-9"
                            />
                            <div className="grid grid-cols-2 gap-2 flex-grow sm:col-span-1 min-w-[150px]">
                                <Input
                                    label="Peso Bruto"
                                    value={saleGrossWeight}
                                    onChange={e => setSaleGrossWeight(e.target.value)}
                                    placeholder="30000"
                                    className="bg-white h-9"
                                />
                                <Input
                                    label="Peso Tara"
                                    value={saleTareWeight}
                                    onChange={e => setSaleTareWeight(e.target.value)}
                                    placeholder="10000"
                                    className="bg-white h-9"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-start gap-4 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowSaleNote(!showSaleNote)}
                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
                            >
                                {showSaleNote ? 'Cancelar' : (saleNote ? 'Editar Nota' : '+ Agregar Nota')}
                            </button>

                            <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                                <label htmlFor={`factura-upload-sale-debug`} className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1">
                                    {saleFacturaFile ? (
                                        <span className="text-emerald-700 font-bold truncate max-w-[120px]">{saleFacturaFile.name}</span>
                                    ) : (
                                        <span>+ Adjuntar factura</span>
                                    )}
                                </label>
                                <input
                                    id={`factura-upload-sale-debug`}
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setSaleFacturaFile(e.target.files[0]);
                                        }
                                    }}
                                    className="hidden"
                                />
                                {saleFacturaFile && (
                                    <button
                                        type="button"
                                        onClick={() => setSaleFacturaFile(null)}
                                        className="text-red-400 hover:text-red-600 font-bold px-1"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>

                        {showSaleNote && (
                            <div className="animate-fadeIn w-full mt-2 flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Nota de Venta</label>
                                    <textarea
                                        className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3"
                                        rows={2}
                                        placeholder="Escribe una nota para este movimiento..."
                                        value={saleNote}
                                        onChange={(e) => setSaleNote(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowSaleNote(false);
                                    }}
                                    className="h-10 mt-5 w-10 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
                                    title="Confirmar nota"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                        <polyline points="12 5 19 12 12 19"></polyline>
                                    </svg>
                                </button>
                            </div>
                        )}
                    </form>
                    {/* END EXACT REPLICA */}
                </div>

                <div className="p-4 bg-white rounded-lg border border-slate-200">
                    <h3 className="font-bold text-slate-800 mb-2">Observaciones para la implementación final:</h3>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                        <li>Los labels usan el color por defecto (slate-700/500), no emerald.</li>
                        <li>El botón "Confirmar Venta" está en la primera fila, alineado a la derecha del precio.</li>
                        <li>Las secciones de logística usan `bg-slate-50` (gris suave).</li>
                        <li>No hay paddings exagerados ni bordes gruesos.</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
