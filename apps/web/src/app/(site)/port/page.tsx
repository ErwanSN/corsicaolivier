import { type Metadata } from "next";

import { PortGuide } from "../../../features/port/PortGuide";

export const metadata: Metadata = {
  description: "Carte interactive et parcours d'embarquement au port de Marseille.",
  title: "Se repérer au port | Corsica Linea"
};

export default function PortPage() {
  return <PortGuide />;
}
