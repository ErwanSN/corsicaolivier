import {
  BadRequestException,
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  bookingDraftInputSchema,
  updateBookingDraftSchema,
  type BookingDraft,
  type BookingDraftInput,
  type BookingQuote
} from "@corsica/contracts";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../database/prisma.service";
import { recordBookingEvent } from "../metrics/metrics.registry";

const draftLifetimeMilliseconds = 20 * 60 * 1000;

@Injectable()
export class BookingsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: unknown, idempotencyKey: string | undefined): Promise<BookingDraft> {
    const draft = parseDraft(input);
    assertIdempotencyKey(idempotencyKey);
    const requestHash = hashDraft(draft);
    const replay = await this.findReplay(idempotencyKey, requestHash);
    if (replay) return replay;
    const expiresAt = new Date(Date.now() + draftLifetimeMilliseconds);
    const quote = calculateQuote(draft, expiresAt);
    try {
      const stored = await this.prisma.$transaction(async (transaction) => {
        const booking = await transaction.bookingDraft.create({
          data: {
            expiresAt,
            idempotencyKey,
            payload: JSON.stringify(draft),
            quote: JSON.stringify(quote),
            requestHash
          }
        });
        await transaction.bookingAuditEvent.create({
          data: {
            bookingId: booking.id,
            eventType: "DRAFT_CREATED",
            metadata: JSON.stringify({ quoteExpiresAt: expiresAt.toISOString() }),
            version: 1
          }
        });
        return booking;
      });
      recordBookingEvent("created");
      return toBookingDraft(stored);
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const concurrent = await this.findReplay(idempotencyKey, requestHash);
      if (concurrent) return concurrent;
      throw idempotencyConflict();
    }
  }

  private async findReplay(key: string, requestHash: string): Promise<BookingDraft | undefined> {
    const stored = await this.prisma.bookingDraft.findUnique({ where: { idempotencyKey: key } });
    if (!stored) return undefined;
    if (stored.requestHash !== requestHash) throw idempotencyConflict();
    recordBookingEvent("replayed");
    return toBookingDraft(stored);
  }

  async findOne(id: string): Promise<BookingDraft> {
    const stored = await this.prisma.bookingDraft.findUnique({ where: { id } });
    if (!stored) {
      recordBookingEvent("not_found");
      throw new NotFoundException({
        code: "BOOKING_DRAFT_NOT_FOUND",
        message: "Ce brouillon de réservation est introuvable."
      });
    }
    if (stored.expiresAt <= new Date()) {
      recordBookingEvent("expired");
      throw new GoneException({
        code: "BOOKING_DRAFT_EXPIRED",
        message: "Ce devis a expiré. Relancez la recherche pour actualiser les disponibilités."
      });
    }
    return toBookingDraft(stored);
  }

  async update(id: string, input: unknown): Promise<BookingDraft> {
    const parsed = updateBookingDraftSchema.safeParse(input);
    if (!parsed.success) throw invalidDraft();
    const current = await this.prisma.bookingDraft.findUnique({ where: { id } });
    if (!current) {
      recordBookingEvent("not_found");
      throw new NotFoundException({
        code: "BOOKING_DRAFT_NOT_FOUND",
        message: "Ce brouillon de réservation est introuvable."
      });
    }
    if (current.expiresAt <= new Date()) {
      recordBookingEvent("expired");
      throw new GoneException({
        code: "BOOKING_DRAFT_EXPIRED",
        message: "Ce devis a expiré. Relancez la recherche pour actualiser les disponibilités."
      });
    }
    const expiresAt = new Date(Date.now() + draftLifetimeMilliseconds);
    const quote = calculateQuote(parsed.data.draft, expiresAt);
    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.bookingDraft.updateMany({
        data: {
          expiresAt,
          payload: JSON.stringify(parsed.data.draft),
          quote: JSON.stringify(quote),
          requestHash: hashDraft(parsed.data.draft),
          version: { increment: 1 }
        },
        where: { id, version: parsed.data.expectedVersion }
      });
      if (result.count !== 1) {
        recordBookingEvent("conflict");
        throw new ConflictException({
          code: "BOOKING_DRAFT_VERSION_CONFLICT",
          message: "La réservation a été modifiée ailleurs. Rechargez le devis avant de continuer."
        });
      }
      await transaction.bookingAuditEvent.create({
        data: {
          bookingId: id,
          eventType: "DRAFT_UPDATED",
          metadata: JSON.stringify({ quoteExpiresAt: expiresAt.toISOString() }),
          version: parsed.data.expectedVersion + 1
        }
      });
    });
    recordBookingEvent("updated");
    return this.findOne(id);
  }
}

type StoredDraft = Readonly<{
  createdAt: Date;
  expiresAt: Date;
  id: string;
  payload: string;
  quote: string;
  updatedAt: Date;
  version: number;
}>;

function toBookingDraft(stored: StoredDraft): BookingDraft {
  return {
    createdAt: stored.createdAt.toISOString(),
    draft: bookingDraftInputSchema.parse(JSON.parse(stored.payload) as unknown),
    expiresAt: stored.expiresAt.toISOString(),
    id: stored.id,
    quote: JSON.parse(stored.quote) as BookingQuote,
    updatedAt: stored.updatedAt.toISOString(),
    version: stored.version
  };
}

function parseDraft(input: unknown): BookingDraftInput {
  const parsed = bookingDraftInputSchema.safeParse(input);
  if (!parsed.success) throw invalidDraft();
  return parsed.data;
}

function invalidDraft(): BadRequestException {
  return new BadRequestException({
    code: "BOOKING_DRAFT_INVALID",
    message: "Les informations de réservation sont invalides."
  });
}

function assertIdempotencyKey(key: string | undefined): asserts key is string {
  if (key && /^[\w-]{16,128}$/.test(key)) return;
  throw new BadRequestException({
    code: "IDEMPOTENCY_KEY_INVALID",
    message: "Une clé d’idempotence valide est requise."
  });
}

function idempotencyConflict(): ConflictException {
  recordBookingEvent("conflict");
  return new ConflictException({
    code: "IDEMPOTENCY_KEY_REUSED",
    message: "Cette clé d’idempotence correspond à une autre requête."
  });
}

function hashDraft(draft: BookingDraftInput): string {
  return createHash("sha256").update(JSON.stringify(draft)).digest("hex");
}

export function calculateQuote(draft: BookingDraftInput, expiresAt: Date): BookingQuote {
  const people = draft.passengers + draft.children + draft.babies + draft.seniors;
  const hasReturn = Boolean(draft.itinerary.retour);
  const vehicle = draft.vehicle.type === "none" ? 0 : draft.vehicle.type === "motorcycle" ? 25 : 57;
  const legPrice = (leg: BookingDraftInput["legs"]["outbound"]) =>
    Math.round(
      (draft.passengers * 44 + draft.children * 26 + draft.seniors * 39 + vehicle) *
        { flex: 1.08, standard: 1, superFlex: 1.14 }[leg.fare] *
        100
    ) / 100;
  const outbound = legPrice(draft.legs.outbound);
  const returnPrice = hasReturn ? legPrice(draft.legs.return) : 0;
  const selectedLegs = hasReturn ? [draft.legs.outbound, draft.legs.return] : [draft.legs.outbound];
  const options = selectedLegs.reduce(
    (sum, leg) =>
      sum +
      { cabin2: 37, cabin4: 54, seat: 8, unassigned: 0 }[leg.accommodation] +
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
    currency: "EUR",
    expiresAt: expiresAt.toISOString(),
    insurance,
    legs: { outbound, return: returnPrice },
    options,
    taxes,
    total: outbound + returnPrice + options + insurance + bookingFee + carbon + taxes
  };
}
import { createHash } from "node:crypto";
