export type Accommodation = "cabin2" | "cabin4" | "seat" | "unassigned";
export type Fare = "flex" | "standard" | "superFlex";
export type Insurance = "multirisk" | "none" | "serenity";
export type Leg = "outbound" | "return";
export type VehicleType = "car" | "camper" | "motorcycle" | "none" | "van";
export type RearEquipment = "bikeRack" | "none" | "trailer";

export type LegSelection = Readonly<{
  accommodation: Accommodation;
  breakfast: number;
  fare: Fare;
  kennel: boolean;
  meal: number;
  priorityDisembarkation: boolean;
}>;

export type BookingDraft = Readonly<{
  babies: number;
  children: number;
  contact: Readonly<{ email: string; firstName: string; lastName: string; phone: string }>;
  insurance: Insurance;
  legs: Readonly<Record<Leg, LegSelection>>;
  passengers: number;
  seniors: number;
  vehicle: Readonly<{
    height: number;
    length: number;
    make: string;
    model: string;
    loadedHeight: boolean;
    rearDepth: number;
    rearEquipment: RearEquipment;
    sameForReturn: boolean;
    trailer: boolean;
    type: VehicleType;
  }>;
}>;

const initialLeg: LegSelection = {
  accommodation: "unassigned",
  breakfast: 0,
  fare: "standard",
  kennel: false,
  meal: 0,
  priorityDisembarkation: false
};

export const initialBookingDraft: BookingDraft = {
  babies: 0,
  children: 0,
  contact: { email: "", firstName: "", lastName: "", phone: "" },
  insurance: "none",
  legs: { outbound: initialLeg, return: { ...initialLeg } },
  passengers: 1,
  seniors: 0,
  vehicle: {
    height: 1.6,
    length: 4.5,
    make: "",
    model: "",
    loadedHeight: false,
    rearDepth: 0,
    rearEquipment: "none",
    sameForReturn: true,
    trailer: false,
    type: "none"
  }
};

export type PriceBreakdown = Readonly<{
  bookingFee: number;
  carbon: number;
  insurance: number;
  legs: Readonly<Record<Leg, number>>;
  options: number;
  taxes: number;
  total: number;
}>;

const accommodationPrices: Record<Accommodation, number> = {
  cabin2: 37,
  cabin4: 54,
  seat: 8,
  unassigned: 0
};
const fareMultipliers: Record<Fare, number> = { flex: 1.08, standard: 1, superFlex: 1.14 };

export function passengerCount(draft: BookingDraft): number {
  return draft.passengers + draft.children + draft.babies + draft.seniors;
}

export function calculatePrice(draft: BookingDraft, hasReturn: boolean): PriceBreakdown {
  const people = passengerCount(draft);
  const vehicleBase =
    draft.vehicle.type === "none" ? 0 : draft.vehicle.type === "motorcycle" ? 25 : 57;
  const calculateLeg = (leg: LegSelection) =>
    Math.round(
      (draft.passengers * 44 + draft.children * 26 + draft.seniors * 39 + vehicleBase) *
        fareMultipliers[leg.fare] *
        100
    ) / 100;
  const outbound = calculateLeg(draft.legs.outbound);
  const returnPrice = hasReturn ? calculateLeg(draft.legs.return) : 0;
  const selectedLegs = hasReturn ? [draft.legs.outbound, draft.legs.return] : [draft.legs.outbound];
  const options = selectedLegs.reduce(
    (sum, leg) =>
      sum +
      accommodationPrices[leg.accommodation] +
      leg.breakfast * 8.7 +
      leg.meal * 29.5 +
      (leg.kennel ? 17 : 0) +
      (leg.priorityDisembarkation ? 20 : 0),
    0
  );
  const insurance = { multirisk: 8, none: 0, serenity: 12 }[draft.insurance];
  const bookingFee = 7;
  const carbon = people * (hasReturn ? 5 : 2.5);
  const taxes = people * (hasReturn ? 22.25 : 11.13);
  return {
    bookingFee,
    carbon,
    insurance,
    legs: { outbound, return: returnPrice },
    options,
    taxes,
    total: outbound + returnPrice + options + insurance + bookingFee + carbon + taxes
  };
}

export function isContactValid(contact: BookingDraft["contact"]): boolean {
  return Boolean(
    contact.firstName.trim() && contact.lastName.trim() && /^\S+@\S+\.\S+$/.test(contact.email)
  );
}

export function updateLeg(
  draft: BookingDraft,
  leg: Leg,
  patch: Partial<LegSelection>
): BookingDraft {
  return { ...draft, legs: { ...draft.legs, [leg]: { ...draft.legs[leg], ...patch } } };
}
