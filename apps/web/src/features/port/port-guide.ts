export type Coordinates = [latitude: number, longitude: number];

export type BoardingMode = "foot" | "vehicle";

export type BoardingStep = Readonly<{
  coordinates: Coordinates;
  description: string;
  id: string;
  label: string;
}>;

export type BoardingRoute = Readonly<{
  arrivalAdvice: string;
  description: string;
  id: BoardingMode;
  label: string;
  steps: readonly BoardingStep[];
}>;

export const marseillePortCenter: Coordinates = [43.317, 5.361];

export const boardingRoutes: Record<BoardingMode, BoardingRoute> = {
  foot: {
    arrivalAdvice: "Présentez-vous à la Gare Maritime de la Joliette avec votre billet.",
    description: "Depuis la place de la Joliette jusqu'au contrôle piéton.",
    id: "foot",
    label: "Je voyage à pied",
    steps: [
      {
        coordinates: [43.30472, 5.36623],
        description: "Métro M2, tram T2/T3 et bus à proximité.",
        id: "joliette",
        label: "Place de la Joliette"
      },
      {
        coordinates: [43.30544, 5.36516],
        description: "23 place de la Joliette, Terminal 1.",
        id: "terminal",
        label: "Gare maritime"
      },
      {
        coordinates: [43.30618, 5.36392],
        description: "Préparez votre pièce d'identité et votre carte d'embarquement.",
        id: "control",
        label: "Contrôle passagers"
      }
    ]
  },
  vehicle: {
    arrivalAdvice: "Votre billet précise Porte 1 ou Porte 3A. Suivez toujours l'affichage local.",
    description: "Accès sud par Chanterac pour les départs vers la Corse.",
    id: "vehicle",
    label: "Je voyage en véhicule",
    steps: [
      {
        coordinates: [43.31167, 5.36667],
        description: "Rond-point de Chanterac, accès depuis l'A55 sortie 4.",
        id: "gate",
        label: "Entrée sud du port"
      },
      {
        coordinates: [43.31322, 5.36384],
        description: "Gardez billets et pièces d'identité à portée de main.",
        id: "vehicle-control",
        label: "Zone de contrôle"
      },
      {
        coordinates: [43.31525, 5.36082],
        description: "Le quai exact est confirmé par les panneaux et les agents.",
        id: "waiting-zone",
        label: "Zone d'orientation"
      }
    ]
  }
};

export function getBoardingRoute(mode: BoardingMode): BoardingRoute {
  return boardingRoutes[mode];
}
