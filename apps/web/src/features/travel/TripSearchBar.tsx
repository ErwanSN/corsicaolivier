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
    <div className="grid w-full max-w-md grid-cols-2 gap-1 rounded-3xl bg-surface p-1.5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] md:flex md:w-fit md:max-w-full md:flex-nowrap md:items-center md:rounded-full">
      <Select
        ariaLabel="Traversée"
        className="col-span-2 w-full min-w-0 justify-between bg-foreground/[0.035] md:w-auto md:justify-start md:bg-transparent"
        icon={<MapPin className="size-4.5" />}
        onValueChange={setRoute}
        options={routes}
        placeholder="Traversée"
        value={route}
      />
      <span className="hidden h-6 w-px bg-border md:block" />
      <DatePicker
        className="w-full min-w-0 justify-start px-3.5 md:w-auto md:px-4"
        icon={<CalendarDays className="size-4.5" />}
        label="Date Aller"
        onChange={setDepart}
        value={depart}
      />
      <span className="hidden h-6 w-px bg-border md:block" />
      <DatePicker
        className="w-full min-w-0 justify-start px-3.5 md:w-auto md:px-4"
        icon={<CalendarDays className="size-4.5" />}
        label="Date Retour"
        onChange={setRetour}
        value={retour}
      />
      <Button
        aria-label="Rechercher"
        className="col-span-2 w-full md:ml-1 md:size-12 md:w-12 md:px-0"
        size="lg"
        variant="brand"
      >
        <Search className="size-5" />
        <span className="md:sr-only">Rechercher</span>
      </Button>
    </div>
  );
}
