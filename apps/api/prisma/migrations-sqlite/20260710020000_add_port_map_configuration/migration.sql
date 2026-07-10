CREATE TABLE "port_map_configurations" (
  "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
  "payload" TEXT NOT NULL,
  "updated_at" DATETIME NOT NULL
);
