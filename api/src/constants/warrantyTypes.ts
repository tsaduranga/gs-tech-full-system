export const WARRANTY_TYPES = ["customer", "supplier"] as const;

export type WarrantyType = (typeof WARRANTY_TYPES)[number];

export function isWarrantyType(v: unknown): v is WarrantyType {
  return v === "customer" || v === "supplier";
}

export function readPermissionForWarrantyType(type: WarrantyType): string {
  return type === "customer" ? "customer_warranties.read" : "supplier_warranties.read";
}

export function writePermissionForWarrantyType(type: WarrantyType): string {
  return type === "customer" ? "customer_warranties.write" : "supplier_warranties.write";
}
