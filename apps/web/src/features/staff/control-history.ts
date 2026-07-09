export type ControlStatus = "refuse" | "valide";

export type ControlRecord = Readonly<{
  id: string;
  reference: string;
  route: string;
  status: ControlStatus;
  timeLabel: string;
}>;

// Données de démonstration en attendant l'endpoint d'historique des contrôles.
export const recentControls: readonly ControlRecord[] = [
  {
    id: "1",
    reference: "CL-2026-000481",
    route: "Marseille → Ajaccio",
    status: "valide",
    timeLabel: "il y a 2 min"
  },
  {
    id: "2",
    reference: "CL-2026-000478",
    route: "Marseille → Ajaccio",
    status: "valide",
    timeLabel: "il y a 6 min"
  },
  {
    id: "3",
    reference: "CL-2026-000475",
    route: "Marseille → Bastia",
    status: "refuse",
    timeLabel: "il y a 11 min"
  },
  {
    id: "4",
    reference: "CL-2026-000470",
    route: "Marseille → Ajaccio",
    status: "valide",
    timeLabel: "il y a 18 min"
  },
  {
    id: "5",
    reference: "CL-2026-000463",
    route: "Marseille → Propriano",
    status: "valide",
    timeLabel: "il y a 25 min"
  },
  {
    id: "6",
    reference: "CL-2026-000459",
    route: "Marseille → Bastia",
    status: "refuse",
    timeLabel: "il y a 32 min"
  },
  {
    id: "7",
    reference: "CL-2026-000451",
    route: "Marseille → Ajaccio",
    status: "valide",
    timeLabel: "il y a 40 min"
  }
];
