import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3001/api/v1";
const draft = {
  babies: 0,
  children: 0,
  contact: { email: "client@example.test", firstName: "Léa", lastName: "Rossi", phone: "" },
  insurance: "none",
  itinerary: { depart: "2099-01-01", retour: "2099-01-02", route: "mrs-aja" },
  legs: {
    outbound: {
      accommodation: "seat",
      breakfast: 0,
      fare: "standard",
      kennel: false,
      meal: 0,
      priorityDisembarkation: false
    },
    return: {
      accommodation: "unassigned",
      breakfast: 0,
      fare: "flex",
      kennel: false,
      meal: 0,
      priorityDisembarkation: false
    }
  },
  passengers: 1,
  seniors: 0,
  vehicle: {
    height: 1.6,
    length: 4.5,
    loadedHeight: false,
    make: "",
    model: "",
    rearDepth: 0,
    rearEquipment: "none",
    sameForReturn: true,
    trailer: false,
    type: "none"
  }
} as const;

test("un devis serveur persiste et rejette les écritures concurrentes obsolètes", async ({
  request
}) => {
  const idempotencyKey = `booking-e2e-${randomUUID()}`;
  const createdResponse = await request.post(`${apiUrl}/booking-drafts`, {
    data: draft,
    headers: { "Idempotency-Key": idempotencyKey }
  });
  expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()) as {
    id: string;
    quote: { currency: string; total: number };
    version: number;
  };
  expect(created.quote.currency).toBe("EUR");
  expect(created.quote.total).toBeGreaterThan(0);
  const replayResponse = await request.post(`${apiUrl}/booking-drafts`, {
    data: draft,
    headers: { "Idempotency-Key": idempotencyKey }
  });
  expect(replayResponse.status()).toBe(201);
  await expect(replayResponse.json()).resolves.toMatchObject({ id: created.id, version: 1 });

  const update = { draft: { ...draft, passengers: 2 }, expectedVersion: created.version };
  const updatedResponse = await request.patch(`${apiUrl}/booking-drafts/${created.id}`, {
    data: update
  });
  expect(updatedResponse.ok()).toBe(true);
  const updated = (await updatedResponse.json()) as { quote: { total: number }; version: number };
  expect(updated.version).toBe(created.version + 1);
  expect(updated.quote.total).toBeGreaterThan(created.quote.total);

  const staleResponse = await request.patch(`${apiUrl}/booking-drafts/${created.id}`, {
    data: update
  });
  expect(staleResponse.status()).toBe(409);
  await expect(staleResponse.json()).resolves.toMatchObject({
    code: "BOOKING_DRAFT_VERSION_CONFLICT"
  });
});
