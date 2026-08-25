"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, TOKEN_KEY, USER_KEY, api } from "./api";
import type { AuthResponse, AuthUser } from "./types";

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the stored session has been read and validated */
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function persist(auth: AuthResponse): AuthUser {
  const { token, type: _type, ...user } = auth;
  void _type;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

interface Session {
  user: AuthUser | null;
  loading: boolean;
}

/** Reads the cached session written at the last sign-in. */
function readStoredUser(): AuthUser | null {
  const stored = window.localStorage.getItem(USER_KEY);
  const token = window.localStorage.getItem(TOKEN_KEY);
  if (!stored || !token) return null;

  try {
    return JSON.parse(stored) as AuthUser;
  } catch {
    window.localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ user: null, loading: true });
  const { user, loading } = session;

  // Restore the cached session on boot, then confirm the token is still good.
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      const cached = readStoredUser();

      if (!cached) {
        if (!cancelled) setSession({ user: null, loading: false });
        return;
      }

      // Show the cached user straight away so the header does not flicker
      if (!cancelled) setSession({ user: cached, loading: true });

      try {
        const { token: _token, type: _type, ...fresh } = await api.me(controller.signal);
        void _token;
        void _type;
        window.localStorage.setItem(USER_KEY, JSON.stringify(fresh));
        if (!cancelled) setSession({ user: fresh, loading: false });
      } catch (error) {
        if (cancelled) return;

        // Only sign out on a genuine auth rejection — a backend that is simply
        // down should not wipe a valid session.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          window.localStorage.removeItem(TOKEN_KEY);
          window.localStorage.removeItem(USER_KEY);
          setSession({ user: null, loading: false });
        } else {
          setSession({ user: cached, loading: false });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setSession({ user: persist(await api.login({ username, password })), loading: false });
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    setSession({ user: persist(await api.register({ username, email, password })), loading: false });
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    setSession({ user: persist(await api.loginWithGoogle(idToken)), loading: false });
  }, []);

  const logout = useCallback(() => {
    window.localStorage.removeItem(TOKEN_KEY);
    window.localStorage.removeItem(USER_KEY);
    setSession({ user: null, loading: false });
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, loginWithGoogle, logout }),
    [user, loading, login, register, loginWithGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}
