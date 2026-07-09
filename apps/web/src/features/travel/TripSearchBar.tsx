"use client";

import { CalendarDays, MapPin, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ds/Button";
import { DatePicker } from "../../components/ds/DatePicker";
import { Select, type SelectOption } from "../../components/ds/Select";

const routes: readonly SelectOption[] = [
  { label: "Marseille → Ajaccio", value: "mrs-aja" },
  { label: "Marseille → Bastia", value: "mrs-bia" },
  { label: "Marseille → L'Île-Rousse", value: "mrs-ilr" },
  { label: "Marseille → Porto-Vecchio", value: "mrs-pvo" },
  { label: "Marseille → Propriano", value: "mrs-pro" },
  { label: "Marseille → Alger", value: "mrs-alg" },
  { label: "Marseille → Béjaïa", value: "mrs-bej" }
];

export function TripSearchBar() {
  const [route, setRoute] = useState<string>();
  const [depart, setDepart] = useState<Date | undefined>(undefined);
  const [retour, setRetour] = useState<Date | undefined>(undefined);

  return (
    <div className="flex w-fit max-w-full flex-wrap items-center gap-1 rounded-[28px] bg-surface p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:flex-nowrap md:rounded-full">
      <Select
        ariaLabel="Traversée"
        icon={<MapPin className="size-4.5" />}
        onValueChange={setRoute}
        options={routes}
        placeholder="Traversée"
        value={route}
      />
      <span className="hidden h-6 w-px bg-border md:block" />
      <DatePicker
        icon={<CalendarDays className="size-4.5" />}
        label="Date Aller"
        onChange={setDepart}
        value={depart}
      />
      <span className="hidden h-6 w-px bg-border md:block" />
      <DatePicker
        icon={<CalendarDays className="size-4.5" />}
        label="Date Retour"
        onChange={setRetour}
        value={retour}
      />
      <Button aria-label="Rechercher" className="ml-1" size="iconLg" variant="brand">
        <Search className="size-5" />
      </Button>
    </div>
  );
}
