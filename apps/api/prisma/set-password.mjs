// Force le mot de passe d'un compte en appliquant la même politique et le même
// hash que l'API. Toutes les sessions existantes sont révoquées.
// Usage: pnpm --filter @corsica/api set-password <email> <nouveau_mot_de_passe>
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const [email, password] = process.argv.slice(2);

if (!email || !password || password.length < 8 || password.length > 128) {
  console.error("Usage: pnpm --filter @corsica/api set-password <email> <password>");
  console.error("Le mot de passe doit contenir entre 8 et 128 caractères.");
  process.exit(1);
}

const salt = randomBytes(16).toString("base64url");
const key = scryptSync(password, salt, 64).toString("base64url");
const passwordHash = `scrypt$v1$${salt}$${key}`;

const databaseUrl = process.env.DATABASE_URL ?? "file:./prisma/local.db";
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: databaseUrl }) });

try {
  const user = await prisma.user.update({
    where: { email: email.trim().toLowerCase() },
    data: { passwordHash, sessionVersion: { increment: 1 } },
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
