# SQLite Backup and Recovery

## Objectives

- Local recovery point objective: the latest scheduled backup.
- Recovery time objective: under 15 minutes for the supported local dataset.
- Default retention: seven verified backups.

These objectives apply to the supported single-node local deployment. A production topology must
define its own RPO/RTO in an ADR before launch.

## Create a backup

```bash
pnpm db:backup
```

The command uses SQLite `VACUUM INTO`, validates `PRAGMA integrity_check` and
`PRAGMA foreign_key_check`, then writes a SHA-256 manifest beside the database. Configure the
destination with `BACKUP_DIRECTORY` and retention with `BACKUP_RETENTION`.

## Verify recoverability

```bash
pnpm db:recovery-test
```

This creates a consistent backup, restores it to an isolated temporary path, validates the restored
database and removes the temporary files. CI runs this drill after applying every migration.

## Restore

1. Stop the API and confirm no process has the target database open.
2. Preserve the backup and its `.json` manifest together.
3. Restore to a new path first:

   ```bash
   pnpm db:restore -- apps/api/backups/corsica-<timestamp>.db apps/api/prisma/recovered.db
   ```

4. Inspect the recovered application against that database.
5. To replace an existing stopped database, add `--force`:

   ```bash
   pnpm db:restore -- <backup.db> <target.db> --force
   ```

An overwrite moves the previous target to a timestamped `.before-restore-*` rollback copy. Never
delete it until application-level verification is complete.
