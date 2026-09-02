export function lineAmountExVat(qty: number, unitExVat: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(unitExVat) || qty <= 0 || unitExVat < 0) {
    return 0;
  }
  return Math.round(qty * unitExVat * 100) / 100;
}

export function documentTotals(
  lines: { qty: number; unitExVat: number }[],
  vatRate: number,
  deliveryCharges: number
) {
  const totalExVat = lines.reduce(
    (sum, line) => sum + lineAmountExVat(line.qty, line.unitExVat),
    0
  );
  const roundedExVat = Math.round(totalExVat * 100) / 100;
  const vatAmount = Math.round(roundedExVat * vatRate * 100) / 100;
  const totalIncVat = Math.round((roundedExVat + vatAmount) * 100) / 100;
  const delivery = Number.isFinite(deliveryCharges) && deliveryCharges > 0 ? deliveryCharges : 0;
  const grandTotal = Math.round((totalIncVat + delivery) * 100) / 100;

  return {
    totalExVat: roundedExVat,
    vatAmount,
    totalIncVat,
    deliveryCharges: delivery,
    grandTotal,
  };
}

export function fmtRs(n: number) {
  try {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return String(n);
  }
}
