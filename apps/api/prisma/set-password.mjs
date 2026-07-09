// Force le mot de passe d'un compte (utilitaire dev, contourne la règle des 8
// caractères de l'inscription). Hash identique à src/auth/password-hasher.ts.
// Usage: pnpm --filter @corsica/api set-password <email> <nouveau_mot_de_passe>
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: pnpm --filter @corsica/api set-password <email> <password>");
  process.exit(1);
}

const salt = randomBytes(16).toString("base64url");
const key = scryptSync(password, salt, 64).toString("base64url");
const passwordHash = `scrypt$v1$${salt}$${key}`;

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://corsica:corsica@localhost:5432/corsica?schema=public";
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { passwordHash },
    select: { email: true, username: true }
  });
  console.log(`OK: mot de passe mis a jour pour ${user.email} (username ${user.username})`);
} catch (error) {
  const message = error?.code === "P2025" ? `Aucun compte avec l'email ${email}` : error?.message;
  console.error("Echec:", message ?? error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
