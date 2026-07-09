"use client";

import Link from "next/link";
import { NavigationMenu } from "radix-ui";

import { cn } from "../../lib/cn";

export type NavItem = Readonly<{
  active?: boolean;
  href: string;
  label: string;
}>;

export function NavBar({ items }: Readonly<{ items: readonly NavItem[] }>) {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List className="flex items-center gap-0.5">
        {items.map((item) => (
          <NavigationMenu.Item key={item.href}>
            <NavigationMenu.Link active={Boolean(item.active)} asChild>
              <Link
                className={cn(
                  "rounded-full px-3 py-2 text-[15px] font-medium transition hover:text-brand",
                  item.active ? "text-emerald-600" : "text-foreground"
                )}
                href={item.href}
              >
                {item.label}
              </Link>
            </NavigationMenu.Link>
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
