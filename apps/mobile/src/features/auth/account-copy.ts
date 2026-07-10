import { type Role } from "@corsica/contracts";

export const mobileAccountCopy: Readonly<
  Record<Role, Readonly<{ title: string; subtitle: string }>>
> = {
  ADMIN: {
    subtitle: "Accès aux outils d’administration et opérations",
    title: "Espace administrateur"
  },
  EMPLOYEE: { subtitle: "Accès aux opérations et contrôles portuaires", title: "Espace salarié" },
  USER: { subtitle: "Retrouvez vos voyages et services passagers", title: "Espace client" }
};
