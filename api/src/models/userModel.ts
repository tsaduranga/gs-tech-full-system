import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { softDelete, notDeletedClause } from "../db/softDelete.js";
import { authModel } from "./authModel.js";
import bcrypt from "bcrypt";

export type DbUserRow = RowDataPacket & {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  deleted_at?: Date | null;
};

export const userModel = {
  async findByUsername(username: string): Promise<DbUserRow | null> {
    const [rows] = await pool.query<DbUserRow[]>(
      `SELECT id, username, email, password_hash, is_active FROM users WHERE username = ? AND ${notDeletedClause()} LIMIT 1`,
      [username]
    );
    const r = rows[0];
    return r ?? null;
  },

  async findByEmail(email: string): Promise<DbUserRow | null> {
    const [rows] = await pool.query<DbUserRow[]>(
      `SELECT id, username, email, password_hash, is_active FROM users WHERE email = ? AND ${notDeletedClause()} LIMIT 1`,
      [email]
    );
    return rows[0] ?? null;
  },

  async findById(id: number): Promise<(DbUserRow & { created_at?: Date }) | null> {
    const [rows] = await pool.query<
      (DbUserRow & { created_at: Date; updated_at: Date })[]
    >(
      `SELECT id, username, email, password_hash, is_active, created_at, updated_at FROM users WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async verifyPassword(hash: string, plain: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  },

  async hashPassword(plain: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(plain, salt);
  },

  async getPermissionKeys(userId: number): Promise<string[]> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT p.\`key\` AS pk
       FROM permissions p
       INNER JOIN role_permissions rp ON rp.permission_id = p.id
       INNER JOIN user_roles ur ON ur.role_id = rp.role_id
       INNER JOIN roles r ON r.id = ur.role_id
       WHERE ur.user_id = ? AND ${notDeletedClause("p")} AND ${notDeletedClause("r")}`,
      [userId]
    );
    return rows.map((r) => String(r.pk));
  },

  async list(): Promise<Omit<DbUserRow, "password_hash">[]> {
    const [rows] = await pool.query<(Omit<DbUserRow, "password_hash"> & RowDataPacket)[]>(
      `SELECT id, username, email, is_active, created_at, updated_at FROM users WHERE ${notDeletedClause()} ORDER BY id`
    );
    return rows;
  },

  async listPaginated(opts: {
    search?: string;
    limit: number;
    offset: number;
  }): Promise<{ rows: RowDataPacket[]; total: number }> {
    const q = opts.search?.trim();
    const conditions = [notDeletedClause("u")];
    const params: unknown[] = [];
    if (q) {
      conditions.push(
        "(u.username LIKE ? OR u.email LIKE ? OR CAST(u.id AS CHAR) LIKE ?)"
      );
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const whereClause = `WHERE ${conditions.join(" AND ")}`;
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS c FROM users u ${whereClause}`,
      params
    );
    const total = Number((countRows[0] as { c?: number })?.c ?? 0);
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT u.id, u.username, u.email, u.is_active, u.created_at, u.updated_at FROM users u ${whereClause} ORDER BY u.id ASC LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset]
    );
    return { rows, total };
  },

  async findByIdPublic(id: number): Promise<RowDataPacket | null> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, username, email, is_active, created_at, updated_at FROM users WHERE id = ? AND ${notDeletedClause()} LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  },

  async deleteUser(id: number): Promise<boolean> {
    const ok = await softDelete("users", id);
    if (ok) await authModel.revokeAllForUser(id);
    return ok;
  },

  async create(input: {
    username: string;
    email: string;
    password: string;
    is_active?: boolean;
  }): Promise<number> {
    const hash = await userModel.hashPassword(input.password);
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO users (username, email, password_hash, is_active) VALUES (?, ?, ?, ?)`,
      [input.username, input.email, hash, input.is_active ?? true]
    );
    return result.insertId as number;
  },

  async update(
    id: number,
    patch: Partial<{
      email: string;
      username: string;
      password: string | null;
      is_active: boolean;
    }>
  ): Promise<void> {
    const fields: string[] = [];
    const params: unknown[] = [];
    if (patch.username !== undefined) {
      fields.push("username = ?");
      params.push(patch.username);
    }
    if (patch.email !== undefined) {
      fields.push("email = ?");
      params.push(patch.email);
    }
    if (patch.password) {
      fields.push("password_hash = ?");
      params.push(await userModel.hashPassword(patch.password));
    }
    if (patch.is_active !== undefined) {
      fields.push("is_active = ?");
      params.push(patch.is_active);
    }
    if (fields.length === 0) return;
    params.push(id);
    await pool.query(
      `UPDATE users SET ${fields.join(", ")} WHERE id = ? AND ${notDeletedClause()}`,
      params
    );
  },
};
