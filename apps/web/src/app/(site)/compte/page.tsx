import { type Metadata } from "next";

import { AccountScreen } from "../../../features/account/AccountScreen";

export const metadata: Metadata = {
  description: "Connexion et gestion sécurisée du compte Corsica Linea.",
  title: "Compte | Corsica Linea"
};

export default function ComptePage() {
  return <AccountScreen variant="client" />;
}
