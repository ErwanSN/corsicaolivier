"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "../../lib/cn";

export function Counter({
  label,
  max = 9,
  min = 0,
  onChange,
  value
}: Readonly<{
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}>) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0">
      <span className="font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button
          aria-label={`Retirer ${label}`}
          className="focus-ring grid size-10 place-items-center rounded-full border border-border disabled:opacity-30"
          disabled={value <= min}
          onClick={() => {
            onChange(value - 1);
          }}
          type="button"
        >
          <Minus className="size-4" />
        </button>
        <output aria-live="polite" className="w-5 text-center font-bold">
          {value}
        </output>
        <button
          aria-label={`Ajouter ${label}`}
          className="focus-ring grid size-10 place-items-center rounded-full border border-border disabled:opacity-30"
          disabled={value >= max}
          onClick={() => {
            onChange(value + 1);
          }}
          type="button"
        >
          <Plus className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function ChoiceCard({
  checked,
  children,
  description,
  name,
  onChange,
  value
}: Readonly<{
  checked: boolean;
  children: string;
  description: string;
  name: string;
  onChange: () => void;
  value: string;
}>) {
  return (
    <label
      className={cn(
        "focus-within:ring-2 focus-within:ring-brand cursor-pointer rounded-2xl border p-4 transition",
        checked
          ? "border-brand bg-brand/[0.04]"
          : "border-border bg-surface hover:border-foreground/30"
      )}
    >
      <span className="flex items-start gap-3">
        <input
          aria-label={`${children} : ${description}`}
          checked={checked}
          className="mt-1 accent-[var(--color-brand)]"
          name={name}
          onChange={onChange}
          type="radio"
          value={value}
        />
        <span>
          <strong className="block">{children}</strong>
          <span className="mt-1 block text-sm leading-5 text-muted">{description}</span>
        </span>
      </span>
    </label>
  );
}

export const fieldClassName =
  "focus-ring h-12 w-full rounded-xl border border-border bg-surface px-4 text-sm placeholder:text-muted";
