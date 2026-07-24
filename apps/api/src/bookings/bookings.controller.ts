import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Patch, Post } from "@nestjs/common";
import { type BookingDraft } from "@corsica/contracts";

import { BookingsService } from "./bookings.service";

@Controller({ path: "booking-drafts", version: "1" })
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  create(
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string
  ): Promise<BookingDraft> {
    return this.bookingsService.create(body, idempotencyKey);
  }

  @Get(":id")
  findOne(@Param("id", ParseUUIDPipe) id: string): Promise<BookingDraft> {
    return this.bookingsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() body: unknown): Promise<BookingDraft> {
    return this.bookingsService.update(id, body);
  }
}
