"use client";

import { DropdownMenu as RadixDropdownMenu } from "radix-ui";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

export type DropdownMenuItem = Readonly<{
  active?: boolean;
  key: string;
  label: string;
  leading?: ReactNode;
  onSelect: () => void;
}>;

export type DropdownMenuProps = Readonly<{
  align?: "center" | "end" | "start";
  ariaLabel: string;
  items: readonly DropdownMenuItem[];
  trigger: ReactNode;
}>;

export function DropdownMenu({ align = "end", ariaLabel, items, trigger }: DropdownMenuProps) {
  return (
    <RadixDropdownMenu.Root>
      <RadixDropdownMenu.Trigger aria-label={ariaLabel} asChild>
        {trigger}
      </RadixDropdownMenu.Trigger>

      <RadixDropdownMenu.Portal>
        <RadixDropdownMenu.Content
          align={align}
          className="z-50 min-w-44 rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_52px_rgba(0,0,0,0.18)]"
          sideOffset={8}
        >
          {items.map((item) => (
            <RadixDropdownMenu.Item
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[14px] outline-none select-none data-[highlighted]:bg-foreground/5",
                item.active ? "font-semibold text-brand" : "text-foreground"
              )}
              key={item.key}
              onSelect={item.onSelect}
            >
              {item.leading}
              {item.label}
            </RadixDropdownMenu.Item>
          ))}
        </RadixDropdownMenu.Content>
      </RadixDropdownMenu.Portal>
    </RadixDropdownMenu.Root>
  );
}
