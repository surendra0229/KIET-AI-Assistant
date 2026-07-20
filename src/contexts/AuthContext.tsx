import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, setAuthToken, registerUnauthorizedCallback, type AuthUser } from "@/services/api";

export type Role = "SUPER_ADMIN" | "ADMIN" | "STUDENT";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

const STORAGE_KEY = "college_ai_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerUnauthorizedCallback(() => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      setAuthToken(null);
      setToken(null);
      setUser(null);
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    setAuthToken(stored);
    setToken(stored);
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
        setToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, res.accessToken);
    }
    setAuthToken(res.accessToken);
    setToken(res.accessToken);
    setUser(res.user);
    return res.user;
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      /* ignore — token discarded regardless */
    }
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    setAuthToken(null);
    setToken(null);
    setUser(null);
  };

  const refresh = async () => {
    try {
      const u = await api.me();
      setUser(u);
    } catch {
      await logout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function defaultRouteForRole(role: Role | string | undefined): string {
  if (role === "STUDENT") return "/chat";
  if (role === "ADMIN" || role === "SUPER_ADMIN") return "/dashboard";
  return "/login";
}

export function canAccessRoute(role: Role | string | undefined, path: string): boolean {
  if (!role) return false;
  if (path.startsWith("/change-password")) return true;
  if (path.startsWith("/admins")) return role === "SUPER_ADMIN";
  if (path.startsWith("/students")) return role === "SUPER_ADMIN" || role === "ADMIN";
  if (role === "SUPER_ADMIN" || role === "ADMIN") return true;
  // STUDENT
  return path.startsWith("/chat") || path.startsWith("/profile");
}
