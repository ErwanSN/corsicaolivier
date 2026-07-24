"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import { type SyntheticEvent, useState } from "react";

import { Button } from "../../components/ds/Button";
import { DatePicker } from "../../components/ds/DatePicker";
import { Select } from "../../components/ds/Select";
import { serializeTripDate, tripRouteOptions } from "./trip-search";

export function TripSearchBar() {
  const [route, setRoute] = useState<string>();
  const [depart, setDepart] = useState<Date>();
  const [retour, setRetour] = useState<Date>();
  const [error, setError] = useState<string>();
  const today = new Date();

  function handleDepartureChange(date: Date | undefined): void {
    setDepart(date);
    if (date && retour && retour < date) setRetour(undefined);
    setError(undefined);
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>): void {
    const validationError = getSearchError(route, depart, retour);
    if (validationError) {
      event.preventDefault();
      setError(validationError);
    }
  }

  return (
    <form
      action="/reservation"
      aria-label="Rechercher une traversée"
      className="w-full max-w-md md:max-w-full"
      id="reservation"
      method="get"
      noValidate
      onSubmit={handleSubmit}
      role="search"
    >
      <input name="route" type="hidden" value={route ?? ""} />
      <input name="depart" type="hidden" value={serializeTripDate(depart)} />
      <input name="retour" type="hidden" value={serializeTripDate(retour)} />

      <div className="grid grid-cols-1 gap-1 rounded-2xl border border-white/60 bg-white/95 p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.24)] backdrop-blur-md sm:grid-cols-2 md:flex md:w-fit md:max-w-full md:flex-nowrap md:items-center md:rounded-full">
        <Select
          ariaLabel="Traversée"
          className="w-full min-w-0 justify-between bg-foreground/[0.035] sm:col-span-2 md:w-auto md:max-w-64 md:justify-start md:bg-transparent"
          contentClassName="w-[min(320px,calc(100vw-32px))] max-h-[min(320px,var(--radix-select-content-available-height))] rounded-sm border-border p-1 shadow-[0_8px_24px_rgba(0,0,0,0.16)] md:w-80"
          contentSide="bottom"
          icon={<MapPin className="size-4.5" />}
          itemClassName="min-h-9 rounded-sm px-2.5 py-1.5 text-[13px] data-[highlighted]:bg-neutral-100"
          onValueChange={(value) => {
            setRoute(value);
            setError(undefined);
          }}
          options={tripRouteOptions}
          placeholder="Traversée"
          value={route}
          viewportClassName="max-h-[min(308px,var(--radix-select-content-available-height))] gap-0"
        />
        <span className="hidden h-6 w-px bg-border md:block" />
        <DatePicker
          className="w-full min-w-0 justify-start px-3 md:w-auto md:px-4"
          contentClassName="w-[min(288px,calc(100vw-32px))] rounded-sm border-border p-2 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
          contentSide="bottom"
          icon={<CalendarDays className="size-4.5" />}
          label="Date aller"
          minimumDate={today}
          onChange={handleDepartureChange}
          value={depart}
        />
        <span className="hidden h-6 w-px bg-border md:block" />
        <DatePicker
          className="w-full min-w-0 justify-start px-3 md:w-auto md:px-4"
          contentAlign="end"
          contentClassName="w-[min(288px,calc(100vw-32px))] rounded-sm border-border p-2 shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
          contentSide="bottom"
          disabled={!depart}
          icon={<CalendarDays className="size-4.5" />}
          label="Retour (facultatif)"
          minimumDate={depart ?? today}
          onChange={(date) => {
            setRetour(date);
            setError(undefined);
          }}
          value={retour}
        />
        <Button
          aria-label="Rechercher"
          className="w-full sm:col-span-2 md:ml-1 md:size-12 md:w-12 md:px-0"
          size="lg"
          type="submit"
          variant="brand"
        >
          <Search className="size-5" />
          <span className="md:sr-only">Rechercher</span>
        </Button>
      </div>

      <p
        aria-live="polite"
        className="mt-2 min-h-5 text-[13px] font-medium text-white"
        role={error ? "alert" : undefined}
      >
        {error}
      </p>
    </form>
  );
}

function getSearchError(
  route: string | undefined,
  depart: Date | undefined,
  retour: Date | undefined
): string | undefined {
  if (!route || !depart) return "Choisissez une traversée et une date aller.";
  return retour && retour < depart
    ? "La date retour doit être postérieure à la date aller."
    : undefined;
}
