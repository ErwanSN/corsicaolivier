// Promeut / change le rôle d'un compte existant.
// Usage: pnpm --filter @corsica/api promote <email> <USER|EMPLOYEE|ADMIN>
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const ROLES = ["USER", "EMPLOYEE", "ADMIN"];
const [email, role] = process.argv.slice(2);

if (!email || !ROLES.includes(role)) {
  console.error(`Usage: pnpm --filter @corsica/api promote <email> <${ROLES.join("|")}>`);
  process.exit(1);
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://corsica:corsica@localhost:5432/corsica?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { role },
    select: { email: true, role: true }
  });
  console.log(`OK: ${user.email} -> ${user.role}`);
} catch (error) {
  const message = error?.code === "P2025" ? `Aucun compte avec l'email ${email}` : error?.message;
  console.error("Echec:", message ?? error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
