import { ClientStock, Product } from '@/types';

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
