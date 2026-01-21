'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/services/db';
import { Farm, Lot } from '@/types';
import DynamicMap from '@/components/DynamicMap';

interface MapLayer {
    id: string;
    name: string;
    type: 'farm' | 'lot';
    data: any;
}

export default function LotMapPage({ params }: { params: Promise<{ id: string, farmId: string, lotId: string }> }) {
    const { id, farmId, lotId } = use(params);
    const [currentLot, setCurrentLot] = useState<Lot | null>(null);
    const [allLayers, setAllLayers] = useState<MapLayer[]>([]);
    const [selectedLayerIds, setSelectedLayerIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch current lot
                const lotData = await db.get('lots', lotId);
                if (lotData) {
                    setCurrentLot(lotData);
                    setSelectedLayerIds(new Set([lotId])); // Select current lot by default
                }

                // 2. Fetch all other lots and farms for this client that have boundaries
                const [allFarms, allLots] = await Promise.all([
                    db.getAll('farms'),
                    db.getAll('lots')
                ]);

                const clientFarms = allFarms.filter(f => f.clientId === id && f.boundary);
                const clientLots = allLots.filter(l => {
                    // Find if this lot belongs to a farm of this client
                    const farm = allFarms.find(f => f.id === l.farmId);
                    return farm?.clientId === id && l.boundary;
                });

                const layers: MapLayer[] = [
                    ...clientFarms.map(f => ({ id: f.id, name: `Campo ${f.name}`, type: 'farm' as const, data: f.boundary })),
                    ...clientLots.map(l => ({ id: l.id, name: `Lote ${l.name}`, type: 'lot' as const, data: l.boundary }))
                ];

                setAllLayers(layers);
            } catch (error) {
                console.error('Error fetching map data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, lotId]);

    const toggleLayer = (layerId: string) => {
        const next = new Set(selectedLayerIds);
        if (next.has(layerId)) {
            next.delete(layerId);
        } else {
            next.add(layerId);
        }
        setSelectedLayerIds(next);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
            </div>
        );
    }

    if (!currentLot || !currentLot.boundary) {
        return (
            <div className="p-8 text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Mapa no disponible</h1>
                <p className="text-slate-500 mb-6">No se ha cargado un KML para este lote.</p>
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
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{currentLot.name} - Mapa</h1>
                </div>
            </div>

            <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200 relative">
                <DynamicMap
                    // @ts-ignore
                    geoJsonData={combinedGeoJson}
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
                </div>
            )}
        </div>
    );
}
