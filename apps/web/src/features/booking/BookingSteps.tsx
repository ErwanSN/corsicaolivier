"use client";

/* The booking screens stay together so their shared leg semantics remain visible. */
/* eslint-disable max-lines */

import { useEffect, useState } from "react";
import { Armchair, BedDouble, BedSingle, UsersRound } from "lucide-react";
import { Select } from "../../components/ds/Select";
import { ChoiceCard, Counter, fieldClassName } from "./BookingControls";
import {
  passengerCount,
  updateLeg,
  type BookingDraft,
  type Fare,
  type Insurance,
  type Leg,
  type VehicleType
} from "./booking-model";

type Change = (draft: BookingDraft) => void;
type StepProps = Readonly<{ draft: BookingDraft; hasReturn: boolean; onChange: Change }>;

export function PassengersStep({ draft, onChange }: StepProps) {
  return (
    <Step title="Qui voyage ?" description="Les catégories sont déterminées à la date du départ.">
      <div className="rounded-2xl border border-border bg-surface px-5">
        <Counter
          label="Adultes · 12 à 59 ans"
          min={1}
          onChange={(passengers) => {
            onChange({ ...draft, passengers });
          }}
          value={draft.passengers}
        />
        <Counter
          label="Enfants · 4 à 11 ans"
          onChange={(children) => {
            onChange({ ...draft, children });
          }}
          value={draft.children}
        />
        <Counter
          label="Bébés · 0 à 3 ans"
          onChange={(babies) => {
            onChange({ ...draft, babies });
          }}
          value={draft.babies}
        />
        <Counter
          label="Seniors · 60 ans et plus"
          onChange={(seniors) => {
            onChange({ ...draft, seniors });
          }}
          value={draft.seniors}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        Les dates de naissance et identités seront demandées avant le paiement.
      </p>
    </Step>
  );
}

const vehicleChoices: readonly Readonly<{
  label: string;
  value: VehicleType;
}>[] = [
  { label: "Sans véhicule", value: "none" },
  { label: "Voiture", value: "car" },
  { label: "Moto", value: "motorcycle" },
  { label: "Fourgon", value: "van" },
  { label: "Camping-car", value: "camper" }
];

const carMakes = [
  "Abarth",
  "Alfa Romeo",
  "Alpine",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "BYD",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Citroën",
  "Cupra",
  "Dacia",
  "Daewoo",
  "Daihatsu",
  "Dodge",
  "DS",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Isuzu",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Lancia",
  "Land Rover",
  "Lexus",
  "Lotus",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "MG",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Opel",
  "Peugeot",
  "Polestar",
  "Porsche",
  "Renault",
  "Rolls-Royce",
  "Saab",
  "Seat",
  "Škoda",
  "Smart",
  "SsangYong",
  "Subaru",
  "Suzuki",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo"
] as const;
const motorcycleMakes = [
  "Aprilia",
  "Benelli",
  "BMW",
  "Brixton",
  "Can-Am",
  "CFMoto",
  "Ducati",
  "GasGas",
  "Harley-Davidson",
  "Honda",
  "Husqvarna",
  "Indian",
  "Kawasaki",
  "Keeway",
  "KTM",
  "Kymco",
  "Mash",
  "Moto Guzzi",
  "MV Agusta",
  "Peugeot",
  "Piaggio",
  "Royal Enfield",
  "Sherco",
  "Suzuki",
  "Sym",
  "Triumph",
  "Vespa",
  "Yamaha",
  "Zero Motorcycles"
] as const;
const utilityMakes = [
  "Citroën",
  "Fiat",
  "Ford",
  "Iveco",
  "MAN",
  "Mercedes-Benz",
  "Nissan",
  "Opel",
  "Peugeot",
  "Renault",
  "Toyota",
  "Volkswagen"
] as const;
const camperMakes = [
  "Adria",
  "Autostar",
  "Bavaria",
  "Benimar",
  "Burstner",
  "Carado",
  "Challenger",
  "Chausson",
  "Dethleffs",
  "Etrusco",
  "Fleurette",
  "Font Vendôme",
  "Frankia",
  "Hymer",
  "Itineo",
  "Knaus",
  "Laika",
  "Le Voyageur",
  "McLouis",
  "Mobilvetta",
  "Notin",
  "Pilote",
  "Rapido",
  "Rimor",
  "Roller Team",
  "Sunlight",
  "Westfalia"
] as const;

const instantModels: Readonly<Record<string, readonly string[]>> = {
  Audi: ["A1", "A3", "A4", "A5", "A6", "Q2", "Q3", "Q4 e-tron", "Q5", "Q7"],
  BMW: ["Série 1", "Série 2", "Série 3", "Série 4", "Série 5", "X1", "X2", "X3", "X5"],
  Citroën: ["Ami", "C3", "C3 Aircross", "C4", "C4 X", "C5 Aircross", "Berlingo", "Jumpy"],
  Dacia: ["Duster", "Jogger", "Logan", "Sandero", "Spring"],
  Fiat: ["500", "500X", "600", "Doblo", "Ducato", "Panda", "Tipo"],
  Ford: ["Fiesta", "Focus", "Kuga", "Mustang", "Puma", "Ranger", "Tourneo", "Transit"],
  Honda: ["Civic", "CR-V", "e:Ny1", "HR-V", "Jazz", "ZR-V"],
  Hyundai: ["Bayon", "i10", "i20", "i30", "Ioniq 5", "Ioniq 6", "Kona", "Tucson"],
  Kia: ["Ceed", "EV3", "EV6", "Niro", "Picanto", "Rio", "Sportage", "Stonic"],
  "Mercedes-Benz": [
    "Classe A",
    "Classe B",
    "Classe C",
    "Classe E",
    "EQA",
    "EQB",
    "GLA",
    "GLC",
    "Vito"
  ],
  Nissan: ["Ariya", "Juke", "Leaf", "Micra", "Qashqai", "Townstar", "X-Trail"],
  Opel: ["Astra", "Combo", "Corsa", "Crossland", "Grandland", "Mokka", "Vivaro"],
  Peugeot: ["108", "208", "2008", "308", "3008", "408", "5008", "Rifter", "Traveller"],
  Renault: [
    "Arkana",
    "Austral",
    "Captur",
    "Clio",
    "Espace",
    "Kangoo",
    "Mégane",
    "Rafale",
    "Scénic",
    "Symbioz",
    "Trafic"
  ],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y"],
  Toyota: [
    "Aygo X",
    "C-HR",
    "Corolla",
    "Highlander",
    "Land Cruiser",
    "Prius",
    "RAV4",
    "Yaris",
    "Yaris Cross"
  ],
  Volkswagen: [
    "Caddy",
    "Golf",
    "ID.3",
    "ID.4",
    "ID.5",
    "Passat",
    "Polo",
    "T-Cross",
    "T-Roc",
    "Tiguan",
    "Touran"
  ],
  Volvo: ["C40", "EX30", "EX40", "EX90", "S60", "V60", "XC40", "XC60", "XC90"]
};

export function VehicleStep({ draft, onChange }: StepProps) {
  const { loadingModels, models } = useVehicleModels(draft.vehicle.make);
  const makes = getMakes(draft.vehicle.type);
  const updateVehicle = (patch: Partial<BookingDraft["vehicle"]>) => {
    onChange({ ...draft, vehicle: { ...draft.vehicle, ...patch } });
  };
  return (
    <Step title="Voyagez-vous avec un véhicule ?">
      <div className="flex flex-wrap gap-2">
        {vehicleChoices.map((choice) => (
          <label
            className={`cursor-pointer rounded-full border px-4 py-2 text-sm font-semibold ${
              draft.vehicle.type === choice.value
                ? "border-brand bg-brand text-white"
                : "border-border bg-surface"
            }`}
            key={choice.value}
          >
            <input
              checked={draft.vehicle.type === choice.value}
              className="sr-only"
              name="vehicle"
              onChange={() => {
                updateVehicle({
                  loadedHeight: false,
                  make: "",
                  model: "",
                  rearDepth: 0,
                  rearEquipment: "none",
                  trailer: false,
                  type: choice.value
                });
              }}
              type="radio"
              value={choice.value}
            />
            {choice.label}
          </label>
        ))}
      </div>
      {draft.vehicle.type !== "none" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2 text-sm font-semibold">
            <span>Marque</span>
            <Select
              ariaLabel="Marque du véhicule"
              className="w-full rounded-xl border border-border bg-surface"
              onValueChange={(make) => {
                updateVehicle({ make, model: "" });
              }}
              options={makes.map((make) => ({ label: make, value: make }))}
              placeholder="Choisir une marque"
              value={draft.vehicle.make}
            />
          </div>
          <div className="grid gap-2 text-sm font-semibold">
            <span>Modèle</span>
            <Select
              ariaLabel="Modèle du véhicule"
              className="w-full rounded-xl border border-border bg-surface"
              disabled={!draft.vehicle.make || loadingModels}
              onValueChange={(model) => {
                updateVehicle({ model });
              }}
              options={models.map((model) => ({ label: model, value: model }))}
              placeholder={loadingModels ? "Chargement…" : "Choisir un modèle"}
              value={draft.vehicle.model}
            />
          </div>
          {draft.vehicle.model ? <VehicleExtras draft={draft} onChange={updateVehicle} /> : null}
        </div>
      ) : null}
    </Step>
  );
}

function useVehicleModels(make: string) {
  const [modelResult, setModelResult] = useState<Readonly<{
    make: string;
    models: string[];
  }> | null>(null);
  useEffect(() => {
    if (!make) return;
    void fetch(`/api/vehicles/models?make=${encodeURIComponent(make)}`)
      .then(async (response) => (await response.json()) as Readonly<{ models: string[] }>)
      .then(({ models: availableModels }) => {
        setModelResult({ make, models: availableModels });
      });
  }, [make]);
  const immediate = instantModels[make] ?? [];
  const remote = modelResult?.make === make ? modelResult.models : [];
  const models = [...new Set([...immediate, ...remote])];
  return { loadingModels: Boolean(make) && models.length === 0, models };
}

function VehicleExtras({
  draft,
  onChange
}: Readonly<{
  draft: BookingDraft;
  onChange: (patch: Partial<BookingDraft["vehicle"]>) => void;
}>) {
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(
    draft.vehicle.rearEquipment !== "none" || draft.vehicle.loadedHeight
  );
  const equipment = [
    { description: "Aucun dépassement arrière", label: "Rien à l’arrière", value: "none" },
    { description: "Porte-vélos ou bagages", label: "Vélos", value: "bikeRack" },
    { description: "Remorque ou caravane", label: "Remorque", value: "trailer" }
  ] as const;
  const depths =
    draft.vehicle.rearEquipment === "bikeRack" ? [0.4, 0.6, 0.8, 1] : [2, 3, 4, 5, 6, 8];
  return (
    <div className="grid gap-4 sm:col-span-2">
      <div>
        <h3 className="text-sm font-semibold">Équipement à l’arrière</h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {equipment.map((option) => (
            <ChoiceCard
              checked={draft.vehicle.rearEquipment === option.value}
              description={option.description}
              key={option.value}
              name="rear-equipment"
              onChange={() => {
                setEquipmentConfirmed(true);
                onChange({
                  rearDepth: option.value === "none" ? 0 : option.value === "bikeRack" ? 0.6 : 3,
                  rearEquipment: option.value,
                  trailer: option.value === "trailer"
                });
              }}
              value={option.value}
            >
              {option.label}
            </ChoiceCard>
          ))}
        </div>
      </div>
      {draft.vehicle.rearEquipment !== "none" ? (
        <div className="grid gap-2 text-sm font-semibold sm:max-w-xs">
          <span>Profondeur supplémentaire</span>
          <Select
            ariaLabel="Profondeur supplémentaire"
            className="w-full rounded-xl border border-border bg-surface"
            onValueChange={(value) => {
              onChange({ rearDepth: Number(value) });
            }}
            options={depths.map((depth) => ({
              label: `+ ${String(depth).replace(".", ",")} m`,
              value: String(depth)
            }))}
            placeholder="Choisir la profondeur"
            value={String(draft.vehicle.rearDepth)}
          />
        </div>
      ) : null}
      {equipmentConfirmed ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4">
          <input
            aria-label="Chargement sur le toit dépassant 1,90 m"
            checked={draft.vehicle.loadedHeight}
            className="mt-0.5 size-5 accent-[var(--color-brand)]"
            onChange={(event) => {
              onChange({ loadedHeight: event.target.checked });
            }}
            type="checkbox"
          />
          <span className="text-sm">
            <strong className="block">Chargement sur le toit</strong>
            <span className="mt-1 block text-muted">
              À déclarer si la hauteur totale dépasse 1,90 m. Tarif calculé selon la traversée.
            </span>
          </span>
        </label>
      ) : null}
    </div>
  );
}

function getMakes(type: VehicleType): readonly string[] {
  if (type === "motorcycle") return motorcycleMakes;
  if (type === "van") return utilityMakes;
  if (type === "camper") return camperMakes;
  return carMakes;
}

export function ComfortStep({ draft, hasReturn, onChange }: StepProps) {
  const choices = [
    {
      description: "Accès aux espaces communs",
      icon: UsersRound,
      label: "Sans installation",
      value: "unassigned"
    },
    {
      description: "Fauteuil inclinable numéroté · +8 €",
      icon: Armchair,
      label: "Fauteuil",
      value: "seat"
    },
    {
      description: "2 lits et sanitaires privés · +37 €",
      icon: BedSingle,
      label: "Cabine 2 personnes",
      value: "cabin2"
    },
    {
      description: "4 lits et sanitaires privés · +54 €",
      icon: BedDouble,
      label: "Cabine 4 personnes",
      value: "cabin4"
    }
  ] as const;
  return (
    <Step title="Comment souhaitez-vous voyager ?">
      <LegPanels hasReturn={hasReturn}>
        {(leg) => (
          <div className="grid grid-cols-2 gap-3">
            {choices.map((choice) => (
              <ComfortChoice
                checked={draft.legs[leg].accommodation === choice.value}
                choice={choice}
                key={choice.value}
                name={`accommodation-${leg}`}
                onChange={() => {
                  onChange(updateLeg(draft, leg, { accommodation: choice.value }));
                }}
              />
            ))}
          </div>
        )}
      </LegPanels>
    </Step>
  );
}

function ComfortChoice({
  checked,
  choice,
  name,
  onChange
}: Readonly<{
  checked: boolean;
  choice: Readonly<{
    description: string;
    icon?: typeof Armchair;
    label: string;
    value: string;
  }>;
  name: string;
  onChange: () => void;
}>) {
  const Icon = choice.icon;
  return (
    <label
      className={`cursor-pointer overflow-hidden rounded-2xl border ${checked ? "border-brand" : "border-border"}`}
    >
      <input checked={checked} className="sr-only" name={name} onChange={onChange} type="radio" />
      <span className="grid h-24 place-items-center bg-foreground/[0.035] text-brand">
        {Icon ? <Icon className="size-8" /> : null}
      </span>
      <span className="block p-3">
        <strong className="block text-sm">{choice.label}</strong>
        <span className="mt-1 block text-xs leading-5 text-muted">{choice.description}</span>
      </span>
    </label>
  );
}

export function OnboardStep({ draft, hasReturn, onChange }: StepProps) {
  const max = passengerCount(draft);
  return (
    <Step
      title="À bord"
      description="Restauration et services sont facultatifs et choisis par trajet."
    >
      <LegPanels hasReturn={hasReturn}>
        {(leg) => (
          <div className="rounded-2xl border border-border px-5">
            <Counter
              label="Petit déjeuner · 8,70 €"
              max={max}
              onChange={(breakfast) => {
                onChange(updateLeg(draft, leg, { breakfast }));
              }}
              value={draft.legs[leg].breakfast}
            />
            <Counter
              label="Formule repas · 29,50 €"
              max={max}
              onChange={(meal) => {
                onChange(updateLeg(draft, leg, { meal }));
              }}
              value={draft.legs[leg].meal}
            />
            <Toggle
              checked={draft.legs[leg].kennel}
              label="Espace chenil · 17 €"
              onChange={(kennel) => {
                onChange(updateLeg(draft, leg, { kennel }));
              }}
            />
            <Toggle
              checked={draft.legs[leg].priorityDisembarkation}
              disabled={draft.vehicle.type === "none"}
              label="Débarquement prioritaire · 20 €"
              onChange={(priorityDisembarkation) => {
                onChange(updateLeg(draft, leg, { priorityDisembarkation }));
              }}
            />
          </div>
        )}
      </LegPanels>
    </Step>
  );
}

const fareCopy: Record<Fare, Readonly<{ description: string; label: string }>> = {
  standard: { description: "Modifiable avec frais, non remboursable", label: "Standard" },
  flex: { description: "Modifiable sans frais, remboursable sous conditions", label: "Flex" },
  superFlex: { description: "Flexibilité maximale avant le départ", label: "Super Flex" }
};

export function FlexibilityStep({ draft, hasReturn, onChange }: StepProps) {
  const insuranceOptions: readonly Readonly<{
    description: string;
    label: string;
    value: Insurance;
  }>[] = [
    { description: "Je poursuis sans assurance", label: "Sans assurance", value: "none" },
    { description: "Garanties essentielles · +8 €", label: "Multirisque", value: "multirisk" },
    { description: "Protection étendue · +12 €", label: "Sérénité", value: "serenity" }
  ];
  return (
    <Step
      title="Flexibilité et assurance"
      description="Comparez les conditions, pas seulement le prix."
    >
      <LegPanels hasReturn={hasReturn}>
        {(leg) => (
          <div className="grid gap-3">
            {(Object.keys(fareCopy) as Fare[]).map((fare) => (
              <ChoiceCard
                checked={draft.legs[leg].fare === fare}
                description={fareCopy[fare].description}
                key={fare}
                name={`fare-${leg}`}
                onChange={() => {
                  onChange(updateLeg(draft, leg, { fare }));
                }}
                value={fare}
              >
                {fareCopy[fare].label}
              </ChoiceCard>
            ))}
          </div>
        )}
      </LegPanels>
      <h3 className="mt-8 font-bold">Assurance du dossier</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {insuranceOptions.map((option) => (
          <ChoiceCard
            checked={draft.insurance === option.value}
            description={option.description}
            key={option.value}
            name="insurance"
            onChange={() => {
              onChange({ ...draft, insurance: option.value });
            }}
            value={option.value}
          >
            {option.label}
          </ChoiceCard>
        ))}
      </div>
    </Step>
  );
}

export function ContactStep({ draft, onChange }: StepProps) {
  const update = (key: keyof BookingDraft["contact"], value: string) => {
    onChange({ ...draft, contact: { ...draft.contact, [key]: value } });
  };
  return (
    <Step
      title="Vos coordonnées"
      description="Le billet et la confirmation seront envoyés à cette adresse."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          autoComplete="given-name"
          label="Prénom"
          onChange={(value) => {
            update("firstName", value);
          }}
          value={draft.contact.firstName}
        />
        <TextField
          autoComplete="family-name"
          label="Nom"
          onChange={(value) => {
            update("lastName", value);
          }}
          value={draft.contact.lastName}
        />
        <TextField
          autoComplete="email"
          label="Adresse email"
          onChange={(value) => {
            update("email", value);
          }}
          type="email"
          value={draft.contact.email}
        />
        <TextField
          autoComplete="tel"
          label="Téléphone (facultatif)"
          onChange={(value) => {
            update("phone", value);
          }}
          type="tel"
          value={draft.contact.phone}
        />
      </div>
    </Step>
  );
}

function Step({
  children,
  description,
  title
}: Readonly<{ children: React.ReactNode; description?: string; title: string }>) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      {description ? <p className="mt-2 text-sm text-muted">{description}</p> : null}
      <div className="mt-5">{children}</div>
    </div>
  );
}
function LegPanels({
  children,
  hasReturn
}: Readonly<{ children: (leg: Leg) => React.ReactNode; hasReturn: boolean }>) {
  const legs: Leg[] = hasReturn ? ["outbound", "return"] : ["outbound"];
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      {legs.map((leg) => (
        <section key={leg}>
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-brand">
            Trajet {leg === "outbound" ? "aller" : "retour"}
          </h3>
          {children(leg)}
        </section>
      ))}
    </div>
  );
}
function Toggle({
  checked,
  disabled,
  label,
  onChange
}: Readonly<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
}>) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-border py-4 last:border-0">
      <span className={disabled ? "text-muted" : "font-semibold"}>{label}</span>
      <input
        checked={checked}
        className="size-5 accent-[var(--color-brand)]"
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        type="checkbox"
      />
    </label>
  );
}
function TextField({
  autoComplete,
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: Readonly<{
  autoComplete: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}>) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <input
        autoComplete={autoComplete}
        className={fieldClassName}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        required
        placeholder={placeholder}
        type={type}
        value={value}
      />
    </label>
  );
}
