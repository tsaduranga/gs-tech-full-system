import type { RowDataPacket } from "mysql2/promise";
import { pool } from "./pool.js";

/** Per-process memo so hot paths avoid repeated INFORMATION_SCHEMA lookups. */
const colCache = new Map<string, boolean>();
const tableCache = new Map<string, boolean>();

export async function tableExists(table: string): Promise<boolean> {
  if (tableCache.has(table)) return tableCache.get(table)!;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1`,
    [table]
  );
  const ok = rows.length > 0;
  tableCache.set(table, ok);
  return ok;
}

export async function tableHasColumn(table: string, column: string): Promise<boolean> {
  const key = `${table}.${column}`;
  if (colCache.has(key)) return colCache.get(key)!;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 AS ok FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND COLUMN_NAME = ?
     LIMIT 1`,
    [table, column]
  );
  const ok = rows.length > 0;
  colCache.set(key, ok);
  return ok;
}

/** Call after DDL migrations within the same process (optional). */
export function clearSchemaHintsCache(): void {
  colCache.clear();
  tableCache.clear();
}
