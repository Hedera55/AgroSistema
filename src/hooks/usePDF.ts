import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Order, OrderItem, Client, InventoryMovement, UserProfile } from '@/types';
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

    const generateOrderPDF = async (order: Order & { farmName?: string; lotName?: string }, client: Client) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Fetch applicator (contractor) CUIT if exists
        let applicatorCUIT = '';
        if (order.applicatorId) {
            try {
                const { data } = await supabase
                    .from('profiles')
                    .select('cuit')
                    .eq('id', order.applicatorId)
                    .single();
                if (data) applicatorCUIT = data.cuit || '';
            } catch (err) {
                console.error("Error fetching applicator profile:", err);
            }
        }

        // --- Header Section ---
        // QR Code (Top Right)
        let finalQRHeight = 40;
        try {
            const baseUrl = window.location.origin;
            // New logic: Point to a dedicated download/info route
            const qrUrl = `${baseUrl}/kml/${order.lotId}`;
            const qrDataUrl = await QRCode.toDataURL(qrUrl);
            doc.addImage(qrDataUrl, 'PNG', pageWidth - 45, 10, 35, 35);
            doc.setFontSize(7);
            doc.setTextColor(100);
            doc.text("SCAN PARA KML", pageWidth - 27.5, 48, { align: 'center' });
        } catch (qrErr) {
            console.error("Error generating QR:", qrErr);
        }

        // Title and Basic Info
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.setFont("helvetica", "bold");
        doc.text("ORDEN DE TRABAJO", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        doc.text(`Nro: ${order.orderNumber || '-'}`, 14, 28);
        doc.text(`Fecha: ${order.date} ${order.time || ''}`, 45, 28);

        // Metadata Table (Compressed on the left)
        autoTable(doc, {
            body: [
                [`CLIENTE: ${client.name} ${client.cuit ? `(CUIT: ${client.cuit})` : ''}`],
                [`CAMPO: ${order.farmName || 'N/A'}`],
                [`LOTE: ${order.lotName || 'N/A'}`],
                [`SUPERFICIE: ${order.treatedArea} Has`]
            ],
            startY: 32,
            theme: 'plain',
            styles: {
                fontSize: 9,
                cellPadding: 1,
                textColor: 60,
            },
            columnStyles: {
                0: { cellWidth: 140 }
            }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 2;

        // Contratista Section
        if (order.applicatorName) {
            doc.setFontSize(10);
            doc.setTextColor(40);
            doc.setFont("helvetica", "bold");
            doc.text("CONTRATISTA:", 14, lastY + 5);
            doc.setFont("helvetica", "normal");
            doc.text(`${order.applicatorName} ${applicatorCUIT ? `(CUIT: ${applicatorCUIT})` : ''}`, 45, lastY + 5);
            lastY += 10;
        }

        doc.setFontSize(9);
        doc.setTextColor(60);
        doc.text(`Ventana de aplicación: ${order.applicationStart || '-'} al ${order.applicationEnd || '-'}`, 14, lastY + 2);
        lastY += 8;

        // --- Table Section ---
        const tableColumn = ["P.A. / Cultivo", "Nombre Com.", "Marca", "Dosis / Distribución", "Total"];
        const tableRows: (string | number)[][] = [];

        order.items.forEach((item) => {
            let distribDetail = '';

            // Show dosage if available (for application items)
            if (item.dosage && item.dosage > 0) {
                distribDetail = `${item.dosage} ${item.unit}/ha`;
            }

            if (item.plantingDensity || item.plantingSpacing) {
                const parts = [];
                if (item.plantingDensity) parts.push(`Densidad: ${item.plantingDensity} kg/ha`);
                if (item.plantingSpacing) parts.push(`Espaciamiento: ${item.plantingSpacing} cm`);
                const seedInfo = parts.join('\n');
                distribDetail = distribDetail ? `${distribDetail}\n${seedInfo}` : seedInfo;
            }

            if (!distribDetail) distribDetail = '-';

            const row = [
                item.activeIngredient || item.productName,
                item.commercialName || '-',
                item.brandName || '-',
                distribDetail,
                `${item.totalQuantity.toFixed(2)} ${item.unit}`
            ];
            tableRows.push(row);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: lastY,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] }, // Emerald-500
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 35 },
                1: { cellWidth: 35 },
                2: { cellWidth: 35 },
                3: { cellWidth: 50 },
                4: { cellWidth: 25 }
            }
        });

        lastY = (doc as any).lastAutoTable.finalY + 10;

        // Notes
        if (order.notes) {
            doc.setFontSize(10);
            doc.setTextColor(40);
            doc.setFont("helvetica", "bold");
            doc.text("Observaciones:", 14, lastY);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.text(order.notes, 14, lastY + 6, { maxWidth: 180 });
            lastY += 20;
        }

        // Signature Area
        const footerY = 270;
        doc.setDrawColor(200);
        doc.line(14, footerY, 80, footerY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Firma Responsable", 14, footerY + 5);

        doc.line(130, footerY, 196, footerY);
        doc.text("Firma Aplicador / Contratista", 130, footerY + 5);

        // Save
        doc.save(`Orden_${client.name}_Nro${order.orderNumber || order.id.substring(0, 5)}_${order.date}.pdf`);
    };

    const generateRemitoPDF = async (movement: InventoryMovement, client: Client, warehouseName: string) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text("REMITO DE MERCADERÍA", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(`Fecha: ${movement.date} ${movement.time || ''}`, pageWidth - 20, 30, { align: 'right' });
        doc.text(`Comprobante Nro: ${movement.id.substring(0, 8).toUpperCase()}`, pageWidth - 20, 35, { align: 'right' });

        // Origin/Destination Info
        autoTable(doc, {
            body: [
                [`EMPRESA: ${client.name}`, `CUIT: ${client.cuit || '-'}`],
                [`GALPÓN DE ORIGEN: ${warehouseName}`, `DESTINO: ${movement.deliveryLocation || movement.receiverName || 'Retiro en Galpón'}`],
                [`REFERENCIA: ${movement.referenceId}`, `TIPO: ${movement.type === 'SALE' ? 'VENTA' : (movement.type === 'IN' ? 'INGRESO' : 'RETIRO DE STOCK')}`]
            ],
            startY: 40,
            theme: 'plain',
            styles: { fontSize: 11, cellPadding: 2, textColor: 60 }
        });

        // Detail Table
        const tableColumns = ['Producto', 'Nombre Com.', 'Marca', 'Cantidad', 'Unidad'];
        const tableRows = [
            [
                movement.productName,
                movement.productCommercialName || '-',
                movement.productBrand || '-',
                movement.quantity.toString(),
                movement.unit
            ]
        ];

        // Add pricing if it's a SALE or IN
        if (movement.type === 'SALE' || movement.type === 'IN') {
            tableColumns.push('Precio Unit.', 'Total');
            const price = movement.type === 'SALE' ? (movement.salePrice || 0) : (movement.purchasePrice || 0);
            tableRows[0].push(
                `USD ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                `USD ${(price * movement.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            );
        }

        autoTable(doc, {
            head: [tableColumns],
            body: tableRows,
            startY: 70,
            theme: 'grid',
            headStyles: { fillColor: [70, 70, 70] }, // Dark Gray
            styles: { fontSize: 12, cellPadding: 4 }
        });

        // Signatures
        doc.setDrawColor(150);
        const sigY = 150;

        doc.line(20, sigY, 90, sigY);
        doc.setFontSize(8);
        doc.text("Entregué Conforme (Firma y Aclaración)", 20, sigY + 5);

        doc.line(120, sigY, 190, sigY);
        doc.text("Recibí Conforme (Firma y Aclaración)", 120, sigY + 5);

        if (movement.receiverName) {
            doc.setFontSize(10);
            doc.text(`Recibe: ${movement.receiverName}`, 120, sigY + 12);
        }

        // Save
        doc.save(`Remito_${movement.productName}_${movement.date}.pdf`);
    };

    const generateCartaDePortePDF = async (movement: InventoryMovement, client: Client, warehouseName: string) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Header
        doc.setFillColor(200, 200, 200);
        doc.rect(0, 0, pageWidth, 30, 'F');
        doc.setFontSize(24);
        doc.setTextColor(40);
        doc.text("CARTA DE PORTE", pageWidth / 2, 20, { align: 'center' });

        // Transport Info Box
        doc.setFontSize(12);
        doc.setTextColor(0);

        let currentY = 40;

        autoTable(doc, {
            body: [
                ['FECHA DE CARGA', `${movement.date} ${movement.time || ''}`],
                ['TITULAR DE LA CARTA', client.name],
                ['CUIT', client.cuit || '-'],
                ['ORIGEN (PROCEDENCIA)', warehouseName],
                ['DESTINO', movement.deliveryLocation || '-']
            ],
            startY: currentY,
            theme: 'grid',
            headStyles: { fillColor: [200, 200, 200], textColor: 0, fontStyle: 'bold' },
            bodyStyles: { lineColor: [0, 0, 0] }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;

        // Cargo Info
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("DETALLE DE LA CARGA", 14, currentY);

        autoTable(doc, {
            head: [['Producto', 'Nombre Com.', 'Unidad', 'Cantidad (Kg/L)']],
            body: [
                [movement.productName, movement.productCommercialName || '-', movement.unit, movement.quantity.toString()]
            ],
            startY: currentY + 5,
            theme: 'grid',
            headStyles: { fillColor: [0, 0, 0], textColor: 255 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 15;

        // Transportista Info
        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.text("TRANSPORTISTA", 14, currentY);

        autoTable(doc, {
            body: [
                ['NOMBRE / CHOFER', movement.truckDriver || '-'],
                ['PATENTE CAMIÓN', movement.plateNumber || '-'],
                ['PATENTE ACOPLADO', '-']
            ],
            startY: currentY + 5,
            theme: 'grid'
        });

        // Signatures
        const sigY = 240;
        doc.setDrawColor(0);

        doc.line(20, sigY, 90, sigY);
        doc.setFontSize(8);
        doc.text("Firma Cargador (Ingeniero)", 20, sigY + 5);

        doc.line(120, sigY, 190, sigY);
        doc.text("Firma Chofer", 120, sigY + 5);

        // Save
        doc.save(`CP_${movement.productName}_${movement.date}.pdf`);
    };

    return { generateOrderPDF, generateRemitoPDF, generateCartaDePortePDF };
}
