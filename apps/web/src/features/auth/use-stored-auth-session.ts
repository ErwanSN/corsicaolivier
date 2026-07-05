import { type AuthSessionDto } from "@corsica/contracts";
import { useCallback, useEffect, useState } from "react";

import { apiClient } from "../../lib/api-client";
import { clearStoredAuthSession, readStoredAccessToken, storeAuthSession } from "./auth-storage";

export type StoredAuthSession = Readonly<{
  clearSession: () => void;
  saveSession: (session: AuthSessionDto) => void;
  session: AuthSessionDto | null;
}>;

export function useStoredAuthSession(): StoredAuthSession {
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
          setSession({
            accessToken: storedAccessToken,
            tokenType: "Bearer",
            user
          });
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

  return {
    clearSession,
    saveSession,
    session
  };
}
