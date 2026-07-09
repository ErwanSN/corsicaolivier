import { notFound } from "next/navigation";

import { DossierDetail } from "../../../../features/staff/DossierDetail";
import { findDossier } from "../../../../features/staff/dossiers";

export default async function DossierPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  const dossier = findDossier(id);

  if (!dossier) {
    notFound();
  }

  return <DossierDetail dossier={dossier} />;
}
