'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lot } from '@/types';
import Link from 'next/link';

export default function KMLRedirectPage() {
    const { lotId } = useParams() as { lotId: string };
    const [loading, setLoading] = useState(true);
    const [lot, setLot] = useState<Lot | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!lotId) return;

        const fetchLot = async () => {
            try {
                const { data, error: fetchError } = await supabase
                    .from('lots')
                    .select('*')
                    .eq('id', lotId)
                    .single();

                if (fetchError) throw fetchError;
                if (data) {
                    setLot(data as Lot);

                    // If KML data exists, trigger download
                    if (data.kmlData) {
                        const blob = new Blob([data.kmlData], { type: 'application/vnd.google-earth.kml+xml' });
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${data.name || 'campo'}.kml`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                    }
                }
            } catch (err) {
                console.error("Error fetching lot for KML:", err);
                setError("Error al cargar la información del lote.");
            } finally {
                setLoading(false);
            }
        };

        fetchLot();
    }, [lotId]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-600 font-medium">Procesando información del lote...</p>
            </div>
        );
    }

    if (error || !lot) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
                    <div className="text-4xl mb-4">❌</div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Lote no encontrado</h1>
                    <p className="text-slate-600 mb-6">No pudimos encontrar la información necesaria para este código.</p>
                    <Link href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                        Volver al inicio
                    </Link>
                </div>
            </div>
        );
    }

    if (!lot.kmlData) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
                    <div className="text-4xl mb-4">📍</div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Sin mapa disponible</h1>
                    <p className="text-slate-600 mb-2">No se ha cargado un KML para este campo.</p>
                    <p className="text-xs text-slate-400 mb-6">Lote: {lot.name}</p>
                    <Link href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                        Volver al inicio
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6 text-center">
            <div className="bg-white p-8 rounded-2xl shadow-xl border border-slate-100 max-w-md w-full">
                <div className="text-4xl mb-4">✅</div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">KML Descargado</h1>
                <p className="text-slate-600 mb-2">El archivo del mapa se ha descargado correctamente.</p>
                <p className="text-xs text-slate-400 mb-6">Si la descarga no comenzó, verifique los permisos de su navegador.</p>
                <Link href="/" className="inline-block px-6 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors">
                    Volver al inicio
                </Link>
            </div>
        </div>
    );
}
