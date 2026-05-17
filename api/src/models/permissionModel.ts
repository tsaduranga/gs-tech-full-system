import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";

/** Dot-notation keys like `dashboard.read` or `purchase_orders.write`. */
export const PERMISSION_KEY_RE = /^([a-z][a-z0-9_]*)(\.[a-z][a-z0-9_]*)+$/;

export type PermissionPublic = {
  id: number;
  key: string;
  description: string | null;
};

export const permissionModel = {
  async listAll(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, \`key\`, description FROM permissions ORDER BY id`
    );
    return rows;
  },

  async listPaginated(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: RowDataPacket[]; total: number }> {
    const q = opts.search?.trim();
    let whereClause = "";
    const params: unknown[] = [];
    if (q) {
      whereClause =
        "WHERE p.`key` LIKE ? OR COALESCE(p.description, '') LIKE ? OR CAST(p.id AS CHAR) LIKE ?";
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM permissions p ${whereClause}`,
      params
    );
    const total = Number((countRows[0] as { c?: number })?.c ?? 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.id, p.\`key\`, p.description FROM permissions p ${whereClause} ORDER BY p.id ASC LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset]
    );
    return { rows, total };
  },

  async getById(id: number): Promise<PermissionPublic | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, \`key\`, description FROM permissions WHERE id = ? LIMIT 1`,
      [id]
    );
    const r = rows[0];
    if (!r) return null;
    return {
      id: r.id as number,
      key: String(r.key),
      description: r.description != null ? String(r.description) : null,
    };
  },

  async create(input: {
    key: string;
    description?: string | null;
  }): Promise<number> {
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO permissions (\`key\`, description) VALUES (?, ?)`,
      [input.key, input.description ?? null]
    );
    return r.insertId as number;
  },

  async update(
    id: number,
    patch: Partial<{ key: string; description: string | null }>
  ): Promise<void> {
    const f: string[] = [];
    const p: unknown[] = [];
    if (patch.key !== undefined) {
      f.push("`key` = ?");
      p.push(patch.key);
    }
    if (patch.description !== undefined) {
      f.push("description = ?");
      p.push(patch.description);
    }
    if (!f.length) return;
    p.push(id);
    await pool.query(`UPDATE permissions SET ${f.join(", ")} WHERE id = ?`, p);
  },

  async delete(id: number): Promise<boolean> {
    const [r] = await pool.query<ResultSetHeader>(
      `DELETE FROM permissions WHERE id = ?`,
      [id]
    );
    return (r.affectedRows ?? 0) > 0;
  },
};
