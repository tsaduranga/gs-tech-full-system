import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";
import type { PermissionKey } from "../constants/permissions.js";

export const roleModel = {
  async listRoles(): Promise<RowDataPacket[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, description FROM roles ORDER BY id`
    );
    return rows;
  },

  async listRolesPaginated(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: RowDataPacket[]; total: number }> {
    const q = opts.search?.trim();
    let whereClause = "";
    const params: unknown[] = [];
    if (q) {
      whereClause =
        "WHERE r.name LIKE ? OR COALESCE(r.description, '') LIKE ?";
      const like = `%${q}%`;
      params.push(like, like);
    }
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM roles r ${whereClause}`,
      params
    );
    const total = Number((countRows[0] as { c?: number })?.c ?? 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT r.id, r.name, r.description FROM roles r ${whereClause} ORDER BY r.id ASC LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset]
    );
    return { rows, total };
  },

  async getRoleById(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, description FROM roles WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async getRolePermissionIds(roleId: number): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT permission_id FROM role_permissions WHERE role_id = ? ORDER BY permission_id`,
      [roleId]
    );
    return rows.map((r) => Number(r.permission_id));
  },

  async deleteRole(id: number): Promise<boolean> {
    const [r] = await pool.query<ResultSetHeader>(
      `DELETE FROM roles WHERE id = ?`,
      [id]
    );
    return (r.affectedRows ?? 0) > 0;
  },

  async createRole(input: { name: string; description?: string | null }): Promise<number> {
    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO roles (name, description) VALUES (?, ?)`,
      [input.name, input.description ?? null]
    );
    return r.insertId as number;
  },

  async updateRole(
    id: number,
    patch: Partial<{ name: string; description: string | null }>
  ): Promise<void> {
    const f: string[] = [];
    const p: unknown[] = [];
    if (patch.name !== undefined) {
      f.push("name = ?");
      p.push(patch.name);
    }
    if (patch.description !== undefined) {
      f.push("description = ?");
      p.push(patch.description);
    }
    if (!f.length) return;
    p.push(id);
    await pool.query(`UPDATE roles SET ${f.join(", ")} WHERE id = ?`, p);
  },

  async upsertPermissions(keys: PermissionKey[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    for (const k of keys) {
      await pool.query(
        `INSERT INTO permissions (\`key\`) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
        [k]
      );
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id FROM permissions WHERE \`key\` = ? LIMIT 1`,
        [k]
      );
      map.set(k, rows[0].id as number);
    }
    return map;
  },

  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await pool.query(`DELETE FROM role_permissions WHERE role_id = ?`, [roleId]);
    for (const pid of permissionIds) {
      await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)`, [
        roleId,
        pid,
      ]);
    }
  },

  async getRolePermissions(roleId: number): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT p.\`key\` AS pk FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       WHERE rp.role_id = ?`,
      [roleId]
    );
    return rows.map((x) => String(x.pk));
  },

  async setUserRoles(userId: number, roleIds: number[]): Promise<void> {
    await pool.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    for (const rid of roleIds) {
      await pool.query(`INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`, [
        userId,
        rid,
      ]);
    }
  },

  async getUserRoles(userId: number): Promise<number[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT role_id FROM user_roles WHERE user_id = ?`,
      [userId]
    );
    return rows.map((r) => r.role_id as number);
  },
};
