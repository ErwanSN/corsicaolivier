"use client";

import { type AuthSessionDto } from "@corsica/contracts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { recentControls } from "../staff/control-history";
import { ControlHistoryItem } from "../staff/ControlHistoryItem";
import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { AccountRow } from "./AccountRow";

const recentControlsPreviewCount = 3;

function Section({ children, title }: Readonly<{ children: ReactNode; title: string }>) {
  return (
    <section className="mt-6">
      <h2 className="mb-2.5 text-[15px] font-medium text-muted">{title}</h2>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

export function AccountDetails({
  session,
  variant
}: Readonly<{ session: AuthSessionDto; variant: "client" | "staff" }>) {
  const router = useRouter();
  const { clearSession } = useStoredAuthSession();

  function handleLogout(): void {
    clearSession();
    router.push("/");
  }

  const memberSince = format(new Date(session.user.createdAt), "d MMMM yyyy", { locale: fr });

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Compte</h1>

      <Section title="Informations">
        <AccountRow subtitle={`Membre depuis le ${memberSince}`} title={session.user.username} />
        <AccountRow title="Demander une modification de mot de passe" />
      </Section>

      <Section title="Historique">
        {variant === "staff" ? (
          <>
            {recentControls.slice(0, recentControlsPreviewCount).map((control) => (
              <ControlHistoryItem control={control} key={control.id} />
            ))}
            {recentControls.length > recentControlsPreviewCount ? (
              <AccountRow
                href="/salarie/historique"
                subtitle={`${String(recentControls.length)} contrôles enregistrés`}
                title="Voir tout l’historique"
              />
            ) : null}
          </>
        ) : (
          <AccountRow
            subtitle="Vos billets, cartes, justificatifs de voyage…"
            title="Vos titres de transport"
          />
        )}
      </Section>

      <Section title="Accessibilité">
        <AccountRow
          href="tel:0000"
          subtitle="Un risque pour votre sécurité ou celle des autres ?"
          title="Numéro d’alerte 0000"
        />
        <AccountRow subtitle="Posez-nous une question" title="Besoin d’aide ?" />
      </Section>

      <div className="mt-8">
        <AccountRow
          onClick={handleLogout}
          title="Se Déconnecter"
          tone="danger"
          trailing={<LogOut className="size-5" />}
        />
      </div>
    </div>
  );
}
