import { formatNumber } from '@angular/common';

export type CurrencyCode = 'USD' | 'EUR' | 'TND';

export type CurrencyOption = {
  code: CurrencyCode;
  symbol: string;
  // Where the symbol goes: "$25.00" or "25.00 DT"
  position: 'before' | 'after';
};

export const CURRENCIES: Record<CurrencyOption['code'], CurrencyOption> = {
  USD: { code: 'USD', symbol: '$', position: 'before' },
  EUR: { code: 'EUR', symbol: '€', position: 'before' },
  TND: { code: 'TND', symbol: 'DT', position: 'after' },
};

// The shop's currency. Prices are stored as plain numbers and only the symbol
// changes: nothing is converted (25 is $25.00, €25.00 or 25.00 DT)
export const CURRENCY: CurrencyOption = CURRENCIES.TND;

// Same digits as the currency pipe ("1.2-2"), but always with the shop's symbol
export const formatPrice = (value: number, digitsInfo = '1.2-2'): string => {
  const amount = formatNumber(value, 'en-US', digitsInfo);
  return CURRENCY.position === 'before'
    ? `${CURRENCY.symbol}${amount}`
    : `${amount} ${CURRENCY.symbol}`;
};
