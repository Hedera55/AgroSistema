import { ClientStock, Product, InventoryMovement, Order } from '@/types';

export interface InvestorShare {
    name: string;
    percentage: number;
    amount: number;
}

/**
 * Calculates the total value of stock for a given product or set of products.
 */
export function calculateStockValue(quantity: number, price: number = 0): number {
    return quantity * price;
}

/**
 * Calculates the total investment for a client based on their current stock levels and product prices.
 */
export function calculateTotalInvestment(stock: ClientStock[], products: Product[]): number {
    return stock.reduce((total, item) => {
        const product = products.find(p => p.id === item.productId);
        const price = 0;
        return total + (item.quantity * price);
    }, 0);
}

/**
 * Breaks down a total amount into investor shares based on their percentage allocation.
 */
export function calculateInvestorBreakdown(totalAmount: number, investors: { name: string, percentage: number }[]): InvestorShare[] {
    return investors.map(investor => ({
        name: investor.name,
        percentage: investor.percentage,
        amount: (totalAmount * (investor.percentage / 100))
    }));
}

export const getPartnerName = (name: string | undefined): string => {
    if (!name) return 'Sin Asignar';
    // Strip out the percentage part if it exists e.g., "Esquire (99.20%)" -> "Esquire"
    return name.split(' (')[0];
};

/**
 * Calculates the dynamic percentage share each partner has in each campaign
 * based on their total monetary investment in that campaign.
 * Returns: Record<campaignId, Record<partnerName, percentage>>
 */
export function calculateCampaignPartnerShares(movements: InventoryMovement[], orders: Order[]): Record<string, Record<string, number>> {
    const investmentByCampaignPartner: Record<string, Record<string, number>> = {};
    const totalInvestmentByCampaign: Record<string, number> = {};

    movements.forEach(m => {
        if (m.deleted) return;
        const isTransfer = m.notes?.toLowerCase().includes('transferencia') || m.notes?.toLowerCase().includes('traslado');
        if (isTransfer) return;

        if (m.type === 'IN' || m.type === 'PURCHASE' || m.type === 'SERVICE') {
            let amount = 0;
            if (m.type === 'SERVICE') {
                amount = m.amount || (m.quantity * (m.purchasePrice || 0));
            } else if (m.items && m.items.length > 0) {
                amount = m.items.reduce((acc: number, it: any) => acc + ((it.price || 0) * (it.quantity || 0)), 0);
            } else {
                amount = m.quantity * (m.purchasePrice || 0);
            }

            if (amount > 0 && m.campaignId) {
                const distributors = (m.investors && m.investors.length > 0) 
                    ? m.investors.map((inv: any) => ({ name: getPartnerName(inv.name), amount: amount * (inv.percentage / 100) }))
                    : [{ name: getPartnerName(m.investorName), amount }];

                distributors.forEach((d: any) => {
                    if (m.campaignId) {
                        if (!investmentByCampaignPartner[m.campaignId]) investmentByCampaignPartner[m.campaignId] = {};
                        investmentByCampaignPartner[m.campaignId][d.name] = (investmentByCampaignPartner[m.campaignId][d.name] || 0) + d.amount;
                        totalInvestmentByCampaign[m.campaignId] = (totalInvestmentByCampaign[m.campaignId] || 0) + d.amount;
                    }
                });
            }
        }
    });

    orders.forEach(o => {
        if (o.deleted) return;
        if (o.servicePrice && o.servicePrice > 0 && o.campaignId) {
            const amount = (o.servicePrice * o.treatedArea);
            const distributors = (o.investors && o.investors.length > 0)
                ? o.investors.map((inv: any) => ({ name: getPartnerName(inv.name), amount: amount * (inv.percentage / 100) }))
                : [{ name: getPartnerName(o.investorName), amount }];

            distributors.forEach((d: any) => {
                if (o.campaignId) {
                    if (!investmentByCampaignPartner[o.campaignId]) investmentByCampaignPartner[o.campaignId] = {};
                    investmentByCampaignPartner[o.campaignId][d.name] = (investmentByCampaignPartner[o.campaignId][d.name] || 0) + d.amount;
                    totalInvestmentByCampaign[o.campaignId] = (totalInvestmentByCampaign[o.campaignId] || 0) + d.amount;
                }
            });
        }
    });

    const shares: Record<string, Record<string, number>> = {};
    Object.keys(investmentByCampaignPartner).forEach(campId => {
        shares[campId] = {};
        const cTotalInvest = totalInvestmentByCampaign[campId];
        if (cTotalInvest > 0) {
            Object.entries(investmentByCampaignPartner[campId]).forEach(([pName, pInvested]) => {
                const pInvestedNum = pInvested as number;
                shares[campId][pName] = (pInvestedNum / cTotalInvest) * 100;
            });
        }
    });

    return shares;
}
