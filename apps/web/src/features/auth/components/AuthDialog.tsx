"use client";

import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useRef } from "react";

import { apiClient } from "../../../lib/api-client";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import { useStoredAuthSession } from "../use-stored-auth-session";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { clearSession, saveSession, session } = useStoredAuthSession();
  const switchCopy = switchCopyByMode[mode];

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const handleAuthSubmit = useCallback<AuthSubmitHandler>(
    async (credentials) => {
      const nextSession =
        mode === "createAccount"
          ? await apiClient.register(credentials)
          : await apiClient.login(credentials);

      saveSession(nextSession);
    },
    [mode, saveSession]
  );

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    onClose();
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === dialogRef.current) {
      onClose();
    }
  }

  return (
    <dialog
      aria-labelledby="auth-dialog-title"
      className={styles.dialog}
      onCancel={handleCancel}
      onMouseDown={handleBackdropMouseDown}
      ref={dialogRef}
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
          <AuthSessionCard onLogout={clearSession} session={session} />
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
    </dialog>
  );
}
