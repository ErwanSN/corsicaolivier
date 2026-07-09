"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useStoredAuthSession } from "./use-stored-auth-session";

function isStaffRole(role: string): boolean {
  return role === "ADMIN" || role === "EMPLOYEE";
}

/**
 * Garde-fou de routage par rôle (rendu une fois à la racine) :
 * - un salarié/admin est renvoyé vers l'espace salarié s'il navigue côté client ;
 * - un client est renvoyé vers l'accueil s'il tente d'accéder à /salarie.
 * Les visiteurs non connectés ne sont pas redirigés.
 */
export function RoleRedirect() {
  const { session } = useStoredAuthSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!session) {
      return;
    }

    const onStaffArea = pathname === "/salarie" || pathname.startsWith("/salarie/");
    const staff = isStaffRole(session.user.role);

    if (staff && !onStaffArea) {
      router.replace("/salarie/rechercher");
    } else if (!staff && onStaffArea) {
      router.replace("/");
    }
  }, [pathname, router, session]);

  return null;
}
