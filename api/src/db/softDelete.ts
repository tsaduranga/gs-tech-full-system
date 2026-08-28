import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "./pool.js";

/** Tables that support soft delete via deleted_at. */
export type SoftDeleteTable =
  | "users"
  | "roles"
  | "permissions"
  | "customers"
  | "suppliers"
  | "warehouses"
  | "items"
  | "catalog_categories"
  | "catalog_subcategories";

const TABLES_WITH_IS_ACTIVE = new Set<SoftDeleteTable>([
  "users",
  "customers",
  "suppliers",
  "warehouses",
  "items",
  "catalog_categories",
  "catalog_subcategories",
]);

/** Columns with DB UNIQUE constraints — suffix on soft delete to free the slot. */
const UNIQUE_COLUMNS: Partial<Record<SoftDeleteTable, readonly string[]>> = {
  users: ["username", "email"],
  roles: ["name"],
  permissions: ["`key`"],
  warehouses: ["code"],
  items: ["sku"],
  catalog_categories: ["name"],
  catalog_subcategories: ["name"],
};

/** SQL fragment: `alias.deleted_at IS NULL` or `deleted_at IS NULL`. */
export function notDeletedClause(alias?: string): string {
  const col = alias ? `${alias}.deleted_at` : "deleted_at";
  return `${col} IS NULL`;
}

/** Combine with existing WHERE (empty string if first condition). */
export function andNotDeleted(alias?: string, hasWhere = false): string {
  const clause = notDeletedClause(alias);
  return hasWhere ? ` AND ${clause}` : `WHERE ${clause}`;
}

function buildSoftDeleteSets(
  table: SoftDeleteTable,
  id: number,
  alsoDeactivate: boolean
): string[] {
  const sets = ["deleted_at = CURRENT_TIMESTAMP"];
  if (alsoDeactivate) sets.push("is_active = 0");

  const uniqueCols = UNIQUE_COLUMNS[table];
  if (uniqueCols) {
    for (const col of uniqueCols) {
      sets.push(`${col} = CONCAT(${col}, '__deleted_', ${id})`);
    }
  }

  return sets;
}

export async function softDelete(
  table: SoftDeleteTable,
  id: number,
  opts?: { alsoDeactivate?: boolean }
): Promise<boolean> {
  const alsoDeactivate = opts?.alsoDeactivate ?? TABLES_WITH_IS_ACTIVE.has(table);
  const sets = buildSoftDeleteSets(table, id, alsoDeactivate);

  const [r] = await pool.query<ResultSetHeader>(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return (r.affectedRows ?? 0) > 0;
}

/** Soft-delete multiple rows by condition (e.g. cascade subcategories). */
export async function softDeleteWhere(
  table: SoftDeleteTable,
  whereSql: string,
  params: unknown[],
  opts?: { alsoDeactivate?: boolean }
): Promise<number> {
  const alsoDeactivate = opts?.alsoDeactivate ?? TABLES_WITH_IS_ACTIVE.has(table);
  const uniqueCols = UNIQUE_COLUMNS[table];

  let totalAffected = 0;

  if (uniqueCols?.length) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM ${table} WHERE ${whereSql} AND deleted_at IS NULL`,
      params
    );
    for (const row of rows) {
      const ok = await softDelete(table, Number(row.id), { alsoDeactivate });
      if (ok) totalAffected += 1;
    }
    return totalAffected;
  }

  const sets = ["deleted_at = CURRENT_TIMESTAMP"];
  if (alsoDeactivate) sets.push("is_active = 0");

  const [r] = await pool.query<ResultSetHeader>(
    `UPDATE ${table} SET ${sets.join(", ")} WHERE ${whereSql} AND deleted_at IS NULL`,
    params
  );
  return r.affectedRows ?? 0;
}
