import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { pool } from "../db/pool.js";
import { decodeRefreshExpirySeconds } from "../utils/jwt.js";

export const authModel = {
  async addLoginHistory(input: {
    userId: number | null;
    ip: string | null;
    userAgent: string | null;
    success: boolean;
    message?: string;
  }): Promise<void> {
    await pool.query(
      `INSERT INTO login_history (user_id, ip, user_agent, success, message)
       VALUES (?, ?, ?, ?, ?)`,
      [
        input.userId,
        input.ip,
        input.userAgent?.slice(0, 512) ?? null,
        input.success,
        input.message?.slice(0, 255) ?? null,
      ]
    );
  },

  async createRefreshSession(userId: number, jti: string): Promise<void> {
    const sec = decodeRefreshExpirySeconds();
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, jti, expires_at)
       VALUES (?, ?, TIMESTAMPADD(SECOND, ?, NOW()))`,
      [userId, jti, sec]
    );
  },

  async findValidRefresh(userId: number, jti: string): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id FROM refresh_tokens
       WHERE user_id = ? AND jti = ? AND revoked_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [userId, jti]
    );
    return rows.length > 0;
  },

  async revokeRefresh(userId: number, jti: string): Promise<void> {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND jti = ?`,
      [userId, jti]
    );
  },

  async revokeAllForUser(userId: number): Promise<void> {
    await pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL`,
      [userId]
    );
  },

  /** Store password reset opaque token hashed with SHA256 — token is UUID hex stored as full string comparison */
  async createPasswordResetToken(userId: number, tokenHash: string, expiresMinutes: number): Promise<void> {
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [userId, tokenHash, expiresMinutes]
    );
  },

  async consumePasswordReset(tokenHash: string): Promise<number | null> {
    const [rows] = await pool.query<(RowDataPacket & { user_id: number })[]>(
      `SELECT user_id FROM password_reset_tokens
       WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()
       LIMIT 1`,
      [tokenHash]
    );
    if (!rows[0]) return null;
    await pool.query<ResultSetHeader>(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ? AND used_at IS NULL`,
      [tokenHash]
    );
    return rows[0].user_id;
  },
};
