import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { backupDatabase, restoreDatabase, verifyDatabase } from "./sqlite-recovery.mjs";

const directory = await mkdtemp(path.join(tmpdir(), "corsica-recovery-"));
const backupPath = path.join(directory, "backup.db");
const restoredPath = path.join(directory, "restored.db");
try {
  await backupDatabase({
    outputPath: backupPath,
    sourceUrl: process.env.DATABASE_URL ?? "file:./prisma/local.db"
  });
  await restoreDatabase({ backupPath, targetPath: restoredPath });
  await verifyDatabase(restoredPath);
  console.log("Test de reprise SQLite réussi.");
} catch (error) {
  console.error("Test de reprise SQLite échoué:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await rm(directory, { force: true, recursive: true });
}
