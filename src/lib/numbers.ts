/**
 * Normalizes a number string in Spanish/Argentine notation (dots for thousands, comma for decimal)
 * and returns a standard float. 
 * If the value is already a number, it returns it as is.
 */
export const normalizeNumber = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    // User Rules: dot is thousand, comma is decimal.
    // 1. Remove all dots
    // 2. Replace comma with dot
    const normalized = val.toString().replace(/\./g, '').replace(',', '.');
    const result = parseFloat(normalized);
    
    return isNaN(result) ? 0 : result;
};

/**
 * Formats a number for a text input in Spanish locale.
 * Uses comma for decimal and NO dots for thousands to avoid parser confusion.
 */
export const formatForInput = (num: number, decimals: number = 2): string => {
    if (isNaN(num)) return '';
    return num.toFixed(decimals).replace('.', ',');
};
