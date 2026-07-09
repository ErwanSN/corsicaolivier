"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover } from "radix-ui";
import { type ReactNode } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "../../lib/cn";

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
            "focus-ring inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium transition hover:bg-foreground/5",
            className
          )}
          type="button"
        >
          {icon ? <span className="text-brand">{icon}</span> : null}
          <span className={value ? "text-foreground" : "text-muted"}>
            {value ? format(value, "d MMM yyyy", { locale: fr }) : label}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-50 rounded-2xl border border-border bg-surface p-3 shadow-[0_18px_52px_rgba(0,0,0,0.18)] [--rdp-accent-color:var(--color-brand)] [--rdp-accent-background-color:color-mix(in_oklab,var(--color-brand)_12%,white)]"
          sideOffset={10}
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
