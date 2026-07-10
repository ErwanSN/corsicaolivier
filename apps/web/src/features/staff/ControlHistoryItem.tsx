import { CircleCheck, CircleX } from "lucide-react";
import { type ControlRecord } from "@corsica/contracts";

import { cn } from "../../lib/cn";
import { formatControlTime } from "./control-history";

export function ControlHistoryItem({ control }: Readonly<{ control: ControlRecord }>) {
  const valid = control.status === "valide";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          valid ? "bg-emerald-50 text-emerald-600" : "bg-brand/10 text-brand"
        )}
      >
        {valid ? <CircleCheck className="size-5" /> : <CircleX className="size-5" />}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold text-foreground">
          {control.reference}
        </span>
        <span className="block truncate text-[12px] text-muted">
          {control.route} · {formatControlTime(control.controlledAt)}
        </span>
      </span>

      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          valid ? "bg-emerald-50 text-emerald-700" : "bg-brand/10 text-brand"
        )}
      >
        {valid ? "Validé" : "Refusé"}
      </span>
    </div>
  );
}
