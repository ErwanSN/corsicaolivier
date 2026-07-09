"use client";

import { type AuthSessionDto } from "@corsica/contracts";
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
import { clearStoredAuthSession, readStoredAccessToken, storeAuthSession } from "./auth-storage";

export type StoredAuthSession = Readonly<{
  clearSession: () => void;
  saveSession: (session: AuthSessionDto) => void;
  session: AuthSessionDto | null;
}>;

const AuthSessionContext = createContext<StoredAuthSession | null>(null);

export function AuthSessionProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<AuthSessionDto | null>(null);

  useEffect(() => {
    let isActive = true;

    async function hydrateSession(): Promise<void> {
      const storedAccessToken = readStoredAccessToken();

      if (!storedAccessToken) {
        return;
      }

      try {
        const user = await apiClient.me(storedAccessToken);

        if (isActive) {
          setSession({ accessToken: storedAccessToken, tokenType: "Bearer", user });
        }
      } catch {
        clearStoredAuthSession();
      }
    }

    void hydrateSession();

    return () => {
      isActive = false;
    };
  }, []);

  const saveSession = useCallback((nextSession: AuthSessionDto) => {
    storeAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    clearStoredAuthSession();
    setSession(null);
  }, []);

  const value = useMemo<StoredAuthSession>(
    () => ({ clearSession, saveSession, session }),
    [clearSession, saveSession, session]
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
