"use client";

import { useStoredAuthSession } from "../auth/use-stored-auth-session";
import { AccountDetails } from "./AccountDetails";
import { AccountLogin } from "./AccountLogin";

export function AccountScreen({ variant }: Readonly<{ variant: "client" | "staff" }>) {
  const { session } = useStoredAuthSession();

  if (!session) {
    return <AccountLogin />;
  }

  return <AccountDetails session={session} variant={variant} />;
}
