"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

export function PermissionGate({
  permission,
  permissions,
  mode = "any",
  fallback = null,
  children,
}: {
  permission?: string;
  permissions?: readonly string[];
  mode?: "any" | "all";
  fallback?: ReactNode;
  children: ReactNode;
}) {
  const { hasPermission, hasAnyPermission } = useAuth();

  const keys = permissions ?? (permission ? [permission] : []);
  if (keys.length === 0) return children;

  const allowed =
    mode === "all"
      ? keys.every((key) => hasPermission(key))
      : hasAnyPermission(...keys);

  return allowed ? children : fallback;
}
