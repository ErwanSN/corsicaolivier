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
  contentClassName?: string | undefined;
  contentSide?: "bottom" | "top" | undefined;
  disabled?: boolean | undefined;
  icon?: ReactNode | undefined;
  itemClassName?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  options: readonly SelectOption[];
  placeholder: string;
  value?: string | undefined;
  viewportClassName?: string | undefined;
}>;

export function Select({
  ariaLabel,
  className,
  contentClassName,
  contentSide,
  disabled,
  icon,
  itemClassName,
  onValueChange,
  options,
  placeholder,
  value,
  viewportClassName
}: SelectProps) {
  return (
    <RadixSelect.Root value={value ?? ""} {...(onValueChange ? { onValueChange } : {})}>
      <RadixSelect.Trigger
        aria-label={ariaLabel}
        className={cn(
          "focus-ring group inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium text-foreground transition hover:bg-foreground/5 data-[placeholder]:text-muted",
          className
        )}
        disabled={disabled}
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
          align="start"
          className={cn(
            floatingSurfaceClassName,
            "max-h-[min(240px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-24px)] p-1.5",
            contentClassName
          )}
          collisionPadding={12}
          position="popper"
          {...(contentSide ? { side: contentSide } : {})}
          sideOffset={6}
        >
          <RadixSelect.Viewport
            className={cn(
              "flex max-h-[min(228px,var(--radix-select-content-available-height))] flex-col gap-0.5 overflow-y-auto",
              viewportClassName
            )}
          >
            {options.map((option) => (
              <RadixSelect.Item
                className={cn(
                  floatingItemClassName,
                  "text-foreground data-[state=checked]:bg-brand/[0.08] data-[state=checked]:font-semibold data-[state=checked]:text-brand",
                  itemClassName
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
