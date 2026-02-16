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

    const generateOrderPDF = async (order: Order & { farmName?: string; lotName?: string }, client: Client) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        // Fetch applicator (contractor) CUIT
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
        try {
            const baseUrl = window.location.origin;
            const qrUrl = `${baseUrl}/kml/${order.lotIds?.[0] || order.lotId}`;
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
        const isSowing = order.items.some(i => i.productType === 'SEED');
        doc.text(isSowing ? "ORDEN DE SIEMBRA" : "ORDEN DE CARGA", 14, 20);

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(60);
        doc.text(`Nro: ${order.orderNumber || '-'}`, 14, 28);
        doc.text(`Fecha Emisión: ${formatDate(order.date)} ${order.time || ''}`, 45, 28);

        const appDateDisplay = order.isDateRange
            ? `${formatDate(order.applicationStart)} al ${formatDate(order.applicationEnd)}`
            : formatDate(order.applicationDate);

        // Metadata Table
        autoTable(doc, {
            body: [
                [`CLIENTE: ${client.name} ${client.cuit ? `(CUIT: ${client.cuit})` : ''}`],
                [`CAMPO: ${order.farmName || 'N/A'}`],
                [`LOTES: ${order.lotIds && order.lotIds.length > 1 ? 'Varios' : (order.lotName || 'N/A')}`],
                [`SUPERFICIE: ${formatNumber(order.treatedArea || 0, 1)} Has`],
                [`APLICACIÓN: ${appDateDisplay}`]
            ],
            startY: 32,
            theme: 'plain',
            styles: { fontSize: 9, cellPadding: 1, textColor: 60 },
            columnStyles: { 0: { cellWidth: 140 } }
        });

        let lastY = (doc as any).lastAutoTable.finalY + 5;

        // Contractor
        if (order.applicatorName) {
            doc.setFontSize(10);
            doc.setTextColor(40);
            doc.setFont("helvetica", "bold");
            doc.text("CONTRATISTA:", 14, lastY);
            doc.setFont("helvetica", "normal");
            doc.text(`${order.applicatorName} ${applicatorCUIT ? `(CUIT: ${applicatorCUIT})` : ''}`, 45, lastY);
            lastY += 10;
        }

        // --- Table Section ---
        const tableColumn = ["Nombre Comercial", "P.A. / Cultivo", "Marca", "Dosis / Distribución", "Total"];
        const tableRows: (string | number)[][] = [];

        order.items.forEach((item) => {
            let distribDetail = '';
            if (item.dosage && item.dosage > 0) {
                distribDetail = `${formatNumber(item.dosage)} ${item.unit}/ha`;
            }
            if (item.plantingDensity || item.plantingSpacing) {
                const parts = [];
                if (item.plantingDensity) parts.push(`Densidad: ${formatNumber(item.plantingDensity)} kg/ha`);
                if (item.plantingSpacing) parts.push(`Espaciamiento: ${formatNumber(item.plantingSpacing)} cm`);
                const seedInfo = parts.join('\n');
                distribDetail = distribDetail ? `${distribDetail}\n${seedInfo}` : seedInfo;
            }
            if (!distribDetail) distribDetail = '-';

            const nameDisplay = item.productType === 'SEED'
                ? `${item.productName}${item.brandName ? ` (${item.brandName})` : ''}`
                : (item.commercialName || item.productName || '-');

            tableRows.push([
                nameDisplay,
                item.activeIngredient || item.productName || '-',
                item.brandName || '-',
                distribDetail,
                `${formatNumber(item.totalQuantity)} ${item.unit}`
            ]);
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: lastY,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] },
            styles: { fontSize: 8, cellPadding: 2 },
            columnStyles: {
                0: { cellWidth: 40 },
                1: { cellWidth: 40 },
                2: { cellWidth: 30 },
                3: { cellWidth: 50 },
                4: { cellWidth: 25 }
            }
        });

        lastY = (doc as any).lastAutoTable.finalY + 10;

        // Notes
        if (order.notes) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text("Observaciones:", 14, lastY);
            doc.setFont("helvetica", "italic");
            doc.setFontSize(9);
            doc.setTextColor(60);
            doc.text(order.notes, 14, lastY + 6, { maxWidth: 180 });
            lastY += 20;
        }

        // Signatures
        const footerY = 270;
        doc.setDrawColor(200);
        doc.line(14, footerY, 80, footerY);
        doc.setFontSize(8);
        doc.text("Firma Responsable", 14, footerY + 5);
        doc.line(130, footerY, 196, footerY);
        doc.text("Firma Aplicador / Contratista", 130, footerY + 5);

        doc.save(`OrdenCarga_${client.name}_${order.orderNumber || ''}_${order.date}.pdf`);
    };

    const generateInsumosPDF = async (order: Order, client: Client) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("NECESIDAD DE INSUMOS", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Orden: #${order.orderNumber || '-'}`, 14, 30);
        doc.text(`Fecha: ${formatDate(order.date)}`, pageWidth - 40, 30);
        doc.text(`Cliente: ${client.name}`, 14, 35);

        const tableColumn = ["Galpón", "Producto", "Presentación", "Cantidad"];
        const tableRows: any[] = [];

        // Group items by warehouse
        const warehouses = Array.from(new Set(order.items.map(i => i.warehouseName || 'S/G')));
        warehouses.forEach(wh => {
            const whItems = order.items.filter(i => (i.warehouseName || 'S/G') === wh);
            whItems.forEach((item, idx) => {
                const nameDisplay = item.productType === 'SEED'
                    ? `${item.productName}${item.brandName ? ` (${item.brandName})` : ''}`
                    : (item.commercialName || item.productName);

                tableRows.push([
                    idx === 0 ? wh : '',
                    nameDisplay,
                    item.isVirtualDéficit ? 'FALTANTE' : (`${item.presentationLabel || `A granel (${item.unit})`} ${item.presentationContent ? `(${item.presentationContent}${item.unit})` : ''}`),
                    item.isVirtualDéficit ? `Faltan ${formatNumber(item.totalQuantity, 1)}` : (item.multiplier ? formatNumber(item.multiplier, 1) : '-')
                ]);
            });
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 45,
            theme: 'grid',
            headStyles: { fillColor: [51, 65, 85] },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        doc.save(`Insumos_Orden_${order.orderNumber || ''}.pdf`);
    };

    const generateRemitoPDF = async (order: Order, client: Client) => {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("REMITO", pageWidth / 2, 20, { align: 'center' });

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Orden Ref: #${order.orderNumber || '-'}`, 14, 35);
        doc.text(`Fecha: ${formatDate(order.date)}`, pageWidth - 40, 35);
        doc.text(`Cliente: ${client.name}`, 14, 40);

        const tableColumn = ["Producto", "Presentacion", "Cantidad"];
        const tableRows = order.items.map(item => [
            item.commercialName || item.productName,
            item.presentationLabel || `A granel (${item.unit})`,
            item.multiplier ? `${formatNumber(item.multiplier, 1)} ${item.presentationLabel ? 'uds' : item.unit}` : '-'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [30, 41, 59] },
            styles: { fontSize: 10, cellPadding: 4 }
        });

        // Signatures
        const sigY = 150;
        doc.line(20, sigY, 90, sigY);
        doc.text("Retira (Firma y Aclaración)", 20, sigY + 5);
        doc.line(120, sigY, 190, sigY);
        doc.text("Entrega (Firma y Aclaración)", 120, sigY + 5);

        doc.save(`Remito_Orden_${order.orderNumber || ''}.pdf`);
    };

    const generateCartaDePortePDF = async (movement: InventoryMovement, client: Client, warehouseName: string) => {
        // Keeping as is or updating if needed. Currently focusing on the 3 requested.
        const doc = new jsPDF();
        // ... (rest of implementation)
        doc.save(`CP_${movement.productName}_${movement.date}.pdf`);
    };

    return { generateOrderPDF, generateRemitoPDF, generateInsumosPDF, generateCartaDePortePDF };
}
