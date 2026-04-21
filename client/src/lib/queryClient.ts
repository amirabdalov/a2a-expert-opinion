import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "./auth";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // Admin token takes priority (for admin panel), user JWT is fallback
  const adminToken = localStorage.getItem("adminToken");
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  } else {
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Build 45 (AA bugs #1/#6): centralized session-invalid handler. When the server
// says the JWT is invalid/expired (TOKEN_INVALID or TOKEN_EXPIRED), we clear the
// cookies + in-memory token and send the user back to /login with a friendly
// message, rather than surfacing a red "401: {...}" toast from the middle of a form.
// Skips admin routes (admin has its own auth flow).
let sessionRedirectInFlight = false;
function handleSessionInvalid(code: string, message: string) {
  if (sessionRedirectInFlight) return;
  sessionRedirectInFlight = true;
  try {
    // Clear user session cookies
    document.cookie = "a2a_session=; path=/; max-age=0; SameSite=None; Secure";
    document.cookie = "a2a_user=; path=/; max-age=0; SameSite=None; Secure";
    document.cookie = "a2a_token=; path=/; max-age=0; SameSite=None; Secure";
    // Stash a one-shot banner for the login page to display
    sessionStorage.setItem(
      "a2a_session_expired",
      JSON.stringify({ code, message, at: Date.now() }),
    );
  } catch {}
  // Redirect to login — but only if we're on an authenticated route
  const hash = window.location.hash || "";
  const onAuthRoute = /^#\/(login|register|$|\?|\/)/.test(hash) || hash === "";
  if (!onAuthRoute) {
    window.location.hash = "/login";
    // Hard reload so any in-memory state that still thinks we're logged in is cleared
    setTimeout(() => window.location.reload(), 50);
  } else {
    sessionRedirectInFlight = false;
  }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Build 45: for 401s with TOKEN_INVALID/TOKEN_EXPIRED on user (non-admin) routes,
    // auto-clear the dead session and redirect to login. We clone the response so we
    // don't consume the body before the caller can read it.
    if (res.status === 401) {
      const isAdminRoute = typeof window !== "undefined" && window.location.hash.startsWith("#/admin");
      const hasAdminToken = typeof localStorage !== "undefined" && !!localStorage.getItem("adminToken");
      if (!isAdminRoute && !hasAdminToken) {
        try {
          const body = await res.clone().json();
          if (body?.code === "TOKEN_INVALID" || body?.code === "TOKEN_EXPIRED" || body?.code === "AUTH_REQUIRED") {
            handleSessionInvalid(body.code, body.message || "Your session expired. Please log in again.");
          }
        } catch {}
      }
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/** Safely coerce a value to an array. Handles null, undefined, objects, and non-array types. */
export function safeArray<T = any>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  return [];
}

/** BUG-1 fix: Build a file download URL with ?token=JWT so <a href> links authenticate properly.
 *  Also tries cookie-based token as fallback (covers edge cases where in-memory token is lost on refresh). */
export function getFileDownloadUrl(path: string): string {
  const adminToken = localStorage.getItem("adminToken");
  let token = adminToken || getToken();
  // Fallback: read token directly from cookie if in-memory token is null
  if (!token) {
    try {
      const match = document.cookie.match(/(?:^|;\s*)a2a_token=([^;]*)/);
      if (match) token = decodeURIComponent(match[1]);
    } catch {}
  }
  if (!token || token === "null" || token === "undefined") {
    // No valid token — return plain URL; the server will return 401
    // but at least we won't send a garbage token
    return `${API_BASE}${path}`;
  }
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${separator}token=${encodeURIComponent(token)}`;
}

/** BUG-1 robust fix: Programmatic file download using fetch() with Authorization header.
 *  This works even if the token can't be embedded in a URL (e.g., very long tokens).
 *  Falls back to token-in-URL approach if fetch fails. */
export async function downloadFile(apiPath: string, filename: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}${apiPath}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error(`${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  } catch {
    // Fallback: open the token-URL in a new tab
    window.open(getFileDownloadUrl(apiPath), "_blank");
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join("/")}`, {
      headers: getAuthHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Build 44 Fix 1: Real-time UI updates — make data freshness the default so users see
// changes (credits, messages, requests) without needing to logout/re-login. The previous
// defaults (staleTime: Infinity, refetchOnWindowFocus: false) meant queries were cached
// forever until explicit invalidation, causing the stale-balance/stale-messages complaints.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      // Poll every 15s by default — tabs in background get paused by RQ automatically.
      refetchInterval: 15000,
      // Refetch when the tab regains focus (e.g. user comes back from another tab).
      refetchOnWindowFocus: true,
      // Refetch when a component first subscribes to a query (even if cached).
      refetchOnMount: true,
      // Consider data stale after 5s — any subscriber triggers a refetch.
      staleTime: 5000,
      // Keep cached data for 5 min so navigation feels instant but fresh.
      gcTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
