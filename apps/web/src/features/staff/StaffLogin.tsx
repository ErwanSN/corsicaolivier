"use client";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { apiClient } from "../../lib/api-client";
import { type AuthSubmitHandler } from "../auth/auth.types";
import { AuthFormPanel } from "../auth/components/AuthFormPanel";
import { useStoredAuthSession } from "../auth/use-stored-auth-session";

export function StaffLogin() {
  const { saveSession } = useStoredAuthSession();
  const router = useRouter();
  const [accessError, setAccessError] = useState(false);
  const handleSubmit = useCallback<AuthSubmitHandler>(
    async ({ identifier, password }) => {
      const user = await apiClient.loginWeb({ identifier, password });
      saveSession({ user });
      if (user.role === "USER") {
        setAccessError(true);
        return;
      }
      router.replace("/salarie/rechercher");
    },
    [router, saveSession]
  );
  return (
    <main className="grid min-h-svh place-items-center bg-background px-4 py-10" id="main-content">
      <section className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-lg sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-brand">
          Espace interne
        </p>
        <h1 className="mb-2 text-2xl font-bold">Connexion salarié</h1>
        <p className="mb-7 text-sm text-muted">
          Accès réservé aux salariés et administrateurs Corsica Linea.
        </p>
        <AuthFormPanel mode="signIn" onSubmit={handleSubmit} />
        {accessError ? (
          <p className="mt-4 text-sm text-danger" role="alert">
            Ce compte est un compte client. Utilisez le site client.
          </p>
        ) : null}
        <a className="mt-6 block text-center text-sm font-semibold text-brand underline" href="/">
          Retour au site client
        </a>
      </section>
    </main>
  );
}
