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
    const formatNumber = (num: number, maxDecimals: number = 2) => {
        return num.toLocaleString('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxDecimals
        });
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '---';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('es-AR');
    };

    const generateOrderPDF = async (order: Order & { farmName?: string; lotName?: string; campaignName?: string }, client: Client, lots: Lot[] = []) => {
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
        doc.text(isSowing ? `ORDEN DE SIEMBRA #${order.orderNumber || '-'}` : `ORDEN DE TRABAJO #${order.orderNumber || '-'}`, 61, 22, { align: 'left' });

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
                [`FECHA EMISIÓN:`, `${formatDate(order.date)}`],
                [order.isDateRange ? `VENTANA DE APLICACIÓN:` : `FECHA PLANEADA:`, `${appDateDisplay}`],
                [`CAMPAÑA:`, `${order.campaignName || '-'}`],
                [`EMPRESA:`, `${client.name}`]
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
            const qrUrl = `${baseUrl}/public/map/${client.id}?orderId=${order.id}&selected=${order.lotIds?.[0] || order.lotId}`;
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
                    const bags = isMaiz && item.dosage ? formatNumber(item.dosage / 80000) : null;
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
                [`OBSERVACIONES / INSTRUCCIONES ESPECIALES${order.notes ? `\n\n${order.notes}` : ''}`]
            ],
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            styles: { 
                fontSize: 7, 
                fontStyle: 'bold', 
                textColor: 0, 
                cellPadding: order.notes ? 2 : 1.2, 
                lineColor: [150, 150, 150], 
                lineWidth: 0.1 
            }
        });
        lastY = (doc as any).lastAutoTable.finalY + (order.notes ? 10 : 4);

        // Gather lot info
        const lotRows: [string, string][] = [];
        (order.lotIds || []).forEach((id, index) => {
            const l = lots.find(x => x.id === id);
            const lotName = l ? l.name : id;
            const partialHa = order.lotHectares?.[id];
            const totalHa = l?.hectares;
            let haStr = `${formatNumber(totalHa || 0)} ha`;

            if (partialHa && partialHa < (totalHa || 0)) {
                haStr = `${formatNumber(partialHa)} / ${formatNumber(totalHa || 0)} ha`;
            } else if (partialHa) {
                haStr = `${formatNumber(partialHa)} ha`;
            }

            if (index === 0) {
                lotRows.push(['Lotes:', '']);
            }
            lotRows.push([lotName, haStr]);
        });

        const totalAreaValue = (order as any).totalHectares || (order as any).hectares || order.treatedArea || 0;
        lotRows.push([`SUPERFICIE TOTAL (HA):`, `${formatNumber(totalAreaValue)}`]);

        autoTable(doc, {
            head: [
                [{ content: "UBICACIÓN", colSpan: 2, styles: { halign: 'left', fillColor: [230, 245, 240], textColor: 0, fontStyle: 'bold', lineColor: [0, 0, 0], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 5, right: 2 } } }]
            ],
            body: [
                ["Campo:", `${order.farmName || '-'}`],
                ...lotRows
            ],
            startY: lastY,
            theme: 'grid',
            tableWidth: pageWidth - 28,
            margin: { left: 14, right: 14 },
            styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: {
                0: { fontStyle: 'bold', cellWidth: 45 },
                1: { cellWidth: 'auto' }
            },
            didParseCell: (data) => {
                const isLotHeader = data.row.index === 1 && data.column.index === 0 && data.cell.text[0] === 'Lotes:';
                const isLotRow = data.row.index > 0 && data.row.index <= lotRows.length;
                
                if (isLotRow && !isLotHeader) {
                    data.cell.styles.fontStyle = 'normal';
                }

                if (isLotRow) {
                    const isFirstCol = data.column.index === 0;
                    const isLastCol = data.column.index === 1;
                    const isLastLot = data.row.index === lotRows.length;

                    data.cell.styles.lineWidth = {
                        top: 0,
                        bottom: isLastLot ? 0.1 : 0,
                        left: isFirstCol ? 0.1 : 0,
                        right: isLastCol ? 0.1 : 0
                    } as any;
                }
            }
        });
        lastY = (doc as any).lastAutoTable.finalY + 10;

        // Responsable Tecnico Box (Left side)
        const respWidth = pageWidth - 28;
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(255, 255, 255);
        doc.setLineWidth(0.1);
        doc.rect(14, lastY, respWidth, 16, 'FD');

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(0);
        doc.text("RESPONSABLE TÉCNICO: ", 16, lastY + 6);
 
        doc.setFont("helvetica", "normal");
        doc.text(order.technicalResponsible || '-', 58, lastY + 6);

        doc.setFont("helvetica", "bold");
        doc.text("CONTRATISTA - CUIT:", 16, lastY + 12);

        doc.setFont("helvetica", "normal");
        const contractorText = `${order.applicatorName || '-'}${applicatorCUIT ? ` - ${applicatorCUIT}` : ''}`;
        doc.text(contractorText, 58, lastY + 12);

        // Signatures removed as per request

        doc.save(`Orden_${isSowing ? 'Siembra' : 'Trabajo'}_${order.orderNumber || ''}.pdf`);
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
                [`${order.type === 'SOWING' ? 'ORDEN DE SIEMBRA:' : 'ORDEN DE TRABAJO:'}`, `${order.orderNumber || '-'}`],
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
        const tableColumn = ["GALPÓN", "PRODUCTO", "PRESENTACIÓN - CANTIDAD", "CANTIDAD TOTAL"];
        const tableRows: any[] = [];
        const formatCell = (val: string | number) => `${val}`;

        // Summary structure
        const productSummaries: Record<string, {
            name: string;
            required: number;
            loaded: number;
            unit: string;
        }> = {};

        const warehouses = Array.from(new Set(order.items.map(i => i.warehouseName || 'S/G')));
        warehouses.forEach(wh => {
            const whItems = order.items.filter(i => (i.warehouseName || 'S/G') === wh);
            whItems.forEach((item, idx) => {
                let nameDisplay = '';
                if (item.productType === 'SEED') {
                    const parts = [item.commercialName, item.brandName].filter(Boolean);
                    const parentheses = parts.length > 0 ? ` (${parts.join(' - ')})` : '';
                    nameDisplay = `${item.productName}${parentheses}`;
                } else {
                    nameDisplay = `${item.commercialName || item.productName}${item.activeIngredient ? ` (${item.activeIngredient})` : ''}`;
                }

                // Update summary
                const key = `${item.productName}_${item.unit}`;
                if (!productSummaries[key]) {
                    productSummaries[key] = {
                        name: item.productName,
                        required: (item.dosage || 0) * (order.treatedArea || (order as any).hectares || 0),
                        loaded: 0,
                        unit: item.unit
                    };
                }
                if (!item.isVirtualDéficit) {
                    productSummaries[key].loaded += item.totalQuantity;
                }

                const basePres = item.isVirtualDéficit ? 'SIN ELEGIR' : (`${item.presentationLabel || `A granel`} ${item.presentationContent ? `(${item.presentationContent}${item.unit})` : ''}`);
                const cantPres = item.isVirtualDéficit 
                    ? '' 
                    : (item.multiplier ? ` x ${formatNumber(item.multiplier)}` : '');

                const combinedPres = item.isVirtualDéficit ? 'SIN ELEGIR' : `${basePres}${cantPres}`;

                const totalStr = item.isVirtualDéficit 
                    ? `---`
                    : `${formatNumber(item.totalQuantity)} ${item.unit}`;

                tableRows.push([
                    formatCell(idx === 0 ? wh : ''),
                    formatCell(nameDisplay),
                    formatCell(combinedPres),
                    formatCell(totalStr)
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
            alternateRowStyles: { fillColor: [240, 248, 245] },
            columnStyles: { 0: { cellWidth: 25 }, 1: { cellWidth: 50 }, 2: { cellWidth: 60 }, 3: { cellWidth: 47 } }
        });

        lastY = (doc as any).lastAutoTable.finalY + 12;

        // --- Summary Tables per Product ---
        Object.values(productSummaries).forEach(summary => {
            // Product Title
            doc.setFont("helvetica", "bold");
            doc.setFontSize(9);
            doc.setTextColor(0);
            doc.text(summary.name.toUpperCase(), 14, lastY);
            lastY += 4;

            const diff = summary.loaded - summary.required;
            const absDiff = Math.abs(diff);
            const plural = absDiff > 1 ? 'n' : '';
            let statusText = '';
            // Match exactly with user request: "Faltan/Sobran XX kg" (plural if > 1)
            if (absDiff < 0.01) {
                statusText = 'Carga exacta';
            } else if (diff > 0) {
                statusText = `Sobra${plural} ${formatNumber(absDiff)} ${summary.unit}`;
            } else {
                statusText = `Falta${plural} ${formatNumber(absDiff)} ${summary.unit}`;
            }

            autoTable(doc, {
                body: [
                    [`Cantidad requerida para el trabajo: ${formatNumber(summary.required)} ${summary.unit}`],
                    [statusText]
                ],
                startY: lastY,
                theme: 'grid',
                tableWidth: 100, // Compact table
                margin: { left: 14 },
                styles: { fontSize: 8, cellPadding: 2, textColor: 0, lineColor: [0, 0, 0], lineWidth: 0.1 },
                columnStyles: { 0: { fontStyle: 'bold' } },
                didParseCell: (data) => {
                    if (data.row.index === 1) {
                         data.cell.styles.textColor = diff < -0.01 ? [200, 0, 0] : [0, 100, 0];
                    }
                }
            });

            lastY = (doc as any).lastAutoTable.finalY + 10;
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
                    ? `${formatNumber(item.multiplier)} ${item.presentationLabel ? 'uds' : item.unit}`
                    : (item.quantity ? `${formatNumber(item.quantity)} ${item.unit}` : `${formatNumber(item.totalQuantity || 0)} ${item.unit}`))
            ]);
        } else {
            const m = source as InventoryMovement;
            itemsForTable = [[
                formatCell(m.productCommercialName || m.productName),
                formatCell((m as any).presentationLabel || `A granel (${m.unit})`),
                formatCell(`${formatNumber(m.quantity)} ${m.unit}`)
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
