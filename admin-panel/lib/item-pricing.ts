/** Sri Lanka item pricing: actual cost → unit price with SSCL then VAT. */

export type ItemTaxRates = {
  ssclRate: number;
  vatRate: number;
};

export const DEFAULT_ITEM_TAX_RATES: ItemTaxRates = {
  ssclRate: 0.0125,
  vatRate: 0.18,
};

export function taxRatesFromApi(row: {
  sscl_rate?: number;
  vat_rate?: number;
}): ItemTaxRates {
  const sscl = Number(row.sscl_rate);
  const vat = Number(row.vat_rate);
  return {
    ssclRate: Number.isFinite(sscl) && sscl >= 0 ? sscl : DEFAULT_ITEM_TAX_RATES.ssclRate,
    vatRate: Number.isFinite(vat) && vat >= 0 ? vat : DEFAULT_ITEM_TAX_RATES.vatRate,
  };
}

export function formatTaxPercent(rate: number): string {
  const pct = rate * 100;
  if (!Number.isFinite(pct)) return "0";
  const rounded = Math.round(pct * 10000) / 10000;
  return rounded % 1 === 0 ? String(rounded) : String(rounded);
}

export function calculateUnitPriceFromActualCost(
  actualCost: number,
  rates: ItemTaxRates = DEFAULT_ITEM_TAX_RATES
): number {
  if (!Number.isFinite(actualCost) || actualCost <= 0) return 0;
  const afterSscl = actualCost * (1 + rates.ssclRate);
  const afterVat = afterSscl * (1 + rates.vatRate);
  return Math.round(afterVat * 10000) / 10000;
}

export function pricingBreakdown(
  actualCost: number,
  rates: ItemTaxRates = DEFAULT_ITEM_TAX_RATES
): {
  sscl: number;
  vat: number;
  unitPrice: number;
} | null {
  if (!Number.isFinite(actualCost) || actualCost <= 0) return null;
  const sscl = actualCost * rates.ssclRate;
  const subtotal = actualCost + sscl;
  const vat = subtotal * rates.vatRate;
  const unitPrice = calculateUnitPriceFromActualCost(actualCost, rates);
  return { sscl, vat, unitPrice };
}
