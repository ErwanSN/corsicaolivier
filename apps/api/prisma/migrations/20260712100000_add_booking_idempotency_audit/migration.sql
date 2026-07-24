ALTER TABLE "booking_drafts" ADD COLUMN "idempotency_key" TEXT;
ALTER TABLE "booking_drafts" ADD COLUMN "request_hash" TEXT;
UPDATE "booking_drafts" SET "idempotency_key" = "id", "request_hash" = 'legacy';
CREATE UNIQUE INDEX "booking_drafts_idempotency_key_key" ON "booking_drafts"("idempotency_key");

CREATE TABLE "booking_audit_events" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "booking_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "metadata" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_audit_events_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "booking_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "booking_audit_events_booking_id_created_at_idx" ON "booking_audit_events"("booking_id", "created_at");

