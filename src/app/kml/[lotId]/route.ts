import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use service-role client to bypass RLS (this route has no authenticated user)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(
    request: Request,
    { params }: { params: Promise<{ lotId: string }> }
) {
    const { lotId } = await params;

    if (!lotId) {
        return new NextResponse('Missing lotId', { status: 400 });
    }

    if (!process.env.SUPABASE_SERVICE_KEY) {
        console.error("CRITICAL: SUPABASE_SERVICE_KEY is missing!");
        return new NextResponse('Error de configuración del servidor', { status: 500 });
    }

    try {
        // 1. Fetch Lot
        const { data: lotData, error: lotError } = await supabase
            .from('lots')
            .select('*, farms(*)')
            .eq('id', lotId)
            .single();

        if (lotError || !lotData) {
            console.error("Error fetching lot for KML:", lotError);
            const htmlError = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Lote no encontrado</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; margin: 0; text-align: center; padding: 20px; }
                    .card { background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); max-width: 400px; width: 100%; box-sizing: border-box; border: 1px solid #f1f5f9; }
                    h1 { color: #0f172a; margin-top: 10px; margin-bottom: 5px; font-size: 1.25rem; font-weight: 700; }
                    p { color: #475569; margin-bottom: 25px; font-size: 0.95rem; line-height: 1.5; }
                    .icon { font-size: 3.5rem; margin-bottom: 10px; }
                    .btn { display: inline-block; padding: 10px 24px; background: #059669; color: white; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 0.95rem; }
                    .btn:hover { background: #047857; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Lote no encontrado</h1>
                    <p>No pudimos encontrar la información necesaria para este código.</p>
                    <a href="/" class="btn">Volver al inicio</a>
                </div>
            </body>
            </html>
            `;
            return new NextResponse(htmlError, {
                status: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        // 2. Check for KML (Lot or Farm fallback)
        let kmlContent = lotData.kml_data;
        let finalFileName = `${lotData.name || 'campo'}.kml`;

        if (!kmlContent && lotData.farms?.kml_data) {
            console.info(`Lot ${lotId} has no KML, falling back to Farm KML for ${lotData.farms.name}`);
            kmlContent = lotData.farms.kml_data;
            finalFileName = `${lotData.farms.name || 'campo'}_general.kml`;
        }

        if (!kmlContent) {
            console.warn(`No KML data found for Lot ${lotId} (Name: ${lotData.name}) or its Farm.`);
            const htmlNoMap = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Sin mapa disponible</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f8fafc; margin: 0; text-align: center; padding: 20px; }
                    .card { background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); max-width: 400px; width: 100%; box-sizing: border-box; border: 1px solid #f1f5f9; }
                    h1 { color: #0f172a; margin-top: 10px; margin-bottom: 5px; font-size: 1.25rem; font-weight: 700; }
                    p { color: #475569; margin-bottom: 25px; font-size: 0.95rem; line-height: 1.5; }
                    .lot-name { color: #94a3b8; font-size: 0.8rem; margin-bottom: 25px; margin-top: -15px; }
                    .info-box { background: #f1f5f9; padding: 10px; border-radius: 8px; font-size: 0.75rem; text-align: left; color: #64748b; margin-bottom: 25px; overflow-x: auto; }
                    .btn { display: inline-block; padding: 10px 24px; background: #059669; color: white; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 0.95rem; }
                    .btn:hover { background: #047857; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Sin mapa disponible</h1>
                    <p>No se ha cargado un KML para este campo.</p>
                    <div class="lot-name">Lote: ${lotData.name || 'Desconocido'}</div>
                    <div class="info-box">
                        ID: ${lotId}<br>
                        Farm: ${lotData.farms?.name || 'N/A'}<br>
                        Status: ${lotData.status}<br>
                        Has Farm KML: ${!!lotData.farms?.kml_data}
                    </div>
                    <a href="/" class="btn">Volver al inicio</a>
                </div>
            </body>
            </html>
            `;
            return new NextResponse(htmlNoMap, {
                status: 404,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
            });
        }

        return new NextResponse(kmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.google-earth.kml+xml',
                'Content-Disposition': `attachment; filename="${finalFileName}"`,
            },
        });
    } catch (err) {
        console.error("Unexpected error serving KML:", err);
        return new NextResponse('Error interno del servidor', { status: 500 });
    }
}
