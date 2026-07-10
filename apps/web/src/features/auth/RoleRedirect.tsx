"use client";

import { usePathname, useRouter } from "next/navigation";
import { type Route } from "next";
import { useEffect } from "react";

import { useStoredAuthSession } from "./use-stored-auth-session";
import { type WebAuthSession } from "./web-auth-session";

function isStaffRole(role: string): boolean {
  return role === "ADMIN" || role === "EMPLOYEE";
}

/**
 * Garde-fou de routage par rôle (rendu une fois à la racine) :
 * - un salarié/admin est renvoyé vers l'espace salarié s'il navigue côté client ;
 * - un client est renvoyé vers l'accueil s'il tente d'accéder à /salarie.
 * Les visiteurs sont renvoyés vers la connexion avant d'afficher l'espace salarié.
 */
export function RoleRedirect() {
  const { session, status } = useStoredAuthSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const destination = getRoleRedirect(pathname, status, session);
    if (destination) router.replace(destination);
  }, [pathname, router, session, status]);

  return null;
}

function getRoleRedirect(
  pathname: string,
  status: "anonymous" | "authenticated" | "loading",
  session: WebAuthSession | null
): Route | null {
  if (status === "loading") return null;
  if (!session) return isPathWithin(pathname, "/salarie") ? "/compte" : null;
  return isStaffRole(session.user.role)
    ? getStaffRedirect(pathname)
    : isPathWithin(pathname, "/salarie")
      ? "/"
      : null;
}

function getStaffRedirect(pathname: string): Route | null {
  if (isPathWithin(pathname, "/salarie") || isPathWithin(pathname, "/port")) return null;
  return "/salarie/rechercher";
}

function isPathWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}
