import { DossierLoader } from "../../../../features/staff/DossierLoader";

export default async function DossierPage({
  params
}: Readonly<{ params: Promise<{ id: string }> }>) {
  const { id } = await params;
  return <DossierLoader id={id} />;
}
