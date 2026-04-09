import { useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";

// In-memory auth state (no localStorage in sandboxed iframe)
let currentUser: Omit<User, "password"> | null = null;
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

// Restore session from cookie on module load
if (typeof document !== "undefined") {
  const restored = readUserFromCookie();
  if (restored) {
    currentUser = restored;
  }
}

export function setUser(user: Omit<User, "password"> | null) {
  currentUser = user;
  notify();
}

export function getUser() {
  return currentUser;
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

  const login = useCallback((u: Omit<User, "password">) => {
    setUser(u);
    // Persist session in cookie (2 years)
    document.cookie = `a2a_session=${encodeURIComponent(JSON.stringify(u))}; path=/; max-age=${730 * 24 * 60 * 60}; SameSite=None; Secure`;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    // Clear cookie
    document.cookie = "a2a_session=; path=/; max-age=0; SameSite=None; Secure";
  }, []);

  return { user, login, logout };
}
