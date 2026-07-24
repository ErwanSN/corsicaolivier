import { type Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "../../../components/ds/Button";
import { BookingFlow } from "../../../features/booking/BookingFlow";
import {
  findTripRoute,
  parseTripDate,
  serializeTripDate
} from "../../../features/travel/trip-search";

export const metadata: Metadata = {
  description: "Réservez votre traversée Corsica Linea étape par étape.",
  title: "Réservation | Corsica Linea"
};
type SearchParams = Record<string, string | string[] | undefined>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ReservationPage({
  searchParams
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const params = await searchParams;
  const route = findTripRoute(first(params.route));
  const depart = parseTripDate(first(params.depart));
  const retour = parseTripDate(first(params.retour));
  if (!route || !depart || (retour && retour < depart)) return <InvalidSearch />;
  return (
    <div className="min-h-svh bg-[#f5f5f3]">
      {retour ? (
        <BookingFlow
          depart={serializeTripDate(depart)}
          retour={serializeTripDate(retour)}
          route={route}
        />
      ) : (
        <BookingFlow depart={serializeTripDate(depart)} route={route} />
      )}
    </div>
  );
}

function InvalidSearch() {
  return (
    <main className="mx-auto min-h-[60svh] w-full max-w-3xl px-4 py-20">
      <p className="text-xs font-bold uppercase tracking-widest text-brand">Réservation</p>
      <h1 className="mt-3 text-4xl font-bold">Commençons par votre traversée</h1>
      <p className="mt-4 max-w-xl leading-7 text-muted">
        Choisissez votre itinéraire et votre date de départ. Vous retrouverez ensuite un parcours
        guidé jusqu’au paiement.
      </p>
      <Link
        className={buttonVariants({ className: "mt-8", size: "lg", variant: "brand" })}
        href="/#reservation"
      >
        Rechercher une traversée
      </Link>
    </main>
  );
}
