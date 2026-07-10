import { type NavItem } from "../ds/NavBar";

export const navItems: readonly NavItem[] = [
  { href: "/", label: "Réserver" },
  { disabled: true, href: "/vie-a-bord", label: "Vie à bord" },
  { disabled: true, href: "/fret", label: "Fret" },
  { disabled: true, href: "/la-compagnie", label: "La compagnie" },
  { disabled: true, href: "/nos-engagements", label: "Nos engagements" }
];
