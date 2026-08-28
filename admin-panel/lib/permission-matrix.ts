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

/** Matches sidebar navigation order in dashboard-shell. */
export const PERMISSION_NAV_SECTIONS = [
  {
    heading: "Dashboard",
    modules: [{ key: "dashboard", label: "Dashboard" }],
  },
  {
    heading: "User Management",
    modules: [
      { key: "users", label: "Users" },
      { key: "roles", label: "Roles" },
    ],
  },
  {
    heading: "Master Data",
    modules: [
      { key: "customers", label: "Customers" },
      { key: "suppliers", label: "Suppliers" },
      { key: "warehouses", label: "Warehouses" },
      { key: "items", label: "Items" },
    ],
  },
  {
    heading: "Inventory",
    modules: [{ key: "stock", label: "Stock" }],
  },
  {
    heading: "Purchasing",
    modules: [
      { key: "purchase_orders", label: "Purchase orders" },
      { key: "goods_receipts", label: "Goods receipt (GRN)" },
      { key: "supplier_returns", label: "Supplier returns" },
    ],
  },
  {
    heading: "Sales",
    modules: [
      { key: "quotations", label: "Quotations" },
      { key: "sales_orders", label: "Sales orders" },
      { key: "invoices", label: "Invoices" },
      { key: "customer_returns", label: "Customer returns" },
    ],
  },
  {
    heading: "Service",
    modules: [{ key: "repairs", label: "Repairs" }],
  },
  {
    heading: "Reports",
    modules: [{ key: "reports", label: "Reports" }],
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
  perms: PermissionRecord[]
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
    if (!placed) extras.push(perm);
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
      const perms = byModule.get(mod.key);
      if (!perms?.length) continue;
      rows.push(buildModuleRow(mod.key, mod.label, perms));
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
