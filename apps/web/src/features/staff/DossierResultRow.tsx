import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { type Dossier } from "./dossiers";

export function DossierResultRow({ dossier }: Readonly<{ dossier: Dossier }>) {
  return (
    <Link
      className="focus-ring flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-foreground/25"
      href={`/salarie/dossier/${dossier.id}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-foreground">
          Dossier n° {dossier.reference}
        </span>
        <span className="block truncate text-[12px] text-muted">{dossier.routeLabel}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted" />
    </Link>
  );
}
