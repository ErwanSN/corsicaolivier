import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const configPath = join(repositoryRoot, 'supabase', 'config.toml');
const hardeningPath = join(
  repositoryRoot,
  'ops',
  'supabase-dr',
  'local-public-acl-hardening.sql',
);
const dockerBinary = process.env.DATABASE_HARDENING_DOCKER_BINARY ?? 'docker';
const unexpectedArguments = process.argv.slice(2);

if (unexpectedArguments.length > 0) {
  console.error(`Argument inconnu : ${unexpectedArguments.join(' ')}`);
  process.exit(2);
}

const config = readFileSync(configPath, 'utf8');
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];

if (!projectId && !process.env.DATABASE_HARDENING_CONTAINER) {
  console.error(
    'Impossible de déterminer le conteneur PostgreSQL : project_id est absent de supabase/config.toml.',
  );
  process.exit(1);
}

const databaseContainer =
  process.env.DATABASE_HARDENING_CONTAINER ?? `supabase_db_${projectId}`;
const inspection = spawnSync(
  dockerBinary,
  ['inspect', '--format', '{{.State.Running}}', databaseContainer],
  { cwd: repositoryRoot, encoding: 'utf8' },
);

if (
  inspection.error ||
  inspection.status !== 0 ||
  inspection.stdout.trim() !== 'true'
) {
  console.error(
    `Le conteneur PostgreSQL local ${databaseContainer} n’est pas disponible.`,
  );
  process.exit(1);
}

const psqlArguments = [
  'exec',
  '-i',
  databaseContainer,
  'psql',
  '--username',
  'supabase_admin',
  '--dbname',
  'postgres',
  '--no-psqlrc',
  '--quiet',
  '--tuples-only',
  '--no-align',
  '--set',
  'ON_ERROR_STOP=1',
];
const hardening = spawnSync(dockerBinary, psqlArguments, {
  cwd: repositoryRoot,
  encoding: 'utf8',
  input: readFileSync(hardeningPath, 'utf8'),
  maxBuffer: 8 * 1024 * 1024,
});

if (hardening.error || hardening.status !== 0) {
  const detail = hardening.error?.message ?? hardening.stderr.trim();
  console.error(
    `Le hardening des ACL PostgreSQL a échoué.${detail ? ` ${detail}` : ''}`,
  );
  process.exit(hardening.status ?? 1);
}

const verificationQuery = String.raw`
select
  count(distinct (defaults.defaclrole, defaults.defaclobjtype)),
  count(*) filter (
    where privilege.grantee not in ('postgres'::regrole, 'service_role'::regrole)
  )
from pg_default_acl as defaults
join pg_namespace as namespace on namespace.oid = defaults.defaclnamespace
cross join lateral aclexplode(defaults.defaclacl) as privilege
where defaults.defaclrole in ('postgres'::regrole, 'supabase_admin'::regrole)
  and namespace.nspname = 'public'
  and defaults.defaclobjtype in ('f', 'S', 'r');
`;
const verification = spawnSync(
  dockerBinary,
  [...psqlArguments, '--field-separator', '|', '--command', verificationQuery],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  },
);

if (verification.error || verification.status !== 0) {
  console.error('La vérification des ACL PostgreSQL a échoué.');
  process.exit(verification.status ?? 1);
}

const actual = verification.stdout.trimEnd();

if (actual !== '6|0') {
  console.error(
    'Les ACL PostgreSQL locales diffèrent de la référence stricte de production.',
  );
  process.exit(1);
}

console.log(
  'ACL PostgreSQL durcies : 6 defaults public conformes, aucun accès anonyme sur le schéma métier.',
);
