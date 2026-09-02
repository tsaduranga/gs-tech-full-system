export type PermissionRecord = {
  id: number;
  key: string;
  description?: string | null;
};

export type MatrixAction = "view" | "edit" | "delete" | "csv";

export const MATRIX_ACTIONS: readonly MatrixAction[] = [
  "view",
  "edit",
  "delete",
  "csv",
] as const;

const ACTION_SUFFIXES: Record<MatrixAction, readonly string[]> = {
  view: ["read"],
  edit: ["write"],
  delete: ["delete"],
  csv: ["export", "csv", "csv_download", "download"],
};

export const ACTION_LABELS: Record<MatrixAction, string> = {
  view: "View",
  edit: "Edit",
  delete: "Delete",
  csv: "CSV download",
};

export type PermissionNavModule = {
  key: string;
  label: string;
  /** Reuse another module's permission keys (same checkboxes, separate menu row). */
  linkedModule?: string;
};

export type PermissionNavSection = {
  heading: string;
  modules: readonly PermissionNavModule[];
};

/** Matches sidebar navigation order in dashboard-shell. */
export const PERMISSION_NAV_SECTIONS: readonly PermissionNavSection[] = [
  {
    heading: "Dashboard",
    modules: [{ key: "dashboard", label: "Dashboard" }],
  },
  {
    heading: "User Management",
    modules: [
      { key: "users", label: "Users" },
      { key: "roles", label: "Roles" },
      { key: "permissions", label: "Permissions", linkedModule: "roles" },
    ],
  },
  {
    heading: "Master Data",
    modules: [
      { key: "customers", label: "Customers" },
      { key: "suppliers", label: "Suppliers" },
      { key: "warehouses", label: "Warehouses" },
      { key: "categories", label: "Categories" },
      { key: "subcategories", label: "Subcategories" },
      { key: "customer_warranties", label: "Customer Warranties" },
      { key: "supplier_warranties", label: "Supplier Warranties" },
      { key: "items", label: "Items" },
    ],
  },
  {
    heading: "Inventory",
    modules: [
      { key: "stock", label: "Stock" },
      { key: "transfer_items", label: "Transfer items", linkedModule: "stock" },
      { key: "transfer_history", label: "Transfer history", linkedModule: "stock" },
    ],
  },
  {
    heading: "Purchasing",
    modules: [
      { key: "purchase_orders", label: "Purchase orders" },
      {
        key: "purchase_order_history",
        label: "Purchase order history",
        linkedModule: "purchase_orders",
      },
      { key: "goods_receipts", label: "Goods receipt (GRN)" },
      {
        key: "goods_receipt_history",
        label: "GRN history",
        linkedModule: "goods_receipts",
      },
      { key: "supplier_returns", label: "Supplier returns" },
      {
        key: "supplier_return_history",
        label: "Supplier return history",
        linkedModule: "supplier_returns",
      },
    ],
  },
  {
    heading: "Sales",
    modules: [
      { key: "quotations", label: "Quotations" },
      {
        key: "quotation_history",
        label: "Quotation history",
        linkedModule: "quotations",
      },
      { key: "sales_orders", label: "Sales orders" },
      {
        key: "sales_order_history",
        label: "Sales order history",
        linkedModule: "sales_orders",
      },
      { key: "invoices", label: "Invoices" },
      {
        key: "invoice_history",
        label: "Invoice history",
        linkedModule: "invoices",
      },
      { key: "customer_returns", label: "Customer returns" },
      {
        key: "customer_return_history",
        label: "Customer return history",
        linkedModule: "customer_returns",
      },
    ],
  },
  {
    heading: "Service",
    modules: [
      { key: "repairs", label: "Repairs" },
      { key: "repair_history", label: "Repair history", linkedModule: "repairs" },
    ],
  },
  {
    heading: "Reports",
    modules: [{ key: "reports", label: "Reports" }],
  },
  {
    heading: "System",
    modules: [{ key: "settings", label: "Settings" }],
  },
] as const;

export type ModulePermissionRow = {
  moduleKey: string;
  moduleLabel: string;
  cells: Partial<Record<MatrixAction, PermissionRecord>>;
  extras: PermissionRecord[];
};

export type PermissionSectionGroup = {
  heading: string;
  rows: ModulePermissionRow[];
};

function titleCaseModule(moduleKey: string): string {
  return moduleKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function parsePermissionKey(key: string): { module: string; action: string } | null {
  const dot = key.lastIndexOf(".");
  if (dot <= 0) return null;
  return {
    module: key.slice(0, dot),
    action: key.slice(dot + 1),
  };
}

function matchesAction(action: string, matrixAction: MatrixAction): boolean {
  return ACTION_SUFFIXES[matrixAction].includes(action);
}

function buildModuleRow(
  moduleKey: string,
  moduleLabel: string,
  perms: PermissionRecord[],
  opts?: { includeExtras?: boolean }
): ModulePermissionRow {
  const cells: Partial<Record<MatrixAction, PermissionRecord>> = {};
  const extras: PermissionRecord[] = [];

  for (const perm of perms) {
    const parsed = parsePermissionKey(perm.key);
    if (!parsed) continue;

    let placed = false;
    for (const action of MATRIX_ACTIONS) {
      if (matchesAction(parsed.action, action) && !cells[action]) {
        cells[action] = perm;
        placed = true;
        break;
      }
    }
    if (!placed && opts?.includeExtras !== false) extras.push(perm);
  }

  return { moduleKey, moduleLabel, cells, extras };
}

/** Group permissions by sidebar section and module order. */
export function buildGroupedPermissionMatrix(
  permissions: PermissionRecord[]
): PermissionSectionGroup[] {
  const byModule = new Map<string, PermissionRecord[]>();

  for (const perm of permissions) {
    const parsed = parsePermissionKey(perm.key);
    if (!parsed) continue;
    const list = byModule.get(parsed.module) ?? [];
    list.push(perm);
    byModule.set(parsed.module, list);
  }

  const labelByKey = new Map<string, string>();
  for (const section of PERMISSION_NAV_SECTIONS) {
    for (const mod of section.modules) {
      labelByKey.set(mod.key, mod.label);
    }
  }

  const sections: PermissionSectionGroup[] = [];

  for (const section of PERMISSION_NAV_SECTIONS) {
    const rows: ModulePermissionRow[] = [];

    for (const mod of section.modules) {
      const permModule = mod.linkedModule ?? mod.key;
      const perms = byModule.get(permModule);
      if (!perms?.length) continue;
      rows.push(
        buildModuleRow(mod.key, mod.label, perms, {
          includeExtras: !mod.linkedModule,
        })
      );
    }

    if (rows.length > 0) {
      sections.push({ heading: section.heading, rows });
    }
  }

  const known = new Set(labelByKey.keys());
  const orphanModules = [...byModule.keys()].filter((key) => !known.has(key));
  if (orphanModules.length > 0) {
    sections.push({
      heading: "Other",
      rows: orphanModules
        .sort((a, b) => a.localeCompare(b))
        .map((moduleKey) =>
          buildModuleRow(
            moduleKey,
            labelByKey.get(moduleKey) ?? titleCaseModule(moduleKey),
            byModule.get(moduleKey) ?? []
          )
        ),
    });
  }

  return sections;
}

export function humanizeExtraAction(key: string): string {
  const parsed = parsePermissionKey(key);
  if (!parsed) return key;
  return titleCaseModule(parsed.action);
}
