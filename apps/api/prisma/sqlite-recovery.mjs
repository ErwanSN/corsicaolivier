import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

export async function backupDatabase({ outputPath, sourceUrl }) {
  const absoluteOutput = path.resolve(outputPath);
  await mkdir(path.dirname(absoluteOutput), { recursive: true });
  await assertMissing(absoluteOutput);
  const temporaryPath = `${absoluteOutput}.tmp-${randomUUID()}`;
  const prisma = createClient(sourceUrl);
  try {
    await prisma.$executeRawUnsafe("VACUUM INTO ?", normalizePath(temporaryPath));
    await verifyDatabase(temporaryPath);
    await rename(temporaryPath, absoluteOutput);
    const metadata = await createMetadata(absoluteOutput);
    await writeFile(`${absoluteOutput}.json`, `${JSON.stringify(metadata, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    return metadata;
  } finally {
    await prisma.$disconnect();
    await rm(temporaryPath, { force: true });
  }
}

export async function restoreDatabase({ backupPath, overwrite = false, targetPath }) {
  const source = path.resolve(backupPath);
  const target = path.resolve(targetPath);
  if (source === target) throw new Error("La sauvegarde et la cible doivent être distinctes.");
  await verifyDatabase(source);
  await verifyMetadataWhenPresent(source);
  await mkdir(path.dirname(target), { recursive: true });

  const targetExists = await exists(target);
  if (targetExists && !overwrite) {
    throw new Error("La cible existe déjà. Utilisez --force après avoir arrêté le serveur.");
  }
  const temporaryPath = `${target}.tmp-${randomUUID()}`;
  const rollbackPath = targetExists ? `${target}.before-restore-${timestamp()}` : null;
  try {
    await copyFile(source, temporaryPath);
    await verifyDatabase(temporaryPath);
    if (rollbackPath) await rename(target, rollbackPath);
    try {
      await rename(temporaryPath, target);
    } catch (error) {
      if (rollbackPath) await rename(rollbackPath, target);
      throw error;
    }
    return { rollbackPath, targetPath: target };
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function verifyDatabase(databasePath) {
  const prisma = createClient(`file:${normalizePath(path.resolve(databasePath))}`);
  try {
    const integrity = await prisma.$queryRawUnsafe("PRAGMA integrity_check");
    if (!Array.isArray(integrity) || integrity.some((row) => row.integrity_check !== "ok")) {
      throw new Error("Échec de PRAGMA integrity_check.");
    }
    const foreignKeyErrors = await prisma.$queryRawUnsafe("PRAGMA foreign_key_check");
    if (!Array.isArray(foreignKeyErrors) || foreignKeyErrors.length > 0) {
      throw new Error("Des contraintes de clé étrangère sont invalides.");
    }
    const tables = await prisma.$queryRawUnsafe(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
    );
    const tableNames = new Set(Array.isArray(tables) ? tables.map((row) => row.name) : []);
    const missingTables = requiredTables.filter((table) => !tableNames.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Schéma Corsica incomplet: ${missingTables.join(", ")}.`);
    }
    return true;
  } finally {
    await prisma.$disconnect();
  }
}

const requiredTables = [
  "_prisma_migrations",
  "port_map_configurations",
  "refresh_sessions",
  "users"
];

export async function pruneBackups(directory, retain) {
  if (!Number.isSafeInteger(retain) || retain < 1)
    throw new Error("La rétention doit être positive.");
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const backups = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".db"))
    .map((entry) => entry.name)
    .sort()
    .reverse();
  await Promise.all(
    backups
      .slice(retain)
      .flatMap((name) => [
        rm(path.join(directory, name), { force: true }),
        rm(path.join(directory, `${name}.json`), { force: true })
      ])
  );
}

function createClient(url) {
  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}

async function createMetadata(databasePath) {
  const file = await readFile(databasePath);
  const fileStat = await stat(databasePath);
  return {
    bytes: fileStat.size,
    createdAt: new Date().toISOString(),
    file: path.basename(databasePath),
    sha256: createHash("sha256").update(file).digest("hex"),
    version: 1
  };
}

async function verifyMetadataWhenPresent(databasePath) {
  const metadataPath = `${databasePath}.json`;
  if (!(await exists(metadataPath))) return;
  const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
  const actual = await createMetadata(databasePath);
  if (
    metadata.version !== 1 ||
    metadata.bytes !== actual.bytes ||
    metadata.sha256 !== actual.sha256
  ) {
    throw new Error("Les métadonnées de la sauvegarde ne correspondent pas au fichier.");
  }
}

async function assertMissing(filePath) {
  const handle = await open(filePath, "wx");
  await handle.close();
  await rm(filePath, { force: true });
}

async function exists(filePath) {
  return stat(filePath).then(
    () => true,
    () => false
  );
}

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[:.]/g, "-");
}
