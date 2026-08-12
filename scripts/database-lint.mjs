import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const supabaseBinary =
  process.env.DATABASE_LINT_SUPABASE_BINARY ??
  join(
    repositoryRoot,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'supabase.cmd' : 'supabase',
  );

const unexpectedArguments = process.argv.slice(2);

if (unexpectedArguments.length > 0) {
  console.error(`Argument inconnu : ${unexpectedArguments.join(' ')}`);
  process.exit(2);
}

// plpgsql_check analyses every branch without executing the preceding schema
// introspection. These exact findings are therefore expected for temporary
// tables and version-dependent auth columns; anything else remains blocking.
const allowedFindings = [
  {
    functionName: 'public.validate_replanning_change_set',
    sqlState: '42P01',
    message:
      'relation "pg_temp.replanning_change_set_effective_shifts" does not exist',
    queryPrefix: 'insert into pg_temp.replanning_change_set_effective_shifts (',
  },
  {
    functionName: 'public.capture_schedule_requirement_snapshot',
    sqlState: '42P01',
    message: 'relation "requirement_snapshot_capture_rows" does not exist',
    queryPrefix: 'insert into requirement_snapshot_capture_rows (',
  },
  {
    functionName: 'public.revoke_user_auth_sessions',
    sqlState: '42883',
    message: 'operator does not exist: character varying = uuid',
    query: 'delete from auth.refresh_tokens where user_id = $1',
  },
  {
    functionName: 'public.complete_agent_offboarding',
    sqlState: '42703',
    message: 'column "banned_until" does not exist',
    query: 'select banned_until from auth.users where id = $1 for update',
  },
  {
    functionName: 'public.reactivate_agent_record',
    sqlState: '42703',
    message: 'column "banned_until" does not exist',
    query: 'select banned_until from auth.users where id = $1 for update',
  },
];

const isAllowedFinding = ({ functionName, issue }) =>
  allowedFindings.some(
    (allowed) =>
      allowed.functionName === functionName &&
      allowed.sqlState === issue.sqlState &&
      allowed.message === issue.message &&
      (allowed.query === undefined || allowed.query === issue.query?.text) &&
      (allowed.queryPrefix === undefined ||
        issue.query?.text?.startsWith(allowed.queryPrefix)),
  );

const lint = spawnSync(
  supabaseBinary,
  ['db', 'lint', '--local', '--level', 'error', '--output', 'json'],
  {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  },
);

if (lint.error || lint.status !== 0) {
  const detail = lint.error?.message ?? lint.stderr ?? lint.stdout;
  console.error(`Le lint PostgreSQL n’a pas pu être exécuté. ${detail.trim()}`);
  process.exit(lint.status ?? 1);
}

let reports;

try {
  reports = JSON.parse(lint.stdout);
} catch (error) {
  console.error(
    `Le lint PostgreSQL n’a pas produit de JSON exploitable : ${error.message}`,
  );
  process.exit(1);
}

if (!Array.isArray(reports)) {
  console.error('Format de rapport inattendu pour le lint PostgreSQL.');
  process.exit(1);
}

const findings = reports.flatMap((report) =>
  (report.issues ?? []).map((issue) => ({
    functionName: report.function,
    issue,
  })),
);
const unknownFindings = findings.filter(
  (finding) => !isAllowedFinding(finding),
);

for (const finding of findings) {
  const { functionName, issue } = finding;
  console.log(
    `${isAllowedFinding(finding) ? 'ALLOW' : 'FAIL'} ${functionName} [${issue.sqlState}] ${issue.message}`,
  );
}

if (unknownFindings.length > 0) {
  console.error(
    `${unknownFindings.length} nouvelle(s) erreur(s) de lint PostgreSQL doivent être corrigées ou analysées explicitement.`,
  );
  process.exit(1);
}

console.log(
  `Lint PostgreSQL validé (${findings.length} faux positif(s) connu(s), aucune alerte inconnue).`,
);
