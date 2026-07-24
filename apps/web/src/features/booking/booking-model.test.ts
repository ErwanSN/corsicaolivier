import { describe, expect, it } from "vitest";
import {
  calculatePrice,
  initialBookingDraft,
  isContactValid,
  passengerCount,
  updateLeg
} from "./booking-model";

describe("booking model", () => {
  it("calculates passenger categories and both sailing legs", () => {
    const draft = { ...initialBookingDraft, children: 1 };
    expect(passengerCount(draft)).toBe(2);
    const price = calculatePrice(draft, true);
    expect(price.legs.outbound).toBe(70);
    expect(price.legs.return).toBe(70);
    expect(price.total).toBeGreaterThan(190);
  });
  it("prices only selected leg options", () => {
    const draft = updateLeg(initialBookingDraft, "outbound", { breakfast: 1, kennel: true });
    expect(calculatePrice(draft, false).options).toBe(25.7);
  });
  it("validates minimum contact information", () => {
    expect(
      isContactValid({ email: "lea@example.fr", firstName: "Léa", lastName: "Rossi", phone: "" })
    ).toBe(true);
    expect(isContactValid({ email: "incorrect", firstName: "Léa", lastName: "", phone: "" })).toBe(
      false
    );
  });
  it("does not invent a generic price for vehicle dimensions", () => {
    const draft = {
      ...initialBookingDraft,
      vehicle: {
        ...initialBookingDraft.vehicle,
        loadedHeight: true,
        rearDepth: 3,
        rearEquipment: "trailer" as const,
        type: "car" as const
      }
    };
    expect(calculatePrice(draft, false).options).toBe(0);
  });
});
