"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover } from "radix-ui";
import { type ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "../../lib/cn";
import { floatingSurfaceClassName } from "./floating-surface";

export type DatePickerProps = Readonly<{
  className?: string;
  icon?: ReactNode;
  label: string;
  onChange: (date: Date | undefined) => void;
  value: Date | undefined;
}>;

export function DatePicker({ className, icon, label, onChange, value }: DatePickerProps) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium transition hover:bg-foreground/5",
            className
          )}
          type="button"
        >
          {icon ? <span className="text-brand">{icon}</span> : null}
          <span className={cn("truncate", value ? "text-foreground" : "text-muted")}>
            {value ? format(value, "d MMM yyyy", { locale: fr }) : label}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          className={cn(
            floatingSurfaceClassName,
            "max-h-[calc(100svh-24px)] w-[min(344px,calc(100vw-24px))] overflow-y-auto p-3 [--rdp-accent-color:var(--color-brand)] [--rdp-accent-background-color:color-mix(in_oklab,var(--color-brand)_12%,white)]"
          )}
          collisionPadding={12}
          sideOffset={8}
        >
          <DayPicker
            locale={fr}
            mode="single"
            onSelect={onChange}
            selected={value}
            weekStartsOn={1}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
