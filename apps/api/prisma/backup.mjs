import path from "node:path";

import { backupDatabase, pruneBackups } from "./sqlite-recovery.mjs";

const sourceUrl = process.env.DATABASE_URL ?? "file:./prisma/local.db";
const backupDirectory = path.resolve(process.env.BACKUP_DIRECTORY ?? "./backups");
const retain = Number.parseInt(process.env.BACKUP_RETENTION ?? "7", 10);
const outputPath = path.join(backupDirectory, `corsica-${timestamp()}.db`);

try {
  const metadata = await backupDatabase({ outputPath, sourceUrl });
  await pruneBackups(backupDirectory, retain);
  console.log(`Sauvegarde vérifiée: ${outputPath} (${String(metadata.bytes)} octets)`);
} catch (error) {
  console.error("Échec de la sauvegarde:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

function timestamp() {
  return new Date().toISOString().replaceAll(/[:.]/g, "-");
}
