import { type NavItem } from "../ds/NavBar";

export const navItems: readonly NavItem[] = [
  { href: "/", label: "Réserver" },
  { href: "/preparez-votre-voyage", label: "Préparez votre voyage" },
  { href: "/vie-a-bord", label: "Vie à bord" },
  { href: "/fret", label: "Fret" },
  { href: "/la-compagnie", label: "La compagnie" },
  { active: true, href: "/nos-engagements", label: "Nos engagements" }
];
