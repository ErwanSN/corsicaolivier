import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const targetPath = join(
  repositoryRoot,
  'apps/api/src/database/database.types.ts',
);
const checkOnly = process.argv.slice(2).includes('--check');
const unexpectedArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== '--check');

if (unexpectedArguments.length > 0) {
  console.error(`Argument inconnu : ${unexpectedArguments.join(' ')}`);
  process.exit(2);
}

const supabaseBinary =
  process.env.DATABASE_TYPES_SUPABASE_BINARY ??
  join(
    repositoryRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  );
const generation = spawnSync(
  supabaseBinary,
  ['gen', 'types', '--local', '--schema', 'public'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  },
);

const redactConnectionCredentials = (value) =>
  value.replace(/postgres(?:ql)?:\/\/[^@\s]+@/giu, 'postgresql://***@');

if (generation.error || generation.status !== 0) {
  const detail = generation.error?.message ?? generation.stderr ?? '';
  console.error(
    `La génération des types Supabase a échoué. ${redactConnectionCredentials(detail).trim()}`,
  );
  process.exit(generation.status ?? 1);
}

const generated = `${generation.stdout.trimEnd()}\n`;

if (!generated.startsWith('export type Json =') || generated.length < 1_000) {
  console.error(
    'Supabase n’a pas produit un fichier TypeScript valide depuis la base locale.',
  );
  process.exit(1);
}

if (!checkOnly) {
  writeFileSync(targetPath, generated);
  console.log('Types Supabase régénérés depuis le schéma public local.');
  process.exit(0);
}

const committed = readFileSync(targetPath, 'utf8');

if (committed !== generated) {
  console.error(
    'Les types Supabase ont dérivé du schéma local. Exécutez `pnpm db:types` puis committez le fichier généré.',
  );
  process.exit(1);
}

console.log('Types Supabase synchronisés avec le schéma public local.');
