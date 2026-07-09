"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as RadixSelect } from "radix-ui";
import { type ReactNode } from "react";

import { cn } from "../../lib/cn";

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
          "focus-ring group inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-foreground transition hover:bg-foreground/5 data-[placeholder]:text-muted",
          className
        )}
      >
        {icon ? <span className="text-brand">{icon}</span> : null}
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="size-4 text-muted transition group-data-[state=open]:rotate-180" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          className="z-50 overflow-hidden rounded-2xl border border-border bg-surface p-1.5 shadow-[0_18px_52px_rgba(0,0,0,0.18)]"
          position="popper"
          sideOffset={8}
        >
          <RadixSelect.Viewport className="flex flex-col gap-0.5">
            {options.map((option) => (
              <RadixSelect.Item
                className="flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2 text-[14px] text-foreground outline-none select-none data-[highlighted]:bg-foreground/5 data-[state=checked]:font-semibold"
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
