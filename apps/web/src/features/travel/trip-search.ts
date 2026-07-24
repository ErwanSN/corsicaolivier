import { format, isValid, parseISO, startOfDay } from "date-fns";

export type TripRoute = Readonly<{
  destination: string;
  label: string;
  origin: string;
  value: string;
}>;

export const tripRoutes: readonly TripRoute[] = [
  { destination: "Ajaccio", label: "Marseille → Ajaccio", origin: "Marseille", value: "mrs-aja" },
  { destination: "Bastia", label: "Marseille → Bastia", origin: "Marseille", value: "mrs-bia" },
  {
    destination: "L'Île-Rousse",
    label: "Marseille → L'Île-Rousse",
    origin: "Marseille",
    value: "mrs-ilr"
  },
  {
    destination: "Propriano",
    label: "Marseille → Propriano",
    origin: "Marseille",
    value: "mrs-pro"
  },
  { destination: "Alger", label: "Marseille → Alger", origin: "Marseille", value: "mrs-alg" },
  {
    destination: "Béjaïa",
    label: "Marseille → Béjaïa",
    origin: "Marseille",
    value: "mrs-bej"
  },
  { destination: "Skikda", label: "Marseille → Skikda", origin: "Marseille", value: "mrs-skd" },
  { destination: "Tunis", label: "Marseille → Tunis", origin: "Marseille", value: "mrs-tun" },
  { destination: "Béjaïa", label: "Sète → Béjaïa", origin: "Sète", value: "set-bej" },
  { destination: "Skikda", label: "Sète → Skikda", origin: "Sète", value: "set-skd" },
  { destination: "Marseille", label: "Ajaccio → Marseille", origin: "Ajaccio", value: "aja-mrs" },
  { destination: "Marseille", label: "Bastia → Marseille", origin: "Bastia", value: "bia-mrs" },
  {
    destination: "Marseille",
    label: "L'Île-Rousse → Marseille",
    origin: "L'Île-Rousse",
    value: "ilr-mrs"
  },
  {
    destination: "Marseille",
    label: "Propriano → Marseille",
    origin: "Propriano",
    value: "pro-mrs"
  },
  { destination: "Marseille", label: "Alger → Marseille", origin: "Alger", value: "alg-mrs" },
  { destination: "Marseille", label: "Béjaïa → Marseille", origin: "Béjaïa", value: "bej-mrs" },
  { destination: "Sète", label: "Béjaïa → Sète", origin: "Béjaïa", value: "bej-set" },
  { destination: "Marseille", label: "Skikda → Marseille", origin: "Skikda", value: "skd-mrs" },
  { destination: "Sète", label: "Skikda → Sète", origin: "Skikda", value: "skd-set" },
  { destination: "Marseille", label: "Tunis → Marseille", origin: "Tunis", value: "tun-mrs" }
];

export const tripRouteOptions = tripRoutes.map(({ label, value }) => ({ label, value }));

export function findTripRoute(value: string | undefined): TripRoute | undefined {
  return tripRoutes.find((route) => route.value === value);
}

export function serializeTripDate(date: Date | undefined): string {
  return date ? format(date, "yyyy-MM-dd") : "";
}

export function parseTripDate(value: string | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = parseISO(value);
  return isValid(date) && format(date, "yyyy-MM-dd") === value ? startOfDay(date) : undefined;
}
