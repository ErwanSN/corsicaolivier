"use client";

import { useEffect, useState } from "react";
import { ApiClientError } from "@corsica/api-client";
import {
  type BookingDraft as ServerDraft,
  type BookingDraftInput,
  type BookingQuote
} from "@corsica/contracts";
import { apiClient } from "../../lib/api-client";
import { initialBookingDraft, type BookingDraft } from "./booking-model";

const storageKey = "corsica.booking.draftId.v1";
const legacyStorageKey = "corsica.booking.draft.v1";
export type BookingSyncState = "error" | "loading" | "saved" | "saving";
type Options = Readonly<{
  depart: string;
  draft: BookingDraft;
  onHydrate: (draft: BookingDraft) => void;
  retour: string | undefined;
  route: string;
}>;

export function useServerBooking({ depart, draft, onHydrate, retour, route }: Options) {
  const [booking, setBooking] = useState<ServerDraft | null>(null);
  const [syncState, setSyncState] = useState<BookingSyncState>("loading");
  useEffect(() => {
    let active = true;
    window.localStorage.removeItem(legacyStorageKey);
    void loadOrCreate(window.localStorage.getItem(storageKey), depart, retour, route)
      .then((loaded) => {
        if (!active) return;
        window.localStorage.setItem(storageKey, loaded.id);
        onHydrate(fromServerInput(loaded.draft));
        setBooking(loaded);
        setSyncState("saved");
      })
      .catch(() => {
        if (active) setSyncState("error");
      });
    return () => {
      active = false;
    };
  }, [depart, onHydrate, retour, route]);
  useEffect(() => {
    if (!booking) return;
    const nextDraft = toServerInput(draft, depart, retour, route);
    if (JSON.stringify(nextDraft) === JSON.stringify(booking.draft)) return;
    const timeout = window.setTimeout(() => {
      setSyncState("saving");
      void apiClient
        .updateBookingDraft(booking.id, { draft: nextDraft, expectedVersion: booking.version })
        .then((updated) => {
          setBooking(updated);
          setSyncState("saved");
        })
        .catch((error: unknown) => {
          if (error instanceof ApiClientError && error.code === "BOOKING_DRAFT_EXPIRED")
            window.localStorage.removeItem(storageKey);
          setSyncState("error");
        });
    }, 400);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [booking, depart, draft, retour, route]);
  return { quote: booking?.quote, syncState } as Readonly<{
    quote: BookingQuote | undefined;
    syncState: BookingSyncState;
  }>;
}

function toServerInput(
  draft: BookingDraft,
  depart: string,
  retour: string | undefined,
  route: string
): BookingDraftInput {
  return { ...draft, itinerary: { depart, ...(retour ? { retour } : {}), route } };
}
function fromServerInput(input: BookingDraftInput): BookingDraft {
  return {
    babies: input.babies,
    children: input.children,
    contact: input.contact,
    insurance: input.insurance,
    legs: input.legs,
    passengers: input.passengers,
    seniors: input.seniors,
    vehicle: input.vehicle
  };
}
async function loadOrCreate(
  id: string | null,
  depart: string,
  retour: string | undefined,
  route: string
): Promise<ServerDraft> {
  if (id)
    try {
      return await apiClient.getBookingDraft(id);
    } catch (error) {
      if (!(error instanceof ApiClientError) || ![404, 410].includes(error.status)) throw error;
      window.localStorage.removeItem(storageKey);
    }
  return apiClient.createBookingDraft(toServerInput(initialBookingDraft, depart, retour, route));
}
