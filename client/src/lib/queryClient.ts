import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getToken } from "./auth";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  // Admin token takes priority (for admin panel), user JWT is fallback
  const adminToken = sessionStorage.getItem("adminToken");
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

/** BUG-1 fix: Build a file download URL with ?token=JWT so <a href> links authenticate properly */
export function getFileDownloadUrl(path: string): string {
  const adminToken = sessionStorage.getItem("adminToken");
  const token = adminToken || getToken();
  const separator = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${token ? `${separator}token=${token}` : ""}`;
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
