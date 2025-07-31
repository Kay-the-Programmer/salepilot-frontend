import { StoreSettings } from '../types';

export const formatCurrency = (amount: number | string | undefined, settings: StoreSettings): string => {
    // Convert string to number if needed
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

    if (numericAmount === undefined || isNaN(numericAmount)) {
        return settings.currency.position === 'before'
            ? `${settings.currency.symbol}0.00`
            : `0.00${settings.currency.symbol}`;
    }

    const formatted = numericAmount.toFixed(2);
    return settings.currency.position === 'before'
        ? `${settings.currency.symbol}${formatted}`
        : `${formatted}${settings.currency.symbol}`;
};