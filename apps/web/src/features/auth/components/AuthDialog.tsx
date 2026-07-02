"use client";

import { type AuthSessionDto } from "@corsica/contracts";
import { type MouseEvent, useCallback, useEffect, useState } from "react";

import { apiClient } from "../../../lib/api-client";
import { clearStoredAuthSession, readStoredAccessToken, storeAuthSession } from "../auth-storage";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import { AuthFormPanel } from "./AuthFormPanel";
import { AuthSessionCard } from "./AuthSessionCard";
import styles from "./AuthDialog.module.css";

export type AuthDialogProps = Readonly<{
  mode: AuthFormMode;
  onClose: () => void;
  onModeChange: (mode: AuthFormMode) => void;
}>;

const switchCopyByMode = {
  createAccount: {
    label: "Se connecter",
    mode: "signIn",
    prefix: "Déjà un compte ?"
  },
  signIn: {
    label: "Créer un compte",
    mode: "createAccount",
    prefix: "Pas encore de compte ?"
  }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{
    label: string;
    mode: AuthFormMode;
    prefix: string;
  }>
>;

export function AuthDialog({ mode, onClose, onModeChange }: AuthDialogProps) {
  const [session, setSession] = useState<AuthSessionDto | null>(null);
  const switchCopy = switchCopyByMode[mode];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

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

  const handleAuthSubmit = useCallback<AuthSubmitHandler>(
    async (credentials) => {
      const nextSession =
        mode === "createAccount"
          ? await apiClient.register(credentials)
          : await apiClient.login(credentials);

      storeAuthSession(nextSession);
      setSession(nextSession);
    },
    [mode]
  );

  const handleLogout = useCallback(() => {
    clearStoredAuthSession();
    setSession(null);
  }, []);

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={handleOverlayMouseDown}>
      <section
        aria-labelledby="auth-dialog-title"
        aria-modal="true"
        className={styles.dialog}
        role="dialog"
      >
        <header className={styles.dialogHeader}>
          <button
            aria-label="Fermer l'authentification"
            className={styles.closeButton}
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">×</span>
          </button>

          <h1 className={styles.dialogTitle} id="auth-dialog-title">
            {session ? "Compte" : "Connexion ou inscription"}
          </h1>

          <span aria-hidden="true" className={styles.headerSpacer} />
        </header>

        <div className={styles.dialogBody}>
          {session ? (
            <AuthSessionCard onLogout={handleLogout} session={session} />
          ) : (
            <>
              <AuthFormPanel mode={mode} onSubmit={handleAuthSubmit} />
              <p className={styles.switch}>
                <span>{switchCopy.prefix}</span>
                <button
                  className={styles.switchButton}
                  onClick={() => {
                    onModeChange(switchCopy.mode);
                  }}
                  type="button"
                >
                  {switchCopy.label}
                </button>
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
