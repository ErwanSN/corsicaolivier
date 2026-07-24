import { type Metadata } from "next";
import { StaffLogin } from "../../../features/staff/StaffLogin";
export const metadata: Metadata = {
  description: "Connexion à l'espace interne Corsica Linea.",
  title: "Connexion salarié | Corsica Linea"
};
export default function StaffLoginPage() {
  return <StaffLogin />;
}
