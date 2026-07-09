"use client";

import { User } from "lucide-react";
import Link from "next/link";

import { useStoredAuthSession } from "../auth/use-stored-auth-session";

export function AccountButton() {
  const { session } = useStoredAuthSession();

  return (
    <Link
      aria-label={session ? `Compte de ${session.user.username}` : "Compte"}
      className="focus-ring inline-flex size-10 items-center justify-center rounded-full border border-border bg-surface text-foreground transition hover:border-foreground/30"
      href="/compte"
    >
      <User className="size-4.5" />
    </Link>
  );
}
