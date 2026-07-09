"use client";

import { Car, FileText, Phone, User, type LucideIcon } from "lucide-react";
import { Tabs } from "radix-ui";
import { useState } from "react";

import { SearchField } from "../../components/ds/SearchField";
import { searchDossiers } from "./dossiers";
import { DossierResultRow } from "./DossierResultRow";

function SearchResults({ field, query }: Readonly<{ field: string; query: string }>) {
  if (!query.trim()) {
    return null;
  }

  const results = searchDossiers(field, query);

  if (results.length === 0) {
    return <p className="mt-5 text-center text-[13px] text-muted">Aucun dossier trouvé.</p>;
  }

  return (
    <div className="mt-5 flex flex-col gap-2.5">
      {results.map((dossier) => (
        <DossierResultRow dossier={dossier} key={dossier.id} />
      ))}
    </div>
  );
}

type SearchTab = Readonly<{
  helper: string;
  icon: LucideIcon;
  inputMode: "tel" | "text";
  key: string;
  label: string;
  placeholder: string;
  title: string;
}>;

const searchTabs: readonly SearchTab[] = [
  {
    helper: "Référence à 12 caractères",
    icon: FileText,
    inputMode: "text",
    key: "dossier",
    label: "Saisissez la référence du dossier",
    placeholder: "ex: CL-2026-000123",
    title: "Dossier"
  },
  {
    helper: "Nom de famille du passager",
    icon: User,
    inputMode: "text",
    key: "nom",
    label: "Saisissez le nom du passager",
    placeholder: "ex: Dupont",
    title: "Passager"
  },
  {
    helper: "Plaque d'immatriculation",
    icon: Car,
    inputMode: "text",
    key: "vehicule",
    label: "Saisissez la plaque du véhicule",
    placeholder: "ex: AB-123-CD",
    title: "Véhicule"
  },
  {
    helper: "Numéro à 10 chiffres",
    icon: Phone,
    inputMode: "tel",
    key: "telephone",
    label: "Saisissez le n° de téléphone",
    placeholder: "ex: 0675561134",
    title: "Téléphone"
  }
];

export function StaffSearch() {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <div className="mx-auto w-full max-w-md px-4 py-6">
      <h1 className="text-[22px] font-bold text-foreground">Rechercher un dossier</h1>

      <Tabs.Root className="mt-5" defaultValue="telephone">
        <Tabs.List aria-label="Critère de recherche" className="flex border-b border-border">
          {searchTabs.map((tab) => (
            <Tabs.Trigger
              aria-label={tab.title}
              className="focus-ring -mb-px flex flex-1 items-center justify-center border-b-2 border-transparent py-3 text-muted transition data-[state=active]:border-brand data-[state=active]:text-brand"
              key={tab.key}
              value={tab.key}
            >
              <tab.icon className="size-5" />
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {searchTabs.map((tab) => (
          <Tabs.Content className="pt-6 focus:outline-none" key={tab.key} value={tab.key}>
            <SearchField
              helper={tab.helper}
              inputMode={tab.inputMode}
              label={tab.label}
              onChange={(value) => {
                setValues((previous) => ({ ...previous, [tab.key]: value }));
              }}
              placeholder={tab.placeholder}
              value={values[tab.key] ?? ""}
            />
            <SearchResults field={tab.key} query={values[tab.key] ?? ""} />
          </Tabs.Content>
        ))}
      </Tabs.Root>
    </div>
  );
}
