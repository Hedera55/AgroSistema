'use client';

import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import DynamicMap from '@/components/DynamicMap';

interface MapLayer {
    id: string;
    name: string;
    type: 'farm' | 'lot' | 'order';
    data: any;
    kmlData?: string;
}

// Helper to combine multiple KML documents into one
const combineKmlDocuments = (layers: MapLayer[]): string => {
    const placemarks = layers
        .filter(l => l.kmlData)
        .map(l => {
            const match = l.kmlData!.match(/<Document[^>]*>([\s\S]*?)<\/Document>/i);
            if (match) return match[1];
            const placemarkMatch = l.kmlData!.match(/<Placemark[\s\S]*?<\/Placemark>/gi);
            return placemarkMatch ? placemarkMatch.join('\n') : '';
        })
        .filter(Boolean)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Capas Exportadas</name>
${placemarks}
  </Document>
</kml>`;
};

export default function PublicMapPage({ params }: { params: Promise<{ clientId: string }> }) {
    const { clientId } = use(params);
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('selected');
    const orderId = searchParams.get('orderId');

    const [allLayers, setAllLayers] = useState<MapLayer[]>([]);
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [zoomTrigger, setZoomTrigger] = useState(0);

    const handleZoom = () => {
        setZoomTrigger(prev => prev + 1);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [farmsRes, lotsRes] = await Promise.all([
                    supabase.from('farms').select('*').eq('client_id', clientId).eq('deleted', false),
                    supabase.from('lots').select('*').eq('client_id', clientId).eq('deleted', false)
                ]);

                if (farmsRes.error) throw farmsRes.error;
                if (lotsRes.error) throw lotsRes.error;

                const farms = (farmsRes.data || []).map(f => ({
                    id: f.id,
                    name: f.name,
                    boundary: f.boundary,
                    kmlData: f.kml_data
                }));
                const lots = (lotsRes.data || []).map(l => ({
                    id: l.id,
                    name: l.name,
                    boundary: l.boundary,
                    kmlData: l.kml_data
                }));

                const layers: MapLayer[] = [
                    ...farms.filter(f => f.boundary).map(f => ({ id: f.id, name: `Campo ${f.name}`, type: 'farm' as const, data: f.boundary, kmlData: f.kmlData })),
                    ...lots.filter(l => l.boundary).map(l => ({ id: l.id, name: `Lote ${l.name}`, type: 'lot' as const, data: l.boundary, kmlData: l.kmlData }))
                ];

                if (orderId) {
                    const { data: orderData, error: orderError } = await supabase
                        .from('orders')
                        .select('*')
                        .eq('id', orderId)
                        .single();
                    
                    if (!orderError && orderData && orderData.boundary) {
                        layers.unshift({
                            id: orderData.id,
                            name: `Orden #${orderData.order_number || ''}`,
                            type: 'order' as const,
                            data: orderData.boundary,
                            kmlData: orderData.kml_data
                        });
                    }
                }

                setAllLayers(layers);

                if (orderId && layers.some(l => l.id === orderId)) {
                    setSelectedLayerIds(new Set([orderId]));
                    setZoomTrigger(1);
                } else if (selectedId && layers.some(l => l.id === selectedId)) {
                    setSelectedLayerIds(new Set([selectedId]));
                    setZoomTrigger(1);
                } else if (layers.length > 0) {
                    setSelectedLayerIds(new Set([layers[0].id]));
                    setZoomTrigger(1);
                }
            } catch (error: any) {
                console.error('Error fetching public map data:', error?.message || error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clientId, selectedId, orderId]);

    const toggleLayer = (layerId: string) => {
        const next = new Set(selectedLayerIds);
        if (next.has(layerId)) {
            next.delete(layerId);
        } else {
            next.add(layerId);
        }
        setSelectedLayerIds(next);
    };

    const handleDownloadKml = () => {
        const selectedLayers = allLayers.filter(l => selectedLayerIds.has(l.id) && l.kmlData);
        if (selectedLayers.length === 0) {
            alert('No hay capas con KML disponible para descargar.');
            return;
        }

        const combinedKml = combineKmlDocuments(selectedLayers);
        const blob = new Blob([combinedKml], { type: 'application/vnd.google-earth.kml+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mapa_publico_${new Date().toISOString().split('T')[0]}.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const hasDownloadableKml = allLayers.some(l => selectedLayerIds.has(l.id) && l.kmlData);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Cargando Mapa...</p>
            </div>
        );
    }

    if (allLayers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center">
                <div className="text-4xl mb-4">🗺️</div>
                <h1 className="text-xl font-bold text-slate-900 mb-2">Mapa no disponible</h1>
                <p className="text-slate-500 text-sm">No se encontraron límites geográficos para este cliente.</p>
            </div>
        );
    }

    const combinedGeoJson = {
        type: 'FeatureCollection',
        features: allLayers
            .filter(l => selectedLayerIds.has(l.id))
            .flatMap(l => {
                try {
                    const data = typeof l.data === 'string' ? JSON.parse(l.data) : l.data;
                    if (!data) return [];
                    if (data.type === 'FeatureCollection' && data.features) return data.features;
                    if (data.type === 'Feature') return [data];
                    return [];
                } catch (error) {
                    return [];
                }
            })
    };

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mapa</h1>
                <button
                    onClick={handleDownloadKml}
                    disabled={!hasDownloadableKml}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                        hasDownloadableKml
                            ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-md'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title="Descargar KML de capas seleccionadas"
                >
                    Descargar KML
                </button>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 relative">
                <DynamicMap
                    // @ts-ignore
                    geoJsonData={combinedGeoJson}
                    zoomTrigger={zoomTrigger}
                    className="h-full w-full"
                />
            </div>

            <div className="flex flex-wrap gap-3">
                {allLayers.map(layer => (
                    <label
                        key={layer.id}
                        className="flex items-center gap-2 cursor-pointer hover:text-emerald-600 transition-colors"
                    >
                        <input
                            type="checkbox"
                            checked={selectedLayerIds.has(layer.id)}
                            onChange={() => toggleLayer(layer.id)}
                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 transition-all cursor-pointer"
                        />
                        <span className="text-sm font-medium text-slate-700 transition-colors">
                            {layer.name}
                        </span>
                    </label>
                ))}
                <button
                    onClick={handleZoom}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700 transition-colors active:scale-95 shadow-sm"
                >
                    Zoom
                </button>
            </div>
        </div>
    );
}
