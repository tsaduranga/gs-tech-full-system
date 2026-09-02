/** Maps dashboard routes to required permission keys (aligned with API). */

export type RoutePermissionConfig = {
  /** Required to view the page and show the menu item. */
  view: string;
  /** Required for create/update actions. Defaults to view-only when omitted. */
  edit?: string;
};

export const ROUTE_PERMISSIONS: Record<string, RoutePermissionConfig> = {
  "/dashboard": { view: "dashboard.read" },
  "/dashboard/users": { view: "users.read", edit: "users.write" },
  "/dashboard/roles": { view: "roles.read", edit: "roles.write" },
  "/dashboard/permissions": { view: "roles.read", edit: "roles.write" },
  "/dashboard/customers": { view: "customers.read", edit: "customers.write" },
  "/dashboard/suppliers": { view: "suppliers.read", edit: "suppliers.write" },
  "/dashboard/warehouses": { view: "warehouses.read", edit: "warehouses.write" },
  "/dashboard/categories": { view: "categories.read", edit: "categories.write" },
  "/dashboard/subcategories": { view: "subcategories.read", edit: "subcategories.write" },
  "/dashboard/customer-warranties": {
    view: "customer_warranties.read",
    edit: "customer_warranties.write",
  },
  "/dashboard/supplier-warranties": {
    view: "supplier_warranties.read",
    edit: "supplier_warranties.write",
  },
  "/dashboard/warranties": {
    view: "customer_warranties.read",
    edit: "customer_warranties.write",
  },
  "/dashboard/items": { view: "items.read", edit: "items.write" },
  "/dashboard/stock": { view: "stock.read" },
  "/dashboard/transfer-items": { view: "stock.read", edit: "stock.transfer" },
  "/dashboard/transfer-history": { view: "stock.read" },
  "/dashboard/purchase-orders": {
    view: "purchase_orders.read",
    edit: "purchase_orders.write",
  },
  "/dashboard/purchase-order-history": { view: "purchase_orders.read" },
  "/dashboard/goods-receipts": { view: "goods_receipts.read" },
  "/dashboard/goods-receipt-history": { view: "goods_receipts.read" },
  "/dashboard/supplier-returns": {
    view: "supplier_returns.read",
    edit: "supplier_returns.write",
  },
  "/dashboard/supplier-return-history": { view: "supplier_returns.read" },
  "/dashboard/quotations": { view: "quotations.read", edit: "quotations.write" },
  "/dashboard/quotation-history": { view: "quotations.read" },
  "/dashboard/sales-orders": { view: "sales_orders.read", edit: "sales_orders.write" },
  "/dashboard/sales-order-history": { view: "sales_orders.read" },
  "/dashboard/invoices": { view: "invoices.read", edit: "invoices.write" },
  "/dashboard/invoice-history": { view: "invoices.read" },
  "/dashboard/customer-returns": {
    view: "customer_returns.read",
    edit: "customer_returns.write",
  },
  "/dashboard/customer-return-history": { view: "customer_returns.read" },
  "/dashboard/repairs": { view: "repairs.read", edit: "repairs.write" },
  "/dashboard/repair-history": { view: "repairs.read" },
  "/dashboard/reports": { view: "reports.read" },
  "/dashboard/settings": { view: "settings.read", edit: "settings.write" },
};

export function getRoutePermission(pathname: string): RoutePermissionConfig | null {
  if (ROUTE_PERMISSIONS[pathname]) return ROUTE_PERMISSIONS[pathname];

  // Nested dynamic routes (future-proofing)
  const sorted = Object.keys(ROUTE_PERMISSIONS).sort((a, b) => b.length - a.length);
  for (const route of sorted) {
    if (pathname.startsWith(`${route}/`)) return ROUTE_PERMISSIONS[route];
  }

  return null;
}

export function getFirstAccessibleRoute(
  permissions: readonly string[]
): string | null {
  const set = new Set(permissions);
  for (const [route, config] of Object.entries(ROUTE_PERMISSIONS)) {
    if (set.has(config.view)) return route;
  }
  return null;
}
