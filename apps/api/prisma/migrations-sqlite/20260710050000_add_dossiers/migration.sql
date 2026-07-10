CREATE TABLE "dossiers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "reference" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "normalized_phone" TEXT NOT NULL,
  "route_label" TEXT NOT NULL,
  "currency_label" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL
);

CREATE UNIQUE INDEX "dossiers_reference_key" ON "dossiers"("reference");
CREATE INDEX "dossiers_normalized_phone_idx" ON "dossiers"("normalized_phone");

CREATE TABLE "travelers" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dossier_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized_name" TEXT NOT NULL,
  "date_label" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  CONSTRAINT "travelers_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "travelers_dossier_id_idx" ON "travelers"("dossier_id");
CREATE INDEX "travelers_normalized_name_idx" ON "travelers"("normalized_name");

CREATE TABLE "vehicles" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "dossier_id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "owner" TEXT NOT NULL,
  "paid" BOOLEAN NOT NULL DEFAULT false,
  "plate" TEXT NOT NULL,
  "normalized_plate" TEXT NOT NULL,
  CONSTRAINT "vehicles_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "dossiers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "vehicles_dossier_id_idx" ON "vehicles"("dossier_id");
CREATE INDEX "vehicles_normalized_plate_idx" ON "vehicles"("normalized_plate");

-- Preserve the records that were previously bundled in the staff client while
-- moving their source of truth to the local database.
INSERT INTO "dossiers" VALUES
  ('93620490-0000-4000-8000-000000000001', '9362049', '0675561134', '0675561134', 'MURU : MRS - ILR - 18:45', 'Réglé en EUR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('93620500-0000-4000-8000-000000000002', '9362050', '0611223344', '0611223344', 'PASCA : MRS - AJA - 20:30', 'Réglé en EUR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('93620510-0000-4000-8000-000000000003', '9362051', '0788990011', '0788990011', 'MONT : MRS - BIA - 21:00', 'Réglé en EUR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "travelers" VALUES
  ('00000000-0000-4000-8000-000000000101', '93620490-0000-4000-8000-000000000001', 'Jeanne Delavoi', 'jeanne delavoi', '30/06/26 - 19:15', 'embarque'),
  ('00000000-0000-4000-8000-000000000102', '93620490-0000-4000-8000-000000000001', 'Bertrand Delavoi', 'bertrand delavoi', '30/06/26 - 19:15', 'attente'),
  ('00000000-0000-4000-8000-000000000103', '93620500-0000-4000-8000-000000000002', 'Marie Santini', 'marie santini', '30/06/26 - 20:05', 'embarque'),
  ('00000000-0000-4000-8000-000000000104', '93620500-0000-4000-8000-000000000002', 'Paul Santini', 'paul santini', '30/06/26 - 20:05', 'embarque'),
  ('00000000-0000-4000-8000-000000000105', '93620510-0000-4000-8000-000000000003', 'Antoine Rossi', 'antoine rossi', '30/06/26 - 20:40', 'attente');

INSERT INTO "vehicles" VALUES
  ('00000000-0000-4000-8000-000000000201', '93620490-0000-4000-8000-000000000001', 'PEUGEOT 207', 'Bertrand Delavoi', true, 'EA 279 RZ', 'ea279rz'),
  ('00000000-0000-4000-8000-000000000202', '93620500-0000-4000-8000-000000000002', 'RENAULT CLIO', 'Marie Santini', true, 'GF 118 AB', 'gf118ab');
