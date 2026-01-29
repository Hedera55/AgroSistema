import { describe, it, expect } from 'vitest';
import { calculateStockValue, calculateTotalInvestment, calculateInvestorBreakdown } from './financial';
import { ClientStock, Product } from '@/types';

describe('Financial Utilities', () => {
    describe('calculateStockValue', () => {
        it('should correctly calculate value based on quantity and price', () => {
            expect(calculateStockValue(10, 5.5)).toBe(55);
            expect(calculateStockValue(0, 5.5)).toBe(0);
            expect(calculateStockValue(10, 0)).toBe(0);
        });

        it('should handle negative quantities or prices (though unlikely in UI)', () => {
            expect(calculateStockValue(-1, 10)).toBe(-10);
        });
    });

    describe('calculateTotalInvestment', () => {
        const mockProducts: Product[] = [
            { id: 'p1', name: 'Product 1', type: 'HERBICIDE', unit: 'L', price: 10 },
            { id: 'p2', name: 'Product 2', type: 'FERTILIZER', unit: 'KG', price: 20 },
        ];

        const mockStock: ClientStock[] = [
            { id: 's1', clientId: 'c1', productId: 'p1', quantity: 5, lastUpdated: '' },
            { id: 's2', clientId: 'c1', productId: 'p2', quantity: 2, lastUpdated: '' },
        ];

        it('should calculate the total investment correctly', () => {
            // (5 * 10) + (2 * 20) = 50 + 40 = 90
            expect(calculateTotalInvestment(mockStock, mockProducts)).toBe(90);
        });

        it('should return 0 if stock is empty', () => {
            expect(calculateTotalInvestment([], mockProducts)).toBe(0);
        });

        it('should handle missing products by assuming 0 price', () => {
            const stockWithUnknown: ClientStock[] = [
                { id: 's3', clientId: 'c1', productId: 'p3', quantity: 10, lastUpdated: '' }
            ];
            expect(calculateTotalInvestment(stockWithUnknown, mockProducts)).toBe(0);
        });
    });

    describe('calculateInvestorBreakdown', () => {
        it('should correctly calculate shares based on percentages', () => {
            const total = 1000;
            const investors = [
                { name: 'Investor A', percentage: 60 },
                { name: 'Investor B', percentage: 40 },
            ];

            const breakdown = calculateInvestorBreakdown(total, investors);
            expect(breakdown).toHaveLength(2);
            expect(breakdown[0].amount).toBe(600);
            expect(breakdown[1].amount).toBe(400);
        });

        it('should handle decimals in percentages', () => {
            const total = 100;
            const investors = [{ name: 'Investor A', percentage: 33.33 }];
            const breakdown = calculateInvestorBreakdown(total, investors);
            expect(breakdown[0].amount).toBeCloseTo(33.33);
        });

        it('should return empty list if no investors', () => {
            expect(calculateInvestorBreakdown(100, [])).toEqual([]);
        });
    });
});
