"use client";

import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { AccountDetails } from "./AccountDetails";
import { AccountLogin } from "./AccountLogin";

export function AccountScreen({ variant }: Readonly<{ variant: "client" | "staff" }>) {
  const { session, status } = useStoredAuthSession();

  if (status === "loading") {
    return (
      <div
        aria-label="Chargement du compte"
        className="mx-auto mt-12 h-48 w-full max-w-md animate-pulse rounded-3xl bg-foreground/5"
        role="status"
      />
    );
  }

  return (
    <div className="lg:flex lg:min-h-[calc(100svh-7.5rem)] lg:items-center">
      {session ? <AccountDetails session={session} variant={variant} /> : <AccountLogin />}
    </div>
  );
}
