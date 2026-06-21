import {
  clearSession,
  getApiBase,
  getStoredAccess,
  getStoredRefresh,
  setSessionTokens,
} from "./auth-storage";

let refreshPromise: Promise<boolean> | null = null;

function messageFromBadResponse(data: unknown, fallback: string): string {
  if (typeof data !== "object" || data === null) return fallback;

  const o = data as {
    error?: unknown;
    details?: {
      fieldErrors?: Record<string, string[] | undefined>;
      formErrors?: string[] | undefined;
    };
  };

  const fe = o.details?.fieldErrors;
  if (fe && typeof fe === "object") {
    const parts: string[] = [];
    for (const [field, errs] of Object.entries(fe)) {
      if (!errs?.length) continue;
      for (const msg of errs) parts.push(`${field}: ${msg}`);
    }
    if (parts.length) return parts.join(" • ");
  }

  const fe2 = o.details?.formErrors;
  if (fe2?.length) return fe2.join(" • ");

  if (typeof o.error === "string" && o.error.trim()) return o.error.trim();
  return fallback;
}

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refresh = getStoredRefresh();
    if (!refresh) return false;
    const res = await fetch(`${getApiBase()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) {
      clearSession();
      return false;
    }
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
    };
    setSessionTokens(data.accessToken, data.refreshToken);
    return true;
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export async function apiJson<T>(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  const useAuth = init?.auth !== false;
  const access = useAuth ? getStoredAccess() : null;
  if (useAuth && access) headers.set("Authorization", `Bearer ${access}`);

  const url = `${getApiBase()}${path.startsWith("/") ? "" : "/"}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reach the API";
    return { ok: false, status: 0, data: null, error: message };
  }

  if (res.status === 401 && useAuth) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const h2 = new Headers(init?.headers);
      if (init?.body && !h2.has("Content-Type"))
        h2.set("Content-Type", "application/json");
      const a2 = getStoredAccess();
      if (a2) h2.set("Authorization", `Bearer ${a2}`);
      try {
        res = await fetch(url, { ...init, headers: h2 });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not reach the API";
        return { ok: false, status: 0, data: null, error: message };
      }
    }
  }

  let data: T | null = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text) as T;
    } catch {
      data = text as unknown as T;
    }
  }

  if (!res.ok) {
    const err =
      typeof data === "object" && data !== null
        ? messageFromBadResponse(data, res.statusText)
        : res.statusText;
    return { ok: false, status: res.status, data, error: err };
  }

  return { ok: true, status: res.status, data };
}
