/**
 * Normalizes a number string in Spanish/Argentine notation (dots for thousands, comma for decimal)
 * and returns a standard float. 
 * If the value is already a number, it returns it as is.
 */
export const normalizeNumber = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    
    // Remove dots (thousands) and replace comma with dot (decimal)
    const normalized = val.toString().replace(/\./g, '').replace(',', '.');
    const result = parseFloat(normalized);
    
    return isNaN(result) ? 0 : result;
};
