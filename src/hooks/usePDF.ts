import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { Order, OrderItem, Client } from '@/types';

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

    return { generateOrderPDF };
}
