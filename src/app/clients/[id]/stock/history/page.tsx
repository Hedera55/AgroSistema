'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { InventoryMovement } from '@/types';
import { supabase } from '@/lib/supabase';

export default function StockHistoryPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: clientId } = use(params);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadingId, setUploadingId] = useState<string | null>(null);

    async function loadMovements() {
        const allMovements = await db.getAll('movements');
        const clientMovements = allMovements
            .filter((m: InventoryMovement) => m.clientId === clientId)
            .sort((a: InventoryMovement, b: InventoryMovement) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setMovements(clientMovements);
        setLoading(false);
    }

    useEffect(() => {
        loadMovements();
    }, [clientId]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, movementId: string) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];

        setUploadingId(movementId);
        try {
            const fileExt = file.name.split('.').pop();
            const filePath = `${clientId}/facturas/${movementId}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('facturas')
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: publicUrlData } = supabase.storage.from('facturas').getPublicUrl(filePath);
            const publicUrl = publicUrlData.publicUrl;

            // Update movement in DB
            const movement = movements.find(m => m.id === movementId);
            if (movement) {
                await db.put('movements', {
                    ...movement,
                    facturaImageUrl: publicUrl,
                    synced: false,
                    updatedAt: new Date().toISOString()
                });
                await loadMovements(); // Refresh UI
            }
        } catch (error) {
            console.error('Error uploading factura:', error);
            alert('Error al subir la factura');
        } finally {
            setUploadingId(null);
            // Reset input
            e.target.value = '';
        }
    };

    const formatDate = (isoString: string) => {
        const date = new Date(isoString);
        return {
            date: date.toLocaleDateString('es-AR'),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                .toLowerCase()
                .replace(' am', ' a.m.')
                .replace(' pm', ' p.m.')
        };
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/clients/${clientId}/stock`} className="text-sm text-slate-500 hover:text-emerald-600 mb-2 inline-block">← Volver al Galpón</Link>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Historial de Movimientos</h1>
                    <p className="text-slate-500 mt-1">Ingresos y egresos de productos.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-500">Cargando historial...</div>
                ) : movements.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="text-4xl mb-2">📜</div>
                        <h3 className="text-lg font-medium text-slate-900">Sin movimientos</h3>
                        <p className="text-slate-500">No hay registros de ingresos o egresos todavía.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Notas</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase"></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200 text-sm">
                                {movements.map((m) => {
                                    const { date, time } = formatDate(m.date);
                                    return (
                                        <tr key={m.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-slate-900">{date}</div>
                                                <div className="text-xs text-slate-400">{time}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-800">
                                                {m.productName}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${m.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'}`}>
                                                    {m.type === 'IN' ? 'INGRESO' : 'EGRESO'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right font-mono font-bold">
                                                {m.type === 'IN' ? '+' : '-'}{m.quantity} {m.unit}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                                                {m.notes}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400 italic">
                                                {m.createdBy || 'Sistema'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                {m.facturaImageUrl ? (
                                                    <a
                                                        href={m.facturaImageUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Ver factura"
                                                        className="inline-block"
                                                    >
                                                        <button
                                                            className="w-6 h-6 bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded text-xs font-bold transition-colors flex items-center justify-center"
                                                        >
                                                            F
                                                        </button>
                                                    </a>
                                                ) : (
                                                    <div className="inline-block relative">
                                                        <input
                                                            type="file"
                                                            accept="image/*,application/pdf"
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-wait"
                                                            onChange={(e) => handleFileUpload(e, m.id)}
                                                            disabled={uploadingId === m.id}
                                                            title="Subir factura faltante"
                                                        />
                                                        <button
                                                            className={`w-6 h-6 bg-white border border-red-200 text-red-500 rounded text-xs font-bold flex items-center justify-center ${uploadingId === m.id ? 'opacity-50 cursor-wait' : 'hover:bg-red-50'}`}
                                                        >
                                                            {uploadingId === m.id ? '...' : 'F'}
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            <div className="flex justify-end pr-2 pb-4">
                <Link
                    href={`/clients/${clientId}/stock`}
                    className="bg-slate-50 text-slate-500 text-xs px-4 py-2 rounded-full border border-slate-200 shadow-sm hover:text-emerald-600 hover:bg-white transition-all font-medium"
                >
                    Volver
                </Link>
            </div>
        </div>
    );
}
