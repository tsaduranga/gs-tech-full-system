import type { PermissionKey } from "../constants/permissions.js";

export type AuthUser = {
  id: number;
  username: string;
  permissions: PermissionKey[];
};

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
    }
  }
}

export {};
