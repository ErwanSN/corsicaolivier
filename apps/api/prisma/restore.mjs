import { restoreDatabase } from "./sqlite-recovery.mjs";

const [backupPath, targetPath, forceFlag] = process.argv.slice(2);
if (!backupPath || !targetPath || (forceFlag && forceFlag !== "--force")) {
  console.error("Usage: pnpm db:restore <sauvegarde.db> <cible.db> [--force]");
  process.exit(1);
}

try {
  const result = await restoreDatabase({
    backupPath,
    overwrite: forceFlag === "--force",
    targetPath
  });
  console.log(`Restauration vérifiée: ${result.targetPath}`);
  if (result.rollbackPath) console.log(`Copie de retour arrière: ${result.rollbackPath}`);
} catch (error) {
  console.error("Échec de la restauration:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
