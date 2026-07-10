CREATE TABLE "control_records" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dossier_id" TEXT NOT NULL,
  "controlled_by_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "controlled_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "control_records_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "control_records_controlled_by_id_fkey" FOREIGN KEY ("controlled_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "control_records_controlled_at_idx" ON "control_records"("controlled_at");
CREATE INDEX "control_records_controlled_by_id_controlled_at_idx" ON "control_records"("controlled_by_id", "controlled_at");
