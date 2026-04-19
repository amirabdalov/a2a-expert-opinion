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

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
