import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, OrderItem } from '@/types';

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

    const generateOrderPDF = (order: Order & { farmName?: string; lotName?: string }, clientName: string) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(22);
        doc.setTextColor(40);
        doc.text("Orden de Pulverización", 14, 20);

        doc.setFontSize(10);
        doc.text("AgroSistema App", 14, 28);

        // Meta Data
        doc.setFontSize(11);
        doc.setTextColor(100);

        const rightColX = 120;

        doc.text(`Fecha: ${order.date} ${order.time || ''}`, 14, 40);
        doc.text(`Cliente: ${clientName}`, 14, 46);
        doc.text(`Campo: ${order.farmName || 'N/A'}`, 14, 52);
        doc.text(`Lote: ${order.lotName || 'N/A'}`, rightColX, 40);
        doc.text(`Superficie: ${order.treatedArea} Has`, rightColX, 46);

        // Status Badge if needed
        // doc.text(`Estado: ${order.status}`, rightColX, 52);

        // Table
        const tableColumn = ["Insumo", "Dosis"];
        const tableRows: (string | number)[][] = [];

        order.items.forEach((item) => {
            const row = [
                item.productName,
                `${item.dosage} ${item.unit}/ha`,
            ];
            tableRows.push(row);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 65,
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

        // Save
        doc.save(`Orden_${clientName}_${order.date}.pdf`);
    };

    return { generateOrderPDF };
}
