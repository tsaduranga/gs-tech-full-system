export function formatWarrantyDisplay(
  name: string | null | undefined,
  years: number | null | undefined,
  months: number | null | undefined
): string {
  const label = name?.trim() ?? "";
  const y = years ?? 0;
  const m = months ?? 0;
  if (!label && y === 0 && m === 0) return "—";

  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? "year" : "years"}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? "month" : "months"}`);
  const period = parts.join(" ");

  if (label && period) return `${label} (${period})`;
  return label || period || "—";
}
