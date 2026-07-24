import { describe, expect, it } from "vitest";
import { bookingQuoteSchema, type BookingDraftInput } from "@corsica/contracts";

import { calculateQuote } from "./bookings.service";

const draft: BookingDraftInput = {
  babies: 0,
  children: 1,
  contact: { email: "client@example.test", firstName: "Léa", lastName: "Rossi", phone: "" },
  insurance: "serenity",
  itinerary: { depart: "2099-01-01", retour: "2099-01-02", route: "mrs-aja" },
  legs: {
    outbound: {
      accommodation: "cabin2",
      breakfast: 2,
      fare: "flex",
      kennel: false,
      meal: 0,
      priorityDisembarkation: false
    },
    return: {
      accommodation: "seat",
      breakfast: 0,
      fare: "standard",
      kennel: true,
      meal: 2,
      priorityDisembarkation: false
    }
  },
  passengers: 1,
  seniors: 0,
  vehicle: {
    height: 1.6,
    length: 4.5,
    loadedHeight: false,
    make: "Renault",
    model: "Mégane",
    rearDepth: 0,
    rearEquipment: "none",
    sameForReturn: true,
    trailer: false,
    type: "car"
  }
};

describe("booking quote", () => {
  it("produces a validated, expiring EUR quote from server-owned rules", () => {
    const expiresAt = new Date("2098-12-31T12:20:00.000Z");
    const quote = calculateQuote(draft, expiresAt);
    expect(bookingQuoteSchema.parse(quote)).toEqual(quote);
    expect(quote.expiresAt).toBe(expiresAt.toISOString());
    expect(quote.legs.outbound).toBeGreaterThan(quote.legs.return);
    expect(quote.total).toBeCloseTo(
      quote.legs.outbound +
        quote.legs.return +
        quote.options +
        quote.insurance +
        quote.bookingFee +
        quote.carbon +
        quote.taxes
    );
  });
});
