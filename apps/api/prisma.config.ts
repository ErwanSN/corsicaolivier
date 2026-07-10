import "dotenv/config";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/local.db";

export default defineConfig({
  datasource: {
    url: databaseUrl
  },
  migrations: {
    path: "prisma/migrations-sqlite"
  },
  schema: "prisma/schema.prisma"
});
