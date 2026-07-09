"use client";

import { useCallback, useState } from "react";

import { apiClient } from "../../lib/api-client";
import { type AuthFormMode, type AuthSubmitHandler } from "../auth/auth.types";
import { AuthFormPanel } from "../auth/components/AuthFormPanel";
import { useStoredAuthSession } from "../auth/use-stored-auth-session";

const switchCopyByMode = {
  createAccount: { label: "Se connecter", mode: "signIn", prefix: "Déjà un compte ?" },
  signIn: { label: "Créer un compte", mode: "createAccount", prefix: "Pas encore de compte ?" }
} as const satisfies Record<
  AuthFormMode,
  Readonly<{ label: string; mode: AuthFormMode; prefix: string }>
>;

export function AccountLogin() {
  const { saveSession } = useStoredAuthSession();
  const [mode, setMode] = useState<AuthFormMode>("signIn");
  const switchCopy = switchCopyByMode[mode];

  const handleSubmit = useCallback<AuthSubmitHandler>(
    async ({ identifier, password }) => {
      const nextSession =
        mode === "createAccount"
          ? await apiClient.register({ email: identifier, password })
          : await apiClient.login({ identifier, password });

      // saveSession met à jour le contexte ; le routage par rôle (salarié ->
      // /salarie) est géré globalement par RoleRedirect.
      saveSession(nextSession);
    },
    [mode, saveSession]
  );

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <h1 className="mb-6 text-[22px] font-bold text-foreground">Compte</h1>
      <AuthFormPanel mode={mode} onSubmit={handleSubmit} />
      <p className="mt-6 flex flex-wrap items-center justify-center gap-1.5 text-center text-[14px] text-muted">
        <span>{switchCopy.prefix}</span>
        <button
          className="focus-ring font-semibold text-foreground underline underline-offset-[3px]"
          onClick={() => {
            setMode(switchCopy.mode);
          }}
          type="button"
        >
          {switchCopy.label}
        </button>
      </p>
    </div>
  );
}
