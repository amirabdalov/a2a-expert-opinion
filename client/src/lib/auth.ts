import { useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

// In-memory auth state (no localStorage in sandboxed iframe)
let currentUser: Omit<User, "password"> | null = null;
let currentSessionToken: string | null = null;
let listeners: Array<() => void> = [];

function notify() {
  listeners.forEach((fn) => fn());
}

function readUserFromCookie(): Omit<User, "password"> | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)a2a_session=([^;]*)/);
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function readTokenFromCookie(): string | null {
  try {
    const match = document.cookie.match(/(?:^|;\s*)a2a_token=([^;]*)/);
    if (!match) return null;
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

// Restore session from cookie on module load
if (typeof document !== "undefined") {
  const restored = readUserFromCookie();
  const token = readTokenFromCookie();
  if (restored) {
    currentUser = restored;
    currentSessionToken = token;
  }
}

export function setUser(user: Omit<User, "password"> | null) {
  currentUser = user;
  notify();
}

export function getUser() {
  return currentUser;
}

export function getSessionToken(): string | null {
  return currentSessionToken;
}

export function useAuth() {
  const [user, setLocalUser] = useState<Omit<User, "password"> | null>(currentUser);

  useEffect(() => {
    const listener = () => setLocalUser(currentUser);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  const login = useCallback((u: Omit<User, "password"> & { sessionToken?: string; expiresAt?: string }) => {
    const { sessionToken, expiresAt, ...userData } = u;
    setUser(userData);
    currentSessionToken = sessionToken || null;
    // Persist session in cookie (24 hours)
    document.cookie = `a2a_session=${encodeURIComponent(JSON.stringify(userData))}; path=/; max-age=${24 * 60 * 60}; SameSite=None; Secure`;
    // Also set a2a_user cookie for landing page compatibility (24 hours)
    document.cookie = `a2a_user=${encodeURIComponent(JSON.stringify({ name: userData.name, email: userData.email, role: userData.role }))}; path=/; max-age=${24 * 60 * 60}; SameSite=None; Secure`;
    // Store session token in cookie (24h)
    if (sessionToken) {
      document.cookie = `a2a_token=${encodeURIComponent(sessionToken)}; path=/; max-age=${24 * 60 * 60}; SameSite=None; Secure`;
    }
  }, []);

  const logout = useCallback(() => {
    currentSessionToken = null;
    setUser(null);
    // Clear cookies
    document.cookie = "a2a_session=; path=/; max-age=0; SameSite=None; Secure";
    document.cookie = "a2a_user=; path=/; max-age=0; SameSite=None; Secure";
    document.cookie = "a2a_token=; path=/; max-age=0; SameSite=None; Secure";
  }, []);

  return { user, login, logout };
}
