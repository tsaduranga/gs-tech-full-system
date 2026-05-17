import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";
import { verifyAccessToken } from "../utils/jwt.js";
import type { PermissionKey } from "../constants/permissions.js";
import { userModel } from "../models/userModel.js";

async function bearerToken(req: Request): Promise<string | null> {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = await bearerToken(req);
    if (!token) throw new HttpError(401, "Unauthorized");

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch {
      throw new HttpError(401, "Invalid or expired token");
    }

    const permissions = await userModel.getPermissionKeys(payload.sub);
    req.authUser = {
      id: payload.sub,
      username: payload.username,
      permissions: permissions as PermissionKey[],
    };
    next();
  } catch (e) {
    next(e);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = await bearerToken(req);
    if (!token) return next();

    try {
      const payload = verifyAccessToken(token);
      const permissions = await userModel.getPermissionKeys(payload.sub);
      req.authUser = {
        id: payload.sub,
        username: payload.username,
        permissions: permissions as PermissionKey[],
      };
    } catch {
      /* ignore */
    }
    next();
  } catch (e) {
    next(e);
  }
}
