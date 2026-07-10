"use client";

import Link from "next/link";
import { type Route } from "next";
import { usePathname } from "next/navigation";
import { NavigationMenu } from "radix-ui";

import { cn } from "../../lib/cn";

type NavItemBase = Readonly<{
  active?: boolean;
  label: string;
}>;

export type NavItem = NavItemBase &
  ({ disabled: true; href: string } | { disabled?: false; href: Route });

export function NavBar({ items }: Readonly<{ items: readonly NavItem[] }>) {
  const pathname = usePathname();

  return (
    <NavigationMenu.Root>
      <NavigationMenu.List className="flex items-center gap-0.5">
        {items.map((item) => (
          <NavigationMenu.Item key={item.href}>
            {item.disabled ? (
              <span
                aria-disabled="true"
                className="cursor-not-allowed rounded-full px-3 py-2 text-[15px] font-medium text-muted"
                title="Page bientôt disponible"
              >
                {item.label}
              </span>
            ) : (
              <NavigationMenu.Link active={item.active ?? pathname === item.href} asChild>
                <Link
                  className={cn(
                    "focus-ring rounded-full px-3 py-2 text-[15px] font-medium transition hover:text-brand",
                    (item.active ?? pathname === item.href) ? "text-brand" : "text-foreground"
                  )}
                  href={item.href}
                >
                  {item.label}
                </Link>
              </NavigationMenu.Link>
            )}
          </NavigationMenu.Item>
        ))}
      </NavigationMenu.List>
    </NavigationMenu.Root>
  );
}
