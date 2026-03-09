import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Order, OrderItem, Client, InventoryMovement, UserProfile, Lot } from '@/types';
import { supabase } from '@/lib/supabase';

// Augment jsPDF type for autoTable
interface AutoTableUserOptions {
    head: string[][];
    body: (string | number)[][];
    startY: number;
}
declare module 'jspdf' {
    interface jsPDF {
        autoTable: (options: AutoTableUserOptions) => jsPDF; // Simplified
    }
}

export function usePDF() {

    // Helper for Argentine number formatting
    const formatNumber = (num: number, decimals: number = 2) => {
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-AR');
    };

    const generateOrderPDF = async (order: Order & { farmName?: string; lotName?: string }, client: Client, lots: Lot[] = []) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const emeraldGreen: [number, number, number] = [4, 120, 87];

        let applicatorCUIT = '';
        if (order.applicatorId) {
            try {
                const { data } = await supabase.from('profiles').select('cuit').eq('id', order.applicatorId).single();
                if (data) applicatorCUIT = data.cuit || '';
            } catch (err) {
                console.error("Error fetching applicator profile:", err);
            }
        }

        // --- 1. Header (Open Style) ---
        // Row 1: Logo & Title & QR
        doc.setFillColor(220, 220, 220); // Placeholder logo box
        doc.rect(14, 12, 12, 12, 'F');

        doc.setFont("helvetica", "bold");
        const darkEmerald: [number, number, number] = [12, 138, 82]; // #0c8a52
        doc.setTextColor(...darkEmerald);
        doc.setFontSize(22);
        const isSowing = order.items.some(i => i.productType === 'SEED');
        doc.text(isSowing ? "ORDEN DE SIEMBRA" : "ORDEN DE CARGA", 61, 22, { align: 'left' });

        // Row 2: Antigravity text, Contact Info & Metadata
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...emeraldGreen);
        doc.setFontSize(22);
        doc.text("Antigravity", 14, 34);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.setFontSize(8);
        doc.text("ANTIGRAVITY S.A.", 14, 42);
        doc.setFont("helvetica", "normal");
        doc.text("CUIT: 30-71456789-2", 14, 45);
        doc.text("Tel: +54 236 444-1234", 14, 48);
        doc.text("contacto@antigravity.com.ar", 14, 51);

        doc.setTextColor(40);
        const appDateDisplay = order.isDateRange
            ? `${formatDate(order.applicationStart)} al ${formatDate(order.applicationEnd)}`
            : formatDate(order.applicationDate);

        autoTable(doc, {
            body: [
                [`FECHA:`, `${formatDate(order.date)}`],
                [`ORDEN NRO:`, `${order.orderNumber || '-'}`],
                [`CLIENTE:`, `${client.name}`],
                [`SOLICITANTE:`, `${client.name}`]
            ],
            startY: 32,
            margin: { left: 61 },
            theme: 'grid',
            styles: {
                fontSize: 8,
                cellPadding: 0.8,
                textColor: 0,
                lineColor: [0, 0, 0],
                lineWidth: 0.2
            },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [230, 245, 240], cellWidth: 28 },
                1: { cellWidth: 55 }
            }
        });

        // Right: QR Code + Text
        try {
            const baseUrl = window.location.origin;
            const qrUrl = `${baseUrl}/kml/${order.lotIds?.[0] || order.lotId}`;
            const qrDataUrl = await QRCode.toDataURL(qrUrl);
            doc.addImage(qrDataUrl, 'PNG', pageWidth - 42, 14, 30, 30);
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text("KML del lote", pageWidth - 27, 47, { align: 'center' });
        } catch (qrErr) {
            console.error("Error generating QR:", qrErr);
        }

        let lastY = (doc as any).lastAutoTable.finalY + 10;
        if (lastY < 68) lastY = 68; // Ensure it clears the header area

        // --- 2. Main Product Tables ---
        const containsSeeds = order.items.some(i => i.productType === 'SEED');

        // Helper to formatting cell
        const formatCell = (val: string | number) => `${val}`;

        if (containsSeeds) {
            const seedItems = order.items.filter(i => i.productType === 'SEED');
            const otherItems = order.items.filter(i => i.productType !== 'SEED');

            // Seeds Table
            if (seedItems.length > 0) {
                const seedColumns = ["CULTIVO", "NOMBRE COMERCIAL (MARCA)", "DISTRIBUCIÓN", "TOTAL"];
                const seedRows = seedItems.map(item => {
                    const isMaiz = item.productName.toUpperCase().includes('MAIZ');
                    const bags = isMaiz && item.dosage ? (item.dosage / 80000).toFixed(2) : null;
                    let distrib = `${formatNumber(item.dosage)} ${item.unit}/ha`;
                    if (bags) distrib += ` (${bags} bolsas)`;
                    if (item.plantingSpacing) distrib += `\nEspaciamiento: ${formatNumber(item.plantingSpacing)} cm`;

                    return [
                        formatCell(item.productName),
                        formatCell(`${item.commercialName || '-'}${item.brandName ? ` (${item.brandName})` : ''}`),
                        formatCell(distrib),
                        formatCell(`${formatNumber(item.totalQuantity)} ${item.unit}`)
                    ];
                });

                // Pad rows to look like a full form (minimum 4 rows)
                while (seedRows.length < 4) seedRows.push(['', '', '', '']);

                autoTable(doc, {
                    head: [seedColumns],
                    body: seedRows,
                    startY: lastY,
                    theme: 'grid',
                    tableWidth: pageWidth - 28,
                    margin: { left: 14, right: 14 },
                    headStyles: { fillColor: darkEmerald, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
                    styles: { fontSize: 8, cellPadding: 2, textColor: 60, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
                    alternateRowStyles: { fillColor: [240, 248, 245] },
                    bodyStyles: { fillColor: [220, 238, 230] },
                    columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 65 }, 2: { cellWidth: 52 }, 3: { cellWidth: 35 } }
                });
                lastY = (doc as any).lastAutoTable.finalY + 0;
            }

            // Chemicals Table
            if (otherItems.length > 0) {
                const otherColumns = ["NOMBRE COMERCIAL", "INGREDIENTE ACTIVO", "MARCA", "DOSIS", "CANTIDAD TOTAL"];
                const otherRows = otherItems.map(item => {
                    let dosageStr = `${formatNumber(item.dosage)} ${item.unit}/ha`;
                    if (item.fertilizerPlacement) dosageStr += ` - ${item.fertilizerPlacement === 'LINE' ? 'En línea' : 'Al costado'}`;
                    return [
                        formatCell(item.commercialName || item.productName || '-'),
                        formatCell(item.activeIngredient || '-'),
                        formatCell(item.brandName || '-'),
                        formatCell(dosageStr),
                        formatCell(`${formatNumber(item.totalQuantity)} ${item.unit}`)
                    ];
                });

                // Pad rows to look like a full form
                while (otherRows.length < 8) otherRows.push(['', '', '', '', '']);

                autoTable(doc, {
                    head: [otherColumns],
                    body: otherRows,
                    startY: lastY,
                    theme: 'grid',
                    tableWidth: pageWidth - 28,
                    margin: { left: 14, right: 14 },
                    headStyles: { fillColor: darkEmerald, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
                    styles: { fontSize: 8, cellPadding: 2, textColor: 60, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
                    alternateRowStyles: { fillColor: [240, 248, 245] },
                    bodyStyles: { fillColor: [220, 238, 230] },
                    columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 45 }, 2: { cellWidth: 35 }, 3: { cellWidth: 30 }, 4: { cellWidth: 32 } }
                });
                lastY = (doc as any).lastAutoTable.finalY + 0;
            }
        } else {
            // SPRAYING ORDER
            const tableColumn = ["NOMBRE COMERCIAL", "INGREDIENTE ACTIVO", "MARCA", "DOSIS", "CANTIDAD TOTAL"];
            const tableRows = order.items.map(item => [
                formatCell(item.commercialName || item.productName || '-'),
                formatCell(item.activeIngredient || '-'),
                formatCell(item.brandName || '-'),
                formatCell(`${formatNumber(item.dosage)} ${item.unit}/ha`),
                formatCell(`${formatNumber(item.totalQuantity)} ${item.unit}`)
            ]);

            // Add empty rows to match the look of the form
            for (let i = tableRows.length; i < 8; i++) {
                tableRows.push([formatCell("    "), formatCell("    "), formatCell("    "), formatCell("    "), formatCell("    ")]);
            }

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: lastY,
                theme: 'grid',
                tableWidth: pageWidth - 28,
                margin: { left: 14, right: 14 },
                headStyles: { fillColor: darkEmerald, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
                styles: { fontSize: 8, cellPadding: 2, textColor: 60, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
                bodyStyles: { fillColor: [235, 245, 240] },
                alternateRowStyles: { fillColor: [215, 235, 225] },
                columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 45 }, 2: { cellWidth: 35 }, 3: { cellWidth: 30 }, 4: { cellWidth: 32 } }
            });
            lastY = (doc as any).lastAutoTable.finalY + 0;
        }

        // --- 3. Footer Sequence ---
        // Observaciones box (attached closely below table)
        autoTable(doc, {
            body: [
                [`OBSERVACIONES / INSTRUCCIONES ESPECIALES\n\n${order.notes || ''}`]
            ],
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            styles: { fontSize: 7, fontStyle: 'bold', textColor: 0, cellPadding: 2, lineColor: [150, 150, 150], lineWidth: 0.1 }
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;

        // Ubicacion de Aplicacion
        // Gather lot info
        let lotsDisplay = order.lotIds && order.lotIds.length > 0 ? order.lotIds.map(id => {
            const l = lots.find(x => x.id === id);
            return l ? l.name : id;
        }).join(', ') : (order.lotName || '-');

        autoTable(doc, {
            head: [
                [{ content: "UBICACIÓN DE APLICACIÓN", colSpan: 2, styles: { halign: 'left', fillColor: [230, 245, 240], textColor: 0, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 5, right: 2 } } }]
            ],
            body: [
                ["CAMPO:", `${order.farmName || '-'}`],
                ["UBICACIÓN GPS:", `-`], // Placeholder
                ["LOTE(S):", `${lotsDisplay}`],
                ["SUPERFICIE TOTAL (HA):", `${formatNumber(order.treatedArea || 0, 1)}`]
            ],
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 45 },
                1: { cellWidth: 'auto' }
            }
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;

        // Responsable Tecnico Box (Left side)
        const respWidth = pageWidth - 28;
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.1);
        doc.rect(14, lastY, respWidth, 20, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.text("RESPONSABLE TÉCNICO DE PRESCRIPCIÓN", 16, lastY + 5);
        doc.setFont("helvetica", "normal");
        doc.text("NOMBRE:", 16, lastY + 11);
        doc.text("REGISTRO:", 16, lastY + 17);

        // Signatures (Bottom)
        const sigY = lastY + 45;

        // Firma Antigravity
        doc.setDrawColor(150);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(20, sigY, 90, sigY);
        doc.setLineDashPattern([], 0); // reset
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("FIRMA RESPONSABLE DE CARGA (ANTIGRAVITY)", 55, sigY + 4, { align: 'center' });

        // Firma Aplicador/Contratista
        doc.setLineDashPattern([1, 1], 0);
        doc.line(120, sigY, 190, sigY);
        doc.setLineDashPattern([], 0); // reset
        const rightSigText = isSowing ? "FIRMA CONTRATISTA / SEMBRADOR" : "FIRMA CONTRATISTA / APLICADOR";
        doc.text(rightSigText, 155, sigY + 4, { align: 'center' });

        doc.save(`Orden_${isSowing ? 'Siembra' : 'Carga'}_${order.orderNumber || ''}.pdf`);
    };

    const generateInsumosPDF = async (order: Order, client: Client) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const emeraldGreen: [number, number, number] = [4, 120, 87];

        // --- Header (Open Style) ---
        const darkEmerald: [number, number, number] = [12, 138, 82];

        // Row 1: Logo & Title
        doc.setFillColor(220, 220, 220); // Placeholder logo box
        doc.rect(14, 12, 12, 12, 'F');

        doc.setFont("helvetica", "bold"); // Ensure bold for title
        doc.setTextColor(...darkEmerald);
        doc.setFontSize(22);
        doc.text("NECESIDAD DE INSUMOS", 61, 22, { align: 'left' });

        // Row 2: Antigravity text, Contact Info & Metadata
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...emeraldGreen);
        doc.setFontSize(22);
        doc.text("Antigravity", 14, 34);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.setFontSize(8);
        doc.text("ANTIGRAVITY S.A.", 14, 42);
        doc.setFont("helvetica", "normal");
        doc.text("CUIT: 30-71456789-2", 14, 45);
        doc.text("Tel: +54 236 444-1234", 14, 48);
        doc.text("contacto@antigravity.com.ar", 14, 51);

        autoTable(doc, {
            body: [
                [`FECHA EMISIÓN:`, `${formatDate(order.date)}`],
                [`ORDEN REF NRO:`, `${order.orderNumber || '-'}`],
                [`CLIENTE:`, `${client.name}`]
            ],
            startY: 32,
            margin: { left: 61 },
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 0.8, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.2 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [230, 245, 240], cellWidth: 35 },
                1: { cellWidth: 50 }
            }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 10;
        if (lastY < 68) lastY = 68; // ensure clearance

        // --- Table ---
        const tableColumn = ["GALPÓN", "PRODUCTO", "PRESENTACIÓN", "CANTIDAD REQUERIDA"];
        const tableRows: any[] = [];
        const formatCell = (val: string | number) => `${val}`;

        const warehouses = Array.from(new Set(order.items.map(i => i.warehouseName || 'S/G')));
        warehouses.forEach(wh => {
            const whItems = order.items.filter(i => (i.warehouseName || 'S/G') === wh);
            whItems.forEach((item, idx) => {
                const nameDisplay = item.productType === 'SEED'
                    ? `${item.productName}${item.brandName ? ` (${item.brandName})` : ''}`
                    : (item.commercialName || item.productName);

                tableRows.push([
                    formatCell(idx === 0 ? wh : ''),
                    formatCell(nameDisplay),
                    formatCell(item.isVirtualDéficit ? 'FALTANTE' : (`${item.presentationLabel || `A granel (${item.unit})`} ${item.presentationContent ? `(${item.presentationContent}${item.unit})` : ''}`)),
                    formatCell(item.isVirtualDéficit ? `Faltan ${formatNumber(item.totalQuantity, 1)}` : (item.multiplier ? formatNumber(item.multiplier, 1) : '-'))
                ]);
            });
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            headStyles: { fillColor: darkEmerald, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
            styles: { fontSize: 8, cellPadding: 2, textColor: 60, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
            alternateRowStyles: { fillColor: [240, 248, 245] }
        });

        doc.save(`Insumos_Orden_${order.orderNumber || ''}.pdf`);
    };

    const generateRemitoPDF = async (source: Order | InventoryMovement, client: Client, warehouseName?: string) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const emeraldGreen: [number, number, number] = [4, 120, 87];

        // --- Header (Open Style) ---
        const darkEmerald: [number, number, number] = [12, 138, 82];

        // Row 1: Logo & Title
        doc.setFillColor(220, 220, 220); // Placeholder logo box
        doc.rect(14, 12, 12, 12, 'F');

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...darkEmerald);
        doc.setFontSize(22);
        doc.text("REMITO", 61, 22, { align: 'left' });

        // Row 2: Antigravity text, Contact Info & Metadata
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...emeraldGreen);
        doc.setFontSize(22);
        doc.text("Antigravity", 14, 34);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.setFontSize(8);
        doc.text("ANTIGRAVITY S.A.", 14, 42);
        doc.setFont("helvetica", "normal");
        doc.text("CUIT: 30-71456789-2", 14, 45);
        doc.text("Tel: +54 236 444-1234", 14, 48);
        doc.text("contacto@antigravity.com.ar", 14, 51);

        const orderNum = (source as Order).orderNumber || (source as InventoryMovement).referenceId || '-';

        autoTable(doc, {
            body: [
                [`FECHA:`, `${formatDate(source.date)}`],
                [`REFERENCIA NRO:`, `${orderNum}`],
                [`CLIENTE:`, `${client.name}`],
                [`GALPÓN / ORIGEN:`, `${warehouseName || 'S/D'}`]
            ],
            startY: 32,
            margin: { left: 61 },
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 0.8, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.2 },
            columnStyles: {
                0: { fontStyle: 'bold', fillColor: [230, 245, 240], cellWidth: 35 },
                1: { cellWidth: 55 }
            }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 10;
        if (lastY < 68) lastY = 68;

        // --- Table ---
        const tableColumn = ["PRODUCTO", "PRESENTACIÓN", "CANTIDAD"];
        const formatCell = (val: string | number) => `${val}`;

        let itemsForTable: any[] = [];
        if (source.items && source.items.length > 0) {
            itemsForTable = source.items.map((item: any) => [
                formatCell(item.commercialName || item.productName || item.productCommercialName || '-'),
                formatCell(item.presentationLabel || `A granel (${item.unit})`),
                formatCell(item.multiplier
                    ? `${formatNumber(item.multiplier, 1)} ${item.presentationLabel ? 'uds' : item.unit}`
                    : (item.quantity ? `${formatNumber(item.quantity, 1)} ${item.unit}` : `${formatNumber(item.totalQuantity || 0, 1)} ${item.unit}`))
            ]);
        } else {
            const m = source as InventoryMovement;
            itemsForTable = [[
                formatCell(m.productCommercialName || m.productName),
                formatCell((m as any).presentationLabel || `A granel (${m.unit})`),
                formatCell(`${formatNumber(m.quantity, 1)} ${m.unit}`)
            ]];
        }

        autoTable(doc, {
            head: [tableColumn],
            body: itemsForTable,
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            headStyles: { fillColor: darkEmerald, textColor: 255, fontSize: 8, fontStyle: 'bold', halign: 'center', lineColor: [0, 0, 0], lineWidth: 0.1 },
            styles: { fontSize: 8, cellPadding: 2, textColor: 60, lineColor: [0, 0, 0], lineWidth: 0.1, valign: 'middle' },
            alternateRowStyles: { fillColor: [240, 248, 245] }
        });

        // Signatures
        const sigY = 250;
        doc.setDrawColor(150);
        doc.setLineDashPattern([1, 1], 0);
        doc.line(20, sigY, 90, sigY);
        doc.setLineDashPattern([], 0); // reset
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40);
        doc.text("RETIRA (FIRMA Y ACLARACIÓN)", 55, sigY + 4, { align: 'center' });

        doc.setLineDashPattern([1, 1], 0);
        doc.line(120, sigY, 190, sigY);
        doc.setLineDashPattern([], 0); // reset
        doc.text("ENTREGA (FIRMA Y ACLARACIÓN)", 155, sigY + 4, { align: 'center' });

        doc.save(`Remito_${client.name}_${orderNum}.pdf`);
    };

    return { generateOrderPDF, generateRemitoPDF, generateInsumosPDF };
}
