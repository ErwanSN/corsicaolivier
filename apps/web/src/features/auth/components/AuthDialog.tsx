"use client";

import { useRouter } from "next/navigation";
import { type MouseEvent, type SyntheticEvent, useCallback, useEffect, useRef } from "react";

import { apiClient } from "../../../lib/api-client";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import { useStoredAuthSession } from "../use-stored-auth-session";
import { AuthFormPanel } from "./AuthFormPanel";
import { AuthSessionCard } from "./AuthSessionCard";

const dialogClassName = [
  "m-auto flex min-w-0 flex-col rounded-xl border border-border bg-surface text-foreground",
  "[box-shadow:0_18px_52px_rgba(0,0,0,0.18)] [overscroll-behavior:contain]",
  "[max-height:calc(100svh-64px-env(safe-area-inset-top)-env(safe-area-inset-bottom))]",
  "[width:min(568px,calc(100vw-48px))] backdrop:bg-overlay",
  "max-[640px]:m-0 max-[640px]:h-[100svh] max-[640px]:max-h-none max-[640px]:w-screen max-[640px]:max-w-none",
  "max-[640px]:rounded-none max-[640px]:border-0 max-[640px]:shadow-none max-[640px]:backdrop:bg-background"
].join(" ");

const dialogHeaderClassName = [
  "grid min-h-16 flex-shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-border px-4",
  "max-[640px]:[padding-top:env(safe-area-inset-top)]",
  "max-[640px]:[padding-left:calc(12px+env(safe-area-inset-left))]",
  "max-[640px]:[padding-right:calc(12px+env(safe-area-inset-right))]"
].join(" ");

const closeButtonClassName = [
  "inline-flex h-9 w-9 items-center justify-center rounded-full",
  "text-[26px] font-normal leading-none text-foreground hover:bg-black/[0.04] focus-ring"
].join(" ");

const dialogBodyClassName = [
  "grid min-w-0 gap-6 overflow-y-auto p-8",
  "max-[640px]:mx-auto max-[640px]:[width:min(326px,calc(100%-48px))]",
  "max-[640px]:[padding:28px_0_calc(28px+env(safe-area-inset-bottom))]"
].join(" ");

const switchButtonClassName =
  "font-semibold text-foreground underline underline-offset-[3px] focus-ring";

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
  const router = useRouter();
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
    async ({ identifier, password }) => {
      const nextSession =
        mode === "createAccount"
          ? await apiClient.register({ email: identifier, password })
          : await apiClient.login({ identifier, password });

      saveSession(nextSession);

      // Les salariés/admins basculent sur le dashboard salarié.
      const { role } = nextSession.user;
      if (role === "EMPLOYEE" || role === "ADMIN") {
        onClose();
        router.push("/salarie");
      }
    },
    [mode, onClose, router, saveSession]
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
      className={dialogClassName}
      onCancel={handleCancel}
      onMouseDown={handleBackdropMouseDown}
      ref={dialogRef}
    >
      <header className={dialogHeaderClassName}>
        <button
          aria-label="Fermer l'authentification"
          className={closeButtonClassName}
          onClick={onClose}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>

        <h1
          className="text-center text-[16px] font-semibold leading-[22px] text-foreground"
          id="auth-dialog-title"
        >
          {session ? "Compte" : "Connexion ou inscription"}
        </h1>

        <span aria-hidden="true" className="block h-9 w-9" />
      </header>

      <div className={dialogBodyClassName}>
        {session ? (
          <AuthSessionCard onLogout={clearSession} session={session} />
        ) : (
          <>
            <AuthFormPanel mode={mode} onSubmit={handleAuthSubmit} />
            <p className="flex flex-wrap items-center justify-center gap-[5px] text-center text-[14px] leading-5 text-muted">
              <span>{switchCopy.prefix}</span>
              <button
                className={switchButtonClassName}
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
