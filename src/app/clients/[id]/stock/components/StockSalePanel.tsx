'use client';

import React from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface StockSalePanelProps {
    stockItem: any;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => Promise<void>;
    // States
    saleQuantity: string;
    setSaleQuantity: (val: string) => void;
    salePrice: string;
    setSalePrice: (val: string) => void;
    isSubmitting: boolean;
    facturaUploading: boolean;
    saleTruckDriver: string;
    setSaleTruckDriver: (val: string) => void;
    salePlateNumber: string;
    setSalePlateNumber: (val: string) => void;
    saleTrailerPlate: string;
    setSaleTrailerPlate: (val: string) => void;
    saleDestinationCompany: string;
    setSaleDestinationCompany: (val: string) => void;
    saleDestinationAddress: string;
    setSaleDestinationAddress: (val: string) => void;
    salePrimarySaleCuit: string;
    setSalePrimarySaleCuit: (val: string) => void;
    saleTransportCompany: string;
    setSaleTransportCompany: (val: string) => void;
    saleDischargeNumber: string;
    setSaleDischargeNumber: (val: string) => void;
    saleHumidity: string;
    setSaleHumidity: (val: string) => void;
    saleHectoliterWeight: string;
    setSaleHectoliterWeight: (val: string) => void;
    saleGrossWeight: string;
    setSaleGrossWeight: (val: string) => void;
    saleTareWeight: string;
    setSaleTareWeight: (val: string) => void;
    saleDistanceKm: string;
    setSaleDistanceKm: (val: string) => void;
    saleDepartureDateTime: string;
    setSaleDepartureDateTime: (val: string) => void;
    saleFreightTariff: string;
    setSaleFreightTariff: (val: string) => void;
    showSaleNote: boolean;
    setShowSaleNote: (val: boolean) => void;
    saleNote: string;
    setSaleNote: (val: string) => void;
    saleFacturaFile: File | null;
    setSaleFacturaFile: (val: File | null) => void;
}

export function StockSalePanel({
    stockItem,
    onClose,
    onSubmit,
    saleQuantity,
    setSaleQuantity,
    salePrice,
    setSalePrice,
    isSubmitting,
    facturaUploading,
    saleTruckDriver,
    setSaleTruckDriver,
    salePlateNumber,
    setSalePlateNumber,
    saleTrailerPlate,
    setSaleTrailerPlate,
    saleDestinationCompany,
    setSaleDestinationCompany,
    saleDestinationAddress,
    setSaleDestinationAddress,
    salePrimarySaleCuit,
    setSalePrimarySaleCuit,
    saleTransportCompany,
    setSaleTransportCompany,
    saleDischargeNumber,
    setSaleDischargeNumber,
    saleHumidity,
    setSaleHumidity,
    saleHectoliterWeight,
    setSaleHectoliterWeight,
    saleGrossWeight,
    setSaleGrossWeight,
    saleTareWeight,
    setSaleTareWeight,
    saleDistanceKm,
    setSaleDistanceKm,
    saleDepartureDateTime,
    setSaleDepartureDateTime,
    saleFreightTariff,
    setSaleFreightTariff,
    showSaleNote,
    setShowSaleNote,
    saleNote,
    setSaleNote,
    saleFacturaFile,
    setSaleFacturaFile
}: StockSalePanelProps) {
    if (!stockItem) return null;

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xl relative animate-fadeIn mb-4 floating-panel" onClick={e => e.stopPropagation()}>
            <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 text-slate-400 hover:text-red-500 transition-colors z-10"
                title="Cerrar"
            >
                ✕
            </button>

            <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-800">
                    Venta de {stockItem.productName} ({stockItem.productBrand})
                </h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                    Disponible: {stockItem.quantity} {stockItem.unit}
                </p>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-6">
                {/* 1. Core Section (Flush Top Row) */}
                <div className="flex flex-wrap items-end gap-6">
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            label="Cantidad a Vender (Tons)"
                            type="text"
                            inputMode="decimal"
                            value={saleQuantity}
                            onChange={e => setSaleQuantity(e.target.value)}
                            required
                            className="h-10"
                            labelClassName="block text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                        <Input
                            label="Precio de Venta (USD/Tons)"
                            type="text"
                            inputMode="decimal"
                            value={salePrice}
                            onChange={e => setSalePrice(e.target.value)}
                            required
                            className="h-10"
                            labelClassName="block text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>
                </div>

                {/* 2. Indented Green Zone (Logistics) */}
                <div className="bg-emerald-50/50 p-5 rounded-xl border border-emerald-100 flex flex-col gap-5">
                    {/* Destination Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <Input
                            label="Empresa de Destino"
                            value={saleDestinationCompany}
                            onChange={e => setSaleDestinationCompany(e.target.value)}
                            placeholder="Planta / Acopio..."
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Dirección / Localidad"
                            value={saleDestinationAddress}
                            onChange={e => setSaleDestinationAddress(e.target.value)}
                            placeholder="Ruta, Localidad..."
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="CUIT Venta Primaria"
                            value={salePrimarySaleCuit}
                            onChange={e => setSalePrimarySaleCuit(e.target.value)}
                            placeholder="..."
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>

                    {/* Driver & Truck Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Input
                            label="Chofer"
                            value={saleTruckDriver}
                            onChange={e => setSaleTruckDriver(e.target.value)}
                            placeholder="Nombre Completo"
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Patente Camión"
                            value={salePlateNumber}
                            onChange={e => setSalePlateNumber(e.target.value)}
                            placeholder="AAA 123"
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Patente Acoplado"
                            value={saleTrailerPlate}
                            onChange={e => setSaleTrailerPlate(e.target.value)}
                            placeholder="BBB 456"
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Empresa Transporte"
                            value={saleTransportCompany}
                            onChange={e => setSaleTransportCompany(e.target.value)}
                            className="bg-white h-9"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>

                    {/* Weight & Measures Group */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                        <Input
                            label="Nro Descarga"
                            value={saleDischargeNumber}
                            onChange={e => setSaleDischargeNumber(e.target.value)}
                            className="bg-white h-9 text-center"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Humedad (%)"
                            value={saleHumidity}
                            onChange={e => setSaleHumidity(e.target.value)}
                            className="bg-white h-9 text-center"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="P. Hectolítrico"
                            value={saleHectoliterWeight}
                            onChange={e => setSaleHectoliterWeight(e.target.value)}
                            className="bg-white h-9 text-center"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Peso Bruto"
                            value={saleGrossWeight}
                            onChange={e => setSaleGrossWeight(e.target.value)}
                            className="bg-white h-9 text-right font-mono"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Peso Tara"
                            value={saleTareWeight}
                            onChange={e => setSaleTareWeight(e.target.value)}
                            className="bg-white h-9 text-right font-mono"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Km Recorridos"
                            value={saleDistanceKm}
                            onChange={e => setSaleDistanceKm(e.target.value)}
                            className="bg-white h-9 text-center"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>

                    {/* Freight & Schedule Group */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                            label="Fecha y Hora Partida"
                            type="datetime-local"
                            value={saleDepartureDateTime}
                            onChange={e => setSaleDepartureDateTime(e.target.value)}
                            className="bg-white h-9 text-sm"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                        <Input
                            label="Tarifa Flete (USD)"
                            value={saleFreightTariff}
                            onChange={e => setSaleFreightTariff(e.target.value)}
                            className="bg-white h-9 text-right"
                            placeholder="0.00"
                            labelClassName="text-sm font-medium text-slate-700 mb-1"
                        />
                    </div>
                </div>

                {/* 3. Footer Section (White + Action Links + Small Button) */}
                <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
                    <div className="flex items-center gap-4 mb-1">
                        <button
                            type="button"
                            onClick={() => setShowSaleNote(!showSaleNote)}
                            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors"
                        >
                            <span className="text-base leading-none">+</span>
                            {saleNote ? 'Editar Nota' : 'Agregar Nota'}
                        </button>

                        <div className="flex items-center gap-2 border-l pl-4 border-slate-200">
                            <label htmlFor={`factura-upload-sale-detached`} className="cursor-pointer text-sm font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1.5 transition-colors">
                                <span>+</span>
                                {saleFacturaFile ? (
                                    <span className="text-emerald-700 truncate max-w-[150px] font-bold">{saleFacturaFile.name}</span>
                                ) : (
                                    "Adjuntar Factura"
                                )}
                            </label>
                            <input
                                id={`factura-upload-sale-detached`}
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

                    <div className="flex flex-col items-end gap-3 w-full sm:w-auto">
                        {showSaleNote && (
                            <div className="animate-fadeIn w-full sm:w-[350px] flex gap-2">
                                <div className="flex-1">
                                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Nota de Venta</label>
                                    <textarea
                                        className="block w-full rounded-lg border-slate-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm py-2 px-3 focus:outline-none"
                                        rows={2}
                                        placeholder="Nota..."
                                        value={saleNote}
                                        onChange={(e) => setSaleNote(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowSaleNote(false)}
                                    className="h-9 mt-5 w-9 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-colors shadow-sm shrink-0"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                </button>
                            </div>
                        )}
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isSubmitting || facturaUploading}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm"
                        >
                            {isSubmitting ? 'Procesando...' : 'Confirmar Venta'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
