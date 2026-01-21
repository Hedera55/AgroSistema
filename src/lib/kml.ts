import { kml } from '@tmcw/togeojson';

export const parseKml = (kmlString: string): GeoJSON.FeatureCollection => {
    const parser = new DOMParser();
    const kmlDocument = parser.parseFromString(kmlString, 'text/xml');
    return kml(kmlDocument) as any;
};
