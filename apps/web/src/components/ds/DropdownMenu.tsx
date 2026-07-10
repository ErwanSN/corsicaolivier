"use client";

import { DropdownMenu as RadixDropdownMenu } from "radix-ui";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";
import { floatingItemClassName, floatingSurfaceClassName } from "./floating-surface";

export type DropdownMenuItem = Readonly<{
  active?: boolean;
  disabled?: boolean;
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
          className={cn(
            floatingSurfaceClassName,
            "max-h-[min(320px,var(--radix-dropdown-menu-content-available-height))] min-w-44 max-w-[calc(100vw-24px)] overflow-y-auto p-1.5"
          )}
          collisionPadding={12}
          sideOffset={8}
        >
          {items.map((item) => (
            <RadixDropdownMenu.Item
              className={cn(
                floatingItemClassName,
                item.active ? "font-semibold text-brand" : "text-foreground"
              )}
              key={item.key}
              {...(item.disabled === undefined ? {} : { disabled: item.disabled })}
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
