export type TravelerStatus = "attente" | "embarque";

export type Traveler = Readonly<{
  dateLabel: string;
  id: string;
  name: string;
  status: TravelerStatus;
}>;

export type Vehicle = Readonly<{
  id: string;
  model: string;
  owner: string;
  paid: boolean;
  plate: string;
}>;

export type Dossier = Readonly<{
  currencyLabel: string;
  id: string;
  phone: string;
  reference: string;
  routeLabel: string;
  travelers: readonly Traveler[];
  vehicles: readonly Vehicle[];
}>;

// Données de démonstration en attendant l'endpoint de dossiers.
export const dossiers: readonly Dossier[] = [
  {
    currencyLabel: "Réglé en EUR",
    id: "9362049",
    phone: "0675561134",
    reference: "9362049",
    routeLabel: "MURU : MRS - ILR - 18:45",
    travelers: [
      { dateLabel: "30/06/26 - 19:15", id: "t1", name: "Jeanne Delavoi", status: "embarque" },
      { dateLabel: "30/06/26 - 19:15", id: "t2", name: "Bertrand Delavoi", status: "attente" }
    ],
    vehicles: [
      { id: "v1", model: "PEUGEOT 207", owner: "Bertrand Delavoi", paid: true, plate: "EA 279 RZ" }
    ]
  },
  {
    currencyLabel: "Réglé en EUR",
    id: "9362050",
    phone: "0611223344",
    reference: "9362050",
    routeLabel: "PASCA : MRS - AJA - 20:30",
    travelers: [
      { dateLabel: "30/06/26 - 20:05", id: "t3", name: "Marie Santini", status: "embarque" },
      { dateLabel: "30/06/26 - 20:05", id: "t4", name: "Paul Santini", status: "embarque" }
    ],
    vehicles: [
      { id: "v2", model: "RENAULT CLIO", owner: "Marie Santini", paid: true, plate: "GF 118 AB" }
    ]
  },
  {
    currencyLabel: "Réglé en EUR",
    id: "9362051",
    phone: "0788990011",
    reference: "9362051",
    routeLabel: "MONT : MRS - BIA - 21:00",
    travelers: [
      { dateLabel: "30/06/26 - 20:40", id: "t5", name: "Antoine Rossi", status: "attente" }
    ],
    vehicles: []
  }
];

export function findDossier(id: string): Dossier | undefined {
  return dossiers.find((dossier) => dossier.id === id);
}

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, "");

export function searchDossiers(field: string, rawQuery: string): readonly Dossier[] {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  return dossiers.filter((dossier) => {
    switch (field) {
      case "dossier":
        return dossier.reference.toLowerCase().includes(query);
      case "nom":
        return dossier.travelers.some((traveler) => traveler.name.toLowerCase().includes(query));
      case "vehicule":
        return dossier.vehicles.some((vehicle) =>
          normalize(vehicle.plate).includes(normalize(query))
        );
      case "telephone":
        return normalize(dossier.phone).includes(normalize(query));
      default:
        return false;
    }
  });
}
