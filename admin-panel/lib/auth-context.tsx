"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { apiJson } from "@/lib/api";
import {
  getStoredAccess,
  getStoredPermissions,
  getStoredUser,
  setStoredPermissions,
  setStoredUser,
} from "@/lib/auth-storage";
import { getRoutePermission } from "@/lib/route-permissions";

type AuthUser = { id: number; username: string };

type AuthContextValue = {
  loading: boolean;
  user: AuthUser | null;
  permissions: readonly string[];
  hasPermission: (key: string) => boolean;
  hasAnyPermission: (...keys: string[]) => boolean;
  refreshAuth: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [permissions, setPermissions] = useState<string[]>(() => getStoredPermissions());

  const refreshAuth = useCallback(async () => {
    if (!getStoredAccess()) {
      setUser(null);
      setPermissions([]);
      setLoading(false);
      return;
    }

    const res = await apiJson<{
      user: AuthUser;
      permissions: string[];
    }>("/auth/me");

    if (!res.ok || !res.data) {
      setUser(getStoredUser());
      setPermissions(getStoredPermissions());
      setLoading(false);
      return;
    }

    setUser(res.data.user);
    setPermissions(res.data.permissions);
    setStoredUser(res.data.user);
    setStoredPermissions(res.data.permissions);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refreshAuth();
  }, [refreshAuth]);

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);

  const hasPermission = useCallback(
    (key: string) => permissionSet.has(key),
    [permissionSet]
  );

  const hasAnyPermission = useCallback(
    (...keys: string[]) => keys.some((key) => permissionSet.has(key)),
    [permissionSet]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      loading,
      user,
      permissions,
      hasPermission,
      hasAnyPermission,
      refreshAuth,
    }),
    [loading, user, permissions, hasPermission, hasAnyPermission, refreshAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** View/edit access for the current dashboard route. */
export function useRouteAccess() {
  const pathname = usePathname();
  const { hasPermission, loading } = useAuth();
  const config = getRoutePermission(pathname);

  return useMemo(() => {
    if (!config) {
      return { loading, canView: true, canEdit: false, viewKey: null, editKey: null };
    }

    const canView = hasPermission(config.view);
    const editKey = config.edit ?? null;
    const canEdit = editKey ? hasPermission(editKey) : false;

    return { loading, canView, canEdit, viewKey: config.view, editKey };
  }, [config, hasPermission, loading]);
}

export function useCan(permission: string): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
