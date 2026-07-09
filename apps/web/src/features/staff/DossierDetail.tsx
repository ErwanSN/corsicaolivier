"use client";

import { Car, Check, Clock, User, X } from "lucide-react";
import { useRouter } from "next/navigation";

import { cn } from "../../lib/cn";
import { type Dossier, type TravelerStatus } from "./dossiers";

function StatusCircle({ status }: Readonly<{ status: TravelerStatus }>) {
  const boarded = status === "embarque";
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full",
        boarded ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
      )}
    >
      {boarded ? <Check className="size-5" /> : <Clock className="size-5" />}
    </span>
  );
}

function SectionHeader({ count, label }: Readonly<{ count: number; label: string }>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] font-medium tracking-wide text-muted uppercase">{label}</span>
      <span className="text-[12px] text-muted">({count})</span>
    </div>
  );
}

export function DossierDetail({ dossier }: Readonly<{ dossier: Dossier }>) {
  const router = useRouter();

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="flex items-center gap-3 px-4 pt-6 pb-4">
        <button
          aria-label="Fermer"
          className="focus-ring grid size-10 shrink-0 place-items-center rounded-2xl bg-foreground/5 text-foreground transition hover:bg-foreground/10"
          onClick={() => {
            router.back();
          }}
          type="button"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold text-foreground">
            Dossier n° {dossier.reference}
          </h1>
          <p className="truncate text-[13px] text-muted">{dossier.routeLabel}</p>
        </div>
      </header>

      <div className="px-4">
        <div className="rounded-3xl bg-surface p-4 shadow-[0_8px_30px_rgba(0,0,0,0.06)]">
          <SectionHeader count={dossier.vehicles.length} label="Véhicule" />
          {dossier.vehicles.map((vehicle) => (
            <div className="flex items-center gap-3 py-2.5" key={vehicle.id}>
              <StatusCircle status="embarque" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Car className="size-4 shrink-0 text-foreground" />
                  <span className="truncate text-[15px] font-semibold text-foreground">
                    {vehicle.model}
                  </span>
                  {vehicle.paid ? (
                    <span className="grid size-4 shrink-0 place-items-center rounded-full bg-foreground text-[9px] font-bold text-background">
                      €
                    </span>
                  ) : null}
                </div>
                <span className="block truncate text-[12px] text-muted">
                  {vehicle.owner} · {vehicle.plate}
                </span>
              </div>
            </div>
          ))}

          <div className="my-2 border-t border-dashed border-border" />

          <SectionHeader count={dossier.travelers.length} label="Voyageurs" />
          {dossier.travelers.map((traveler) => (
            <div className="flex items-center gap-3 py-2.5" key={traveler.id}>
              <StatusCircle status={traveler.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <User className="size-4 shrink-0 text-foreground" />
                  <span className="truncate text-[15px] font-semibold text-foreground">
                    {traveler.name}
                  </span>
                </div>
                <span className="block truncate text-[12px] text-muted">{traveler.dateLabel}</span>
              </div>
            </div>
          ))}

          <div className="my-2 border-t border-dashed border-border" />

          <p className="py-1 text-center text-[14px] font-medium text-foreground">
            {dossier.currencyLabel}
          </p>
        </div>
      </div>

      <div className="mt-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          className="focus-ring w-full rounded-full bg-surface-inverse py-4 text-[15px] font-semibold text-background transition hover:opacity-90"
          type="button"
        >
          Valider et imprimer
        </button>
      </div>
    </div>
  );
}
