import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../db/pool.js";
import type { WarrantyType } from "../constants/warrantyTypes.js";
import { notDeletedClause, softDelete } from "../db/softDelete.js";

function insertId(r: ResultSetHeader): number {
  return r.insertId as number;
}

export const warrantyModel = {
  async listPaginated(opts: {
    warranty_type: WarrantyType;
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: RowDataPacket[]; total: number }> {
    const q = opts.search?.trim();
    const conditions = [notDeletedClause("w"), "w.warranty_type = ?"];
    const params: unknown[] = [opts.warranty_type];
    if (q) {
      conditions.push(
        "(w.name LIKE ? OR CAST(w.warranty_years AS CHAR) LIKE ? OR CAST(w.warranty_months AS CHAR) LIKE ? OR CAST(w.id AS CHAR) LIKE ?)"
      );
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM warranties w ${whereClause}`,
      params
    );
    const total = Number((countRows[0] as { c?: number })?.c ?? 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT w.id, w.name, w.warranty_type, w.warranty_years, w.warranty_months, w.is_active, w.created_at, w.updated_at
       FROM warranties w ${whereClause} ORDER BY w.name ASC, w.id ASC LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset]
    );
    return { rows, total };
  },

  async listActiveBrief(warranty_type: WarrantyType): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, warranty_type, warranty_years, warranty_months
       FROM warranties
       WHERE warranty_type = ? AND is_active = 1 AND ${notDeletedClause()}
       ORDER BY name ASC, id ASC`,
      [warranty_type]
    );
    return rows;
  },

  async get(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM warranties WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async create(p: {
    warranty_type: WarrantyType;
    name: string;
    warranty_years: number;
    warranty_months: number;
    is_active?: boolean;
  }): Promise<number> {
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO warranties (name, warranty_type, warranty_years, warranty_months, is_active) VALUES (?, ?, ?, ?, ?)`,
      [p.name, p.warranty_type, p.warranty_years, p.warranty_months, p.is_active ?? true]
    );
    return insertId(r);
  },

  async update(
    id: number,
    patch: Partial<{
      name: string;
      warranty_years: number;
      warranty_months: number;
      is_active: boolean;
    }>
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined) {
      fields.push("name = ?");
      params.push(patch.name);
    }
    if (patch.warranty_years !== undefined) {
      fields.push("warranty_years = ?");
      params.push(patch.warranty_years);
    }
    if (patch.warranty_months !== undefined) {
      fields.push("warranty_months = ?");
      params.push(patch.warranty_months);
    }
    if (patch.is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(patch.is_active);
    }
    if (!fields.length) return;
    params.push(id);
    await pool.query(
      `UPDATE warranties SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
      params
    );
  },

  async delete(id: number, warranty_type: WarrantyType): Promise<boolean> {
    const row = await this.get(id);
    if (!row || String(row.warranty_type) !== warranty_type) return false;
    const ok = await softDelete("warranties", id);
    if (ok) {
      await pool.query(`DELETE FROM item_customer_warranties WHERE warranty_id = ?`, [id]);
      await pool.query(`DELETE FROM item_supplier_warranties WHERE warranty_id = ?`, [id]);
      if (warranty_type === "customer") {
        await pool.query(`UPDATE items SET warranty_id = NULL WHERE warranty_id = ?`, [id]);
      }
    }
    return ok;
  },
};
