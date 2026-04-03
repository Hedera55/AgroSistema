/**
 * Standard colors and labels for movement types across the app.
 * 
 * LIME: Sales, Withdrawals, Egress (Product Out / Money In)
 * ORANGE: Purchases, Ingress (Product In / Money Out)
 * DARK GREEN: Labor Services (Sowing, Spraying)
 * BLUE: Harvest (Product In / Labor Cost)
 * INDIGO: Transfers
 */

export interface BadgeStyles {
    label: string;
    classes: string;
    color: 'blue' | 'emerald' | 'lime' | 'orange' | 'indigo' | 'slate';
}

export type MovementCategory = 'SALE' | 'PURCHASE' | 'SERVICE' | 'HARVEST' | 'TRANSFER' | 'OUT' | 'IN';

export function getMovementBadgeStyles(type: string, description?: string, label?: string): BadgeStyles {
    const normalizedType = type.toUpperCase();
    const desc = (description || '').toLowerCase();
    const lbl = (label || '').toUpperCase();

    // 1. HARVEST (Blue)
    if (normalizedType === 'HARVEST' || lbl === 'I-COSECHA' || desc.includes('cosecha')) {
        return {
            label: lbl || 'I-COSECHA',
            classes: 'bg-blue-100 text-blue-800',
            color: 'blue'
        };
    }

    // 2. LABOR SERVICES (Emerald / Dark Green)
    if (normalizedType === 'SERVICE' || normalizedType === 'SOWING' || normalizedType === 'SPRAYING' || normalizedType === 'APPLICATION' || lbl === 'E-SIEMBRA' || lbl === 'E-APLICACIÓN' || desc.includes('siembra') || desc.includes('pulverización') || desc.includes('aplicación')) {
        return {
            label: lbl || (desc.includes('siembra') ? 'E-SIEMBRA' : (desc.includes('pulverización') || desc.includes('aplicación') ? 'E-APLICACIÓN' : 'SERVICIO')),
            classes: 'bg-emerald-100 text-emerald-800',
            color: 'emerald'
        };
    }

    // 3. SALES & EGRESS (Lime)
    if (normalizedType === 'SALE' || normalizedType === 'OUT' || lbl === 'E-VENTA' || lbl === 'E-RETIRO' || desc.includes('venta') || desc.includes('retiro')) {
        return {
            label: lbl || (normalizedType === 'SALE' || desc.includes('venta') ? 'E-VENTA' : 'E-RETIRO'),
            classes: 'bg-lime-100 text-lime-800',
            color: 'lime'
        };
    }

    // 4. PURCHASES & INGRESS (Orange)
    if (normalizedType === 'PURCHASE' || normalizedType === 'IN' || lbl === 'I-COMPRA' || desc.includes('compra')) {
        return {
            label: lbl || 'I-COMPRA',
            classes: 'bg-orange-100 text-orange-800',
            color: 'orange'
        };
    }

    // 5. TRANSFERS (Indigo)
    if (normalizedType === 'TRANSFER' || lbl === 'TRANSFERENCIA' || desc.includes('transferencia') || desc.includes('traslado')) {
        return {
            label: lbl || 'TRANSFERENCIA',
            classes: 'bg-indigo-100 text-indigo-800',
            color: 'indigo'
        };
    }

    // Fallback
    return {
        label: normalizedType,
        classes: 'bg-slate-100 text-slate-800',
        color: 'slate'
    };
}
