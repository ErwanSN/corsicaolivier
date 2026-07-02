import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://corsica:corsica@localhost:5432/corsica?schema=public";

export default defineConfig({
  datasource: {
    url: databaseUrl
  },
  migrations: {
    path: "prisma/migrations"
  },
  schema: "prisma/schema.prisma"
});
