"use client";

import { ChevronLeft, ChevronRight, LockKeyhole, Ship } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "../../components/ds/Button";
import { type TripRoute } from "../travel/trip-search";
import {
  ComfortStep,
  ContactStep,
  FlexibilityStep,
  OnboardStep,
  PassengersStep,
  VehicleStep
} from "./BookingSteps";
import {
  calculatePrice,
  initialBookingDraft,
  isContactValid,
  passengerCount,
  type BookingDraft,
  type PriceBreakdown
} from "./booking-model";
import { useServerBooking } from "./use-server-booking";

const steps = [
  "Voyageurs",
  "Véhicule",
  "Confort",
  "À bord",
  "Flexibilité",
  "Coordonnées",
  "Récapitulatif",
  "Paiement"
] as const;

type Props = Readonly<{ depart: string; retour?: string | undefined; route: TripRoute }>;

export function BookingFlow({ depart, retour, route }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [draft, setDraft] = useState<BookingDraft>(initialBookingDraft);
  const step = parseStep(searchParams.get("step"));
  const goToStep = (nextStep: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", String(nextStep + 1));
    router.push(`?${params.toString()}`, { scroll: false });
  };
  const { quote } = useServerBooking({
    depart,
    draft,
    onHydrate: setDraft,
    retour,
    route: route.value
  });
  const price = quote ?? calculatePrice(draft, Boolean(retour));
  const vehicleIsComplete =
    draft.vehicle.type === "none" || Boolean(draft.vehicle.make && draft.vehicle.model);
  const canContinue =
    (step !== 1 || vehicleIsComplete) && (step !== 5 || isContactValid(draft.contact));

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-12">
      <div className="min-w-0">
        <BookingHeader current={step} />
        <section
          className="mt-6 rounded-3xl bg-surface p-5 shadow-[0_12px_40px_rgb(0_0_0/0.07)] sm:p-8"
          id="booking-step"
        >
          <StepContent
            draft={draft}
            hasReturn={Boolean(retour)}
            onChange={setDraft}
            price={price}
            step={step}
          />
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button
              disabled={step === 0}
              onClick={() => {
                goToStep(step - 1);
              }}
              variant="ghost"
            >
              <ChevronLeft className="size-4" />
              Retour
            </Button>
            {step < steps.length - 1 ? (
              <Button
                disabled={!canContinue}
                onClick={() => {
                  goToStep(step + 1);
                }}
                variant="brand"
              >
                Continuer
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button disabled variant="brand">
                <LockKeyhole className="size-4" />
                Paiement bientôt disponible
              </Button>
            )}
          </div>
          {!canContinue ? (
            <p className="mt-3 text-right text-xs text-brand" role="alert">
              {step === 1
                ? "Choisissez la marque et le modèle du véhicule."
                : "Renseignez votre prénom, votre nom et un email valide."}
            </p>
          ) : null}
        </section>
      </div>
      <BookingSummary depart={depart} draft={draft} price={price} retour={retour} route={route} />
    </div>
  );
}

function parseStep(value: string | null): number {
  const requested = Number(value ?? "1");
  if (!Number.isInteger(requested)) return 0;
  return Math.min(Math.max(requested, 1), steps.length) - 1;
}

function BookingHeader({ current }: Readonly<{ current: number }>) {
  return (
    <header>
      <h1 className="text-3xl font-bold sm:text-4xl">Réservez votre traversée</h1>
      <div aria-label={`Étape ${String(current + 1)} sur ${String(steps.length)}`} className="mt-5">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold">{steps[current]}</span>
          <span className="text-muted">
            {current + 1} / {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full rounded-full bg-brand transition-[width]"
            style={{ width: `${String(((current + 1) / steps.length) * 100)}%` }}
          />
        </div>
      </div>
    </header>
  );
}

function StepContent({
  draft,
  hasReturn,
  onChange,
  price,
  step
}: Readonly<{
  draft: BookingDraft;
  hasReturn: boolean;
  onChange: (draft: BookingDraft) => void;
  price: PriceBreakdown;
  step: number;
}>) {
  const props = { draft, hasReturn, onChange };
  if (step === 0) return <PassengersStep {...props} />;
  if (step === 1) return <VehicleStep {...props} />;
  if (step === 2) return <ComfortStep {...props} />;
  if (step === 3) return <OnboardStep {...props} />;
  if (step === 4) return <FlexibilityStep {...props} />;
  if (step === 5) return <ContactStep {...props} />;
  if (step === 6) return <Review draft={draft} price={price} />;
  return <PaymentPlaceholder />;
}

function Review({ draft, price }: Readonly<{ draft: BookingDraft; price: PriceBreakdown }>) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Vérifiez votre réservation</h2>
      <p className="mt-2 text-sm text-muted">Aucun paiement ne sera demandé à cette étape.</p>
      <dl className="mt-6 grid gap-4 rounded-2xl bg-foreground/[0.035] p-5 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase text-muted">Voyageurs</dt>
          <dd className="mt-1 font-semibold">{passengerCount(draft)} personne(s)</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Installation</dt>
          <dd className="mt-1 font-semibold">
            {
              {
                cabin2: "Cabine 2 personnes",
                cabin4: "Cabine 4 personnes",
                seat: "Fauteuil",
                unassigned: "Sans installation"
              }[draft.legs.outbound.accommodation]
            }
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Contact</dt>
          <dd className="mt-1 font-semibold">
            {draft.contact.firstName} {draft.contact.lastName}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-muted">Total estimé</dt>
          <dd className="mt-1 text-xl font-bold text-brand">{formatPrice(price.total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function PaymentPlaceholder() {
  return (
    <div className="text-center">
      <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand/10 text-brand">
        <LockKeyhole className="size-6" />
      </div>
      <h2 className="mt-5 text-2xl font-bold">Paiement sécurisé</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted">
        Le parcours est prêt à recevoir un prestataire de paiement tokenisé. Cette démonstration ne
        collecte volontairement aucune donnée bancaire.
      </p>
      <div className="mx-auto mt-6 max-w-md rounded-2xl border border-dashed border-border p-5 text-sm font-semibold">
        Connexion au prestataire de paiement requise
      </div>
    </div>
  );
}

function BookingSummary({
  depart,
  draft,
  price,
  retour,
  route
}: Props & Readonly<{ draft: BookingDraft; price: PriceBreakdown }>) {
  return (
    <aside className="h-fit rounded-3xl bg-[#171717] p-6 text-white lg:sticky lg:top-32">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-brand">
          <Ship className="size-5" />
        </span>
        <div>
          <p className="text-xs text-white/60">Votre traversée</p>
          <h2 className="font-bold">{route.label}</h2>
        </div>
      </div>
      <dl className="mt-6 grid gap-3 border-y border-white/15 py-5 text-sm">
        <SummaryRow label="Aller" value={formatDate(depart)} />
        {retour ? <SummaryRow label="Retour" value={formatDate(retour)} /> : null}
        <SummaryRow label="Voyageurs" value={`${String(passengerCount(draft))} personne(s)`} />
      </dl>
      <div className="mt-5 flex items-end justify-between">
        <span className="text-sm text-white/70">Total provisoire</span>
        <strong className="text-3xl">{formatPrice(price.total)}</strong>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-white/60">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
function formatPrice(value: number): string {
  return new Intl.NumberFormat("fr-FR", { currency: "EUR", style: "currency" }).format(value);
}
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}
