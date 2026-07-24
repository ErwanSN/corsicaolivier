CREATE TABLE "booking_drafts" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "payload" TEXT NOT NULL,
  "quote" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "expires_at" DATETIME NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE INDEX "booking_drafts_expires_at_idx" ON "booking_drafts"("expires_at");
