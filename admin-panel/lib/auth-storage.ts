const ACCESS = "pos_access";
const REFRESH = "pos_refresh";
const USER = "pos_user";

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

export { ACCESS, REFRESH };
