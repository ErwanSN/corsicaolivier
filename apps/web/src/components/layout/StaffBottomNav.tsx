"use client";

import { QrCode, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "../../lib/cn";

function itemClass(active: boolean): string {
  return cn(
    "focus-ring flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
    active ? "text-brand" : "text-muted hover:text-foreground"
  );
}

export function StaffBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation salarié"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3 items-end [padding-bottom:env(safe-area-inset-bottom)]">
        <li>
          <Link
            className={itemClass(pathname === "/salarie/rechercher")}
            href="/salarie/rechercher"
          >
            <Search className="size-5" />
            Rechercher
          </Link>
        </li>

        <li>
          <Link className={itemClass(pathname === "/salarie/scan")} href="/salarie/scan">
            <QrCode className="size-5" />
            Scan QR
          </Link>
        </li>

        <li>
          <Link className={itemClass(pathname === "/salarie/compte")} href="/salarie/compte">
            <User className="size-5" />
            Compte
          </Link>
        </li>
      </ul>
    </nav>
  );
}
