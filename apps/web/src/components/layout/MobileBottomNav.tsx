"use client";

import { Compass, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { cn } from "../../lib/cn";
import { DropdownMenu } from "../ds/DropdownMenu";
import { navItems } from "./nav-items";

function itemClass(active: boolean): string {
  return cn(
    "focus-ring flex w-full flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition",
    active ? "text-brand" : "text-muted hover:text-foreground"
  );
}

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-sm lg:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-3 items-end [padding-bottom:env(safe-area-inset-bottom)]">
        <li>
          <Link className={itemClass(pathname === "/")} href="/">
            <Search className="size-5" />
            Rechercher
          </Link>
        </li>

        <li>
          <DropdownMenu
            align="center"
            ariaLabel="Naviguer"
            items={navItems.map((item) => ({
              active: Boolean(item.active),
              key: item.href,
              label: item.label,
              onSelect: () => {
                router.push(item.href);
              }
            }))}
            trigger={
              <button className={itemClass(false)} type="button">
                <Compass className="size-5" />
                Naviguer
              </button>
            }
          />
        </li>

        <li>
          <Link className={itemClass(pathname === "/compte")} href="/compte">
            <User className="size-5" />
            Compte
          </Link>
        </li>
      </ul>
    </nav>
  );
}
