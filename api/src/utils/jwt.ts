import jwt, { type SignOptions } from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

export type AccessPayload = { sub: number; username: string };
export type RefreshPayload = { sub: number; jti: string; typ: "refresh" };

const accessSignOpts = { expiresIn: env.JWT_ACCESS_EXPIRES } as SignOptions;
const refreshSignOpts = { expiresIn: env.JWT_REFRESH_EXPIRES } as SignOptions;

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(
    { sub: payload.sub, username: payload.username },
    env.JWT_ACCESS_SECRET,
    accessSignOpts
  );
}

export function signRefreshToken(userId: number): { token: string; jti: string } {
  const jti = randomUUID();
  const token = jwt.sign(
    { sub: userId, jti, typ: "refresh" } satisfies RefreshPayload,
    env.JWT_REFRESH_SECRET,
    refreshSignOpts
  );
  return { token, jti };
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessPayload & jwt.JwtPayload;
  const sub = typeof decoded.sub === "string" ? Number(decoded.sub) : decoded.sub;
  if (typeof sub !== "number" || Number.isNaN(sub)) {
    throw new Error("Invalid access token");
  }
  return { sub, username: String(decoded.username ?? "") };
}

export function verifyRefreshToken(token: string): RefreshPayload {
  const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshPayload & jwt.JwtPayload;
  const sub = typeof decoded.sub === "string" ? Number(decoded.sub) : decoded.sub;
  if (decoded.typ !== "refresh" || typeof decoded.jti !== "string" || typeof sub !== "number" || Number.isNaN(sub)) {
    throw new Error("Invalid refresh token");
  }
  return { sub, jti: decoded.jti, typ: "refresh" };
}

export function decodeRefreshExpirySeconds(): number {
  const raw = env.JWT_REFRESH_EXPIRES;
  const m = /^(\d+)([dhms])$/i.exec(raw.trim());
  if (!m) return 60 * 60 * 24 * 7;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u === "d") return n * 86400;
  if (u === "h") return n * 3600;
  if (u === "m") return n * 60;
  return n;
}
