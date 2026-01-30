import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Order, OrderItem, Client, InventoryMovement } from '@/types';

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

        // Header
        doc.setFontSize(20);
        doc.setTextColor(40);
        doc.text("ORDEN DE PULVERIZACIÓN", 14, 20);

        doc.setFontSize(10);
        doc.setTextColor(60);
        doc.text(`Orden Nro ${order.orderNumber || '-'}`, 14, 28);
        doc.text(`Fecha de emisión: ${order.date} ${order.time || ''}`, 60, 28);

        // Meta Data Box
        autoTable(doc, {
            body: [
                [`Cliente: ${client.name} ${client.cuit ? `(CUIT: ${client.cuit})` : ''}`, `Lote: ${order.lotName || 'N/A'}`],
                [`Campo: ${order.farmName || 'N/A'}`, `Superficie: ${order.treatedArea} Has`],
                [`Ventana de aplicación: ${order.applicationStart || '-'} al ${order.applicationEnd || '-'}`, '']
            ],
            startY: 32,
            theme: 'grid',
            styles: {
                fontSize: 10,
                cellPadding: 3,
                textColor: 60,
                lineColor: [0, 0, 0],
                lineWidth: 0.1
            },
            columnStyles: {
                0: { cellWidth: 90 },
                1: { cellWidth: 91 }
            }
        });

        const finalMetaY = (doc as any).lastAutoTable.finalY || 50;

        // Planting Data Section
        let lastY = finalMetaY;
        if (order.plantingDensity) {
            doc.setFontSize(10);
            doc.setTextColor(40);
            doc.setFont("helvetica", "bold");
            doc.text("Datos de Siembra:", 14, lastY + 8);
            doc.setFont("helvetica", "normal");
            doc.text(`Densidad: ${order.plantingDensity} ${order.plantingDensityUnit === 'PLANTS_HA' ? 'pl/ha' : 'kg/ha'}`, 14, lastY + 14);
            doc.text(`Espaciamiento: ${order.plantingSpacing ? `${order.plantingSpacing} cm` : '-'}`, 80, lastY + 14);
            lastY += 20;
        } else {
            lastY += 5;
        }

        // Table
        const tableColumn = ["P.A.", "Marca", "Dosis/Ha", "Dosis Total"];
        const tableRows: (string | number)[][] = [];

        order.items.forEach((item) => {
            let brandDetail = item.brandName || '-';
            if (item.plantingDensity) {
                brandDetail += `\nDensidad: ${item.plantingDensity} ${item.plantingDensityUnit === 'PLANTS_HA' ? 'pl/ha' : 'kg/ha'}`;
            }
            if (item.plantingSpacing) {
                brandDetail += `\nEspac: ${item.plantingSpacing} cm`;
            }

            const row = [
                item.activeIngredient || item.productName,
                brandDetail,
                `${item.dosage} ${item.unit}/ha`,
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
            styles: { fontSize: 10 }
        });

        // Notes
        if (order.notes) {
            const finalY = (doc as any).lastAutoTable.finalY || 100;
            doc.text("Observaciones:", 14, finalY + 10);
            doc.setFont("helvetica", "italic");
            doc.text(order.notes, 14, finalY + 16);
        }

        // Signature Area
        doc.setDrawColor(150);
        doc.line(14, 250, 80, 250);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Firma Responsable", 14, 255);

        doc.line(120, 250, 186, 250);
        doc.text("Firma Aplicador", 120, 255);

        // QR Code (Linking to Lot Map) - Smaller and top-right
        try {
            const baseUrl = window.location.origin;
            const qrUrl = `${baseUrl}/clients/${order.clientId}/fields/${order.farmId}/map`;
            const qrDataUrl = await QRCode.toDataURL(qrUrl);
            doc.addImage(qrDataUrl, 'PNG', 175, 4, 20, 20); // Resized and moved up
            doc.setFontSize(6);
            doc.text("Ver mapa", 185, 26, { align: 'center' });
        } catch (qrErr) {
            console.error("Error generating QR:", qrErr);
        }

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
                [`TITULAR: ${client.name}`, `CUIT: ${client.cuit || '-'}`],
                [`ORIGEN: ${warehouseName}`, `DESTINO: ${movement.deliveryLocation || movement.receiverName || 'Retiro en Galpón'}`],
                [`REFERENCIA: ${movement.referenceId}`, `TIPO: ${movement.type === 'SALE' ? 'VENTA' : 'RETIRO DE STOCK'}`]
            ],
            startY: 40,
            theme: 'plain',
            styles: { fontSize: 11, cellPadding: 2, textColor: 60 }
        });

        // Detail Table
        autoTable(doc, {
            head: [['Producto', 'Marca', 'Cantidad', 'Unidad']],
            body: [
                [
                    movement.productName,
                    movement.productBrand || '-',
                    movement.quantity.toString(),
                    movement.unit
                ]
            ],
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
            head: [['Producto', 'Unidad', 'Cantidad (Kg/L)']],
            body: [
                [movement.productName, movement.unit, movement.quantity.toString()]
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
