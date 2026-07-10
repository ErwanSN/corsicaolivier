"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Modal } from "../../../components/ds/Modal";
import { apiClient } from "../../../lib/api-client";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth.types";
import { useStoredAuthSession } from "../use-stored-auth-session";
import { AuthFormPanel } from "./AuthFormPanel";
import { AuthSessionCard } from "./AuthSessionCard";

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
  const { clearSession, saveSession, session } = useStoredAuthSession();
  const switchCopy = switchCopyByMode[mode];

  const handleAuthSubmit = useCallback<AuthSubmitHandler>(
    async ({ identifier, password }) => {
      const user =
        mode === "createAccount"
          ? await apiClient.registerWeb({ email: identifier, password })
          : await apiClient.loginWeb({ identifier, password });

      saveSession({ user });

      const { role } = user;
      if (role === "EMPLOYEE" || role === "ADMIN") {
        onClose();
        router.push("/salarie");
      }
    },
    [mode, onClose, router, saveSession]
  );

  return (
    <Modal onClose={onClose} title={session ? "Compte" : "Connexion ou inscription"}>
      {session ? (
        <AuthSessionCard onLogout={clearSession} session={session} />
      ) : (
        <div className="grid min-w-0 gap-6">
          <AuthFormPanel mode={mode} onSubmit={handleAuthSubmit} />
          <p className="flex flex-wrap items-center justify-center gap-1.5 text-center text-[14px] leading-5 text-muted">
            <span>{switchCopy.prefix}</span>
            <button
              className="focus-ring font-semibold text-foreground underline underline-offset-[3px]"
              onClick={() => {
                onModeChange(switchCopy.mode);
              }}
              type="button"
            >
              {switchCopy.label}
            </button>
          </p>
        </div>
      )}
    </Modal>
  );
}
