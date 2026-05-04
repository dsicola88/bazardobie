import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "../api.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string | null;
  blocked?: boolean;
  logisticsPartnerId?: string | null;
  logisticsPartner?: { id: string; name: string } | null;
};

const STORAGE_KEY = "bazarr_auth";

type Ctx = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  setAuth: (token: string, user: AuthUser) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { token: t, user: u } = JSON.parse(raw) as { token: string; user: AuthUser };
        setToken(t);
        setUser(u);
      }
    } catch {
      /* skip */
    }
    setLoading(false);
  }, []);

  const setAuth = useCallback((t: string, u: AuthUser) => {
    setToken(t);
    setUser(u);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, user: u }));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) return;
    const me = await apiFetch<AuthUser>("/auth/me", { token });
    setUser(me);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: me }));
  }, [token]);

  const value = useMemo(
    () => ({ token, user, loading, setAuth, logout, refreshMe }),
    [token, user, loading, setAuth, logout, refreshMe]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("AuthProvider em falta");
  return c;
}
