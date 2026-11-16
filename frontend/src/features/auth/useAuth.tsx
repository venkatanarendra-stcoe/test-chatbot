import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, setUnauthorizedHandler, tokenStore, type AuthUser } from "@/services/api";

interface AuthCtx {
  user: AuthUser | null;
  lastLogin: string | null;           // the previous sign-in time of this user on this browser
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
const lastKey = (u: string) => `lastLogin:${u}`;
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => (tokenStore.get() ? tokenStore.user() : null));
  const [lastLogin, setLastLogin] = useState<string | null>(() => (user ? read(lastKey(user.username) + ":prev") : null));
  const qc = useQueryClient();

  const clear = useCallback(() => { tokenStore.clear(); setUser(null); qc.clear(); }, [qc]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (!tokenStore.get()) return;
      clear();
      toast.error("Session expired. Please sign in again.");
    });
  }, [clear]);

  const login = useCallback(async (username: string, password: string) => {
    const r = await api.login(username, password);
    qc.clear();
    tokenStore.set(r.access_token, r.user);
    const prev = read(lastKey(username));
    try { localStorage.setItem(lastKey(username) + ":prev", prev ?? ""); localStorage.setItem(lastKey(username), new Date().toISOString()); } catch { /* storage unavailable */ }
    setLastLogin(prev);
    setUser(r.user);
    return r.user;
  }, [qc]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* token may already be invalid */ }
    clear();
  }, [clear]);

  const value = useMemo(() => ({ user, lastLogin, login, logout }), [user, lastLogin, login, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
}
