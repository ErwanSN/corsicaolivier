"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";

import { apiClient } from "../../lib/api-client";
import { type WebAuthSession } from "./web-auth-session";

export type StoredAuthSession = Readonly<{
  clearSession: () => void;
  saveSession: (session: WebAuthSession) => void;
  session: WebAuthSession | null;
  status: "anonymous" | "authenticated" | "loading";
}>;

const AuthSessionContext = createContext<StoredAuthSession | null>(null);
const legacyAuthTokenStorageKey = "corsica.auth.accessToken";

export function AuthSessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<WebAuthSession | null>(null);
  const [status, setStatus] = useState<StoredAuthSession["status"]>("loading");

  useEffect(() => {
    let isActive = true;

    async function hydrateSession(): Promise<void> {
      window.localStorage.removeItem(legacyAuthTokenStorageKey);
      try {
        const user = await apiClient.me();

        if (isActive) {
          setSession({ user });
          setStatus("authenticated");
        }
      } catch {
        if (isActive) setStatus("anonymous");
      }
    }

    void hydrateSession();

    return () => {
      isActive = false;
    };
  }, []);

  const saveSession = useCallback((nextSession: WebAuthSession) => {
    setSession(nextSession);
    setStatus("authenticated");
  }, []);

  const clearSession = useCallback(() => {
    void apiClient.logout().catch(() => undefined);
    setSession(null);
    setStatus("anonymous");
  }, []);

  const value = useMemo<StoredAuthSession>(
    () => ({ clearSession, saveSession, session, status }),
    [clearSession, saveSession, session, status]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useStoredAuthSession(): StoredAuthSession {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error("useStoredAuthSession must be used within an AuthSessionProvider.");
  }

  return context;
}
