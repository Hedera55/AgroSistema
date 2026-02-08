'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { db } from '@/services/db';
import { Farm, Lot } from '@/types';
import DynamicMap from '@/components/DynamicMap';

interface MapLayer {
    id: string;
    name: string;
    type: 'farm' | 'lot';
    data: any;
    kmlData?: string;
}

// Helper to combine multiple KML documents into one
const combineKmlDocuments = (layers: MapLayer[]): string => {
    const placemarks = layers
        .filter(l => l.kmlData)
        .map(l => {
            // Extract content between <Document> tags if present, otherwise use the whole thing
            const match = l.kmlData!.match(/<Document[^>]*>([\s\S]*?)<\/Document>/i);
            if (match) {
                return match[1];
            }
            // Try to extract just Placemark elements
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

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const searchParams = useSearchParams();
    const selectedId = searchParams.get('selected'); // ID of the pre-selected layer

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
                const [allFarms, allLots] = await Promise.all([
                    db.getAll('farms'),
                    db.getAll('lots')
                ]);

                const clientFarms = allFarms.filter((f: Farm) => f.clientId === id && f.boundary);
                const clientLots = allLots.filter((l: Lot) => {
                    const farm = allFarms.find((f: Farm) => f.id === l.farmId);
                    return farm?.clientId === id && l.boundary;
                });

                const layers: MapLayer[] = [
                    ...clientFarms.map((f: Farm) => ({ id: f.id, name: `Campo ${f.name}`, type: 'farm' as const, data: f.boundary, kmlData: f.kmlData })),
                    ...clientLots.map((l: Lot) => ({ id: l.id, name: `Lote ${l.name}`, type: 'lot' as const, data: l.boundary, kmlData: l.kmlData }))
                ];

                setAllLayers(layers);

                // Pre-select the layer if specified in query params
                if (selectedId && layers.some(l => l.id === selectedId)) {
                    setSelectedLayerIds(new Set([selectedId]));
                    // Trigger initial zoom when coming from "Ver mapa" link
                    setZoomTrigger(1);
                } else if (layers.length > 0) {
                    // If no selection or invalid selection, select the first layer
                    setSelectedLayerIds(new Set([layers[0].id]));
                    // Also zoom to first layer on initial load
                    setZoomTrigger(1);
                }
            } catch (error) {
                console.error('Error fetching map data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, selectedId]);

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
        a.download = `capas_${new Date().toISOString().split('T')[0]}.kml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const hasDownloadableKml = allLayers.some(l => selectedLayerIds.has(l.id) && l.kmlData);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (allLayers.length === 0) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Mapa no disponible</h1>
                <p className="text-slate-500 mb-6">No hay KMLs cargados para este cliente.</p>
                <Link href={`/clients/${id}/fields`} className="text-emerald-600 hover:underline">← Volver a Campos</Link>
            </div>
        );
    }

    // Combine selected layers into a single FeatureCollection for the map
    const combinedGeoJson = {
        type: 'FeatureCollection',
        features: allLayers
            .filter(l => selectedLayerIds.has(l.id))
            .flatMap(l => {
                try {
                    const data = typeof l.data === 'string' ? JSON.parse(l.data) : l.data;
                    if (!data) return [];

                    // Handle both FeatureCollection and single Feature
                    if (data.type === 'FeatureCollection' && data.features) {
                        return data.features;
                    } else if (data.type === 'Feature') {
                        return [data];
                    }
                    return [];
                } catch (error) {
                    console.error(`Error parsing layer ${l.name}:`, error);
                    return [];
                }
            })
    };

    console.log('Selected layers:', Array.from(selectedLayerIds));
    console.log('Combined GeoJSON features count:', combinedGeoJson.features.length);

    return (
        <div className="flex flex-col h-[calc(100vh-120px)] space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <Link href={`/clients/${id}/fields`} className="text-sm text-slate-500 hover:text-emerald-600 mb-1 inline-block">← Volver a Campos</Link>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mapa</h1>
                </div>
                <button
                    onClick={handleDownloadKml}
                    disabled={!hasDownloadableKml}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${hasDownloadableKml
                        ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    title={hasDownloadableKml ? 'Descargar KML de capas seleccionadas' : 'No hay KML disponible'}
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

            {allLayers.length > 0 && (
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
                                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                            />
                            <span className="text-sm font-medium text-slate-700">{layer.name}</span>
                        </label>
                    ))}
                    <button
                        onClick={handleZoom}
                        className="px-4 py-1.5 bg-emerald-600 text-white text-sm font-semibold rounded hover:bg-emerald-700 transition-colors"
                    >
                        Zoom
                    </button>
                </div>
            )}
        </div>
    );
}
