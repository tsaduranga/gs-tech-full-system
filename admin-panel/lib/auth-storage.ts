const ACCESS = "pos_access";
const REFRESH = "pos_refresh";
const USER = "pos_user";
const PERMISSIONS = "pos_permissions";

export function getApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://localhost:4000"
  );
}

export function getStoredAccess(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ACCESS);
}

export function getStoredRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(REFRESH);
}

export function setSessionTokens(access: string, refresh: string): void {
  sessionStorage.setItem(ACCESS, access);
  sessionStorage.setItem(REFRESH, refresh);
}

export function clearSession(): void {
  sessionStorage.removeItem(ACCESS);
  sessionStorage.removeItem(REFRESH);
  sessionStorage.removeItem(USER);
  sessionStorage.removeItem(PERMISSIONS);
}

export function setStoredUser(u: { id: number; username: string }): void {
  sessionStorage.setItem(USER, JSON.stringify(u));
}

export function getStoredUser(): { id: number; username: string } | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(USER);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: number; username: string };
  } catch {
    return null;
  }
}

export function setStoredPermissions(permissions: string[]): void {
  sessionStorage.setItem(PERMISSIONS, JSON.stringify(permissions));
}

export function getStoredPermissions(): string[] {
  if (typeof window === "undefined") return [];
  const raw = sessionStorage.getItem(PERMISSIONS);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    return [];
  }
}

export function hasStoredPermission(key: string): boolean {
  return getStoredPermissions().includes(key);
}

export function hasAnyStoredPermission(...keys: string[]): boolean {
  const set = new Set(getStoredPermissions());
  return keys.some((key) => set.has(key));
}

export { ACCESS, REFRESH };
