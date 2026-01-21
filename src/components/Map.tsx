'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in Next.js/Leaflet
// @ts-expect-error - Leaflet icon fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapProps {
    geoJsonData?: GeoJSON.FeatureCollection | null;
    className?: string;
    center?: [number, number];
    zoom?: number;
}

function MapController({ data, zoomTrigger }: { data?: GeoJSON.FeatureCollection | null; zoomTrigger?: number }) {
    const map = useMap();

    useEffect(() => {
        map.invalidateSize();
    }, [map]);

    useEffect(() => {
        if (data && data.features.length > 0 && zoomTrigger && zoomTrigger > 0) {
            const geoJsonLayer = L.geoJSON(data);
            const bounds = geoJsonLayer.getBounds();
            if (bounds.isValid()) {
                map.fitBounds(bounds);
            }
        }
    }, [zoomTrigger]);

    return null;
}

export default function Map({ geoJsonData, className, center = [-34.6, -58.4], zoom = 10, zoomTrigger }: MapProps & { zoomTrigger?: number }) {
    // Argentina default center ~Buenos Aires

    return (
        <MapContainer
            center={center}
            zoom={zoom}
            scrollWheelZoom={true}
            className={`h-full w-full rounded-lg z-0 ${className}`}
        >
            <TileLayer
                attribution='&copy; Google'
                url="https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}"
            />
            {geoJsonData && (
                <GeoJSON
                    key={JSON.stringify(geoJsonData)}
                    data={geoJsonData}
                    style={{
                        color: '#fbbf24', // Amber/Yellow
                        weight: 3,
                        fillOpacity: 0.2,
                        fillColor: '#fbbf24'
                    }}
                />
            )}
            <MapController data={geoJsonData} zoomTrigger={zoomTrigger} />
        </MapContainer>
    );
}
