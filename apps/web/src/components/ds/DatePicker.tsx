"use client";

import { format, startOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Popover } from "radix-ui";
import { type CSSProperties, type ReactNode, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "../../lib/cn";
import { floatingSurfaceClassName } from "./floating-surface";

const calendarStyle = {
  "--rdp-accent-background-color": "color-mix(in oklab, var(--color-brand) 12%, white)",
  "--rdp-accent-color": "var(--color-brand)",
  "--rdp-day-height": "40px",
  "--rdp-day-width": "40px",
  "--rdp-day_button-height": "38px",
  "--rdp-day_button-width": "38px"
} as CSSProperties;

export type DatePickerProps = Readonly<{
  className?: string;
  contentAlign?: "center" | "end" | "start";
  contentClassName?: string;
  contentSide?: "bottom" | "top";
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  minimumDate?: Date;
  onChange: (date: Date | undefined) => void;
  value: Date | undefined;
}>;

export function DatePicker({
  className,
  contentAlign = "start",
  contentClassName,
  contentSide,
  disabled = false,
  icon,
  label,
  minimumDate,
  onChange,
  value
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root onOpenChange={setOpen} open={open}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "focus-ring inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2.5 text-[14px] font-medium transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-45",
            className
          )}
          disabled={disabled}
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
          align={contentAlign}
          className={cn(
            floatingSurfaceClassName,
            "max-h-[calc(100svh-24px)] w-[min(344px,calc(100vw-24px))] overflow-y-auto p-3",
            contentClassName
          )}
          collisionPadding={12}
          {...(contentSide ? { side: contentSide } : {})}
          sideOffset={6}
        >
          <DayPicker
            disabled={minimumDate ? { before: startOfDay(minimumDate) } : undefined}
            locale={fr}
            mode="single"
            onSelect={(date) => {
              onChange(date);
              if (date) setOpen(false);
            }}
            selected={value}
            style={calendarStyle}
            weekStartsOn={1}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
