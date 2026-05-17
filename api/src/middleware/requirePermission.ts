import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "../constants/permissions.js";
import { HttpError } from "../utils/httpError.js";

export function requirePermission(...keys: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) return next(new HttpError(401, "Unauthorized"));
    const ok = keys.some((k) => req.authUser!.permissions.includes(k));
    if (!ok) return next(new HttpError(403, "Forbidden"));
    next();
  };
}
