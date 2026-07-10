"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { LogOut, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode } from "react";

import { ControlHistoryPreview } from "../staff/ControlHistoryPreview";
import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { type WebAuthSession } from "../auth/web-auth-session";
import { AccountRow } from "./AccountRow";
import { AccountSecurity } from "./AccountSecurity";

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
}: Readonly<{ session: WebAuthSession; variant: "client" | "staff" }>) {
  const router = useRouter();
  const { clearSession } = useStoredAuthSession();

  function handleLogout(): void {
    clearSession();
    router.push("/");
  }

  const memberSince = format(new Date(session.user.createdAt), "d MMMM yyyy", { locale: fr });
  const roleLabel =
    session.user.role === "ADMIN"
      ? "Administrateur"
      : session.user.role === "EMPLOYEE"
        ? "Employé"
        : "Client";

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[22px] font-bold text-foreground">Compte {roleLabel.toLowerCase()}</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-[12px] font-semibold">
          <ShieldCheck className="size-4" /> {roleLabel}
        </span>
      </div>

      <Section title="Informations">
        <AccountRow subtitle={`Membre depuis le ${memberSince}`} title={session.user.username} />
        <AccountSecurity session={session} />
      </Section>

      {session.user.role === "ADMIN" ? (
        <Section title="Administration">
          <AccountRow
            href="/port/admin"
            subtitle="Parcours, points d’intérêt et navires"
            title="Administrer la carte du port"
          />
        </Section>
      ) : null}

      <Section title="Historique">
        {variant === "staff" ? (
          <ControlHistoryPreview />
        ) : (
          <AccountRow
            subtitle="Aucun titre synchronisé avec ce compte local"
            title="Titres de transport"
          />
        )}
      </Section>

      <Section title="Accessibilité">
        <AccountRow
          href="tel:+33825888088"
          subtitle="0,15 € TTC/min · horaires sur le site officiel"
          title="Service client · 0825 88 80 88"
        />
        <AccountRow
          href="https://www.corsicalinea.com/la-compagnie/nous-contacter/contactez-nous"
          subtitle="Formulaire sur le site officiel"
          title="Nous envoyer un message"
        />
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
