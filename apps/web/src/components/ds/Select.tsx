"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";
import { floatingItemClassName, floatingSurfaceClassName } from "./floating-surface";

export type SelectOption = Readonly<{ label: string; value: string }>;

export type SelectProps = Readonly<{
  ariaLabel: string;
  className?: string | undefined;
  icon?: ReactNode | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  options: readonly SelectOption[];
  placeholder: string;
  value?: string | undefined;
}>;

export function Select({
  ariaLabel,
  className,
  icon,
  onValueChange,
  options,
  placeholder,
  value
}: SelectProps) {
  return (
    <RadixSelect.Root
      {...(value === undefined ? {} : { value })}
      {...(onValueChange ? { onValueChange } : {})}
    >
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "focus-ring group inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-foreground transition hover:bg-foreground/5 data-[placeholder]:text-muted",
          className
        )}
      >
        {icon ? <span className="text-brand">{icon}</span> : null}
        <span className="min-w-0 flex-1 truncate">
          <RadixSelect.Value placeholder={placeholder} />
        </span>
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted transition group-data-[state=open]:rotate-180" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className={cn(
            floatingSurfaceClassName,
            "max-h-[min(320px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] p-1.5"
          )}
          collisionPadding={12}
          position="popper"
          sideOffset={8}
        >
          <RadixSelect.Viewport className="flex max-h-[min(308px,var(--radix-select-content-available-height))] flex-col gap-0.5">
            {options.map((option) => (
              <RadixSelect.Item
                className={cn(
                  floatingItemClassName,
                  "text-foreground data-[state=checked]:font-semibold"
                )}
                key={option.value}
                value={option.value}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                <RadixSelect.ItemIndicator className="ml-auto">
                  <Check className="size-4 text-brand" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
