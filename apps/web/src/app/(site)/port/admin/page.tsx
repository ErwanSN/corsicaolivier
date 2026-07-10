import { type Metadata } from "next";

import { PortAdminPage } from "../../../../features/port/PortAdminPage";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Administration du port | Corsica Linea"
};

export default function AdminPage() {
  return <PortAdminPage />;
}
