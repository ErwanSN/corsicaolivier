import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const testsDirectory = join(repositoryRoot, 'supabase', 'tests');
const configPath = join(repositoryRoot, 'supabase', 'config.toml');
const dockerBinary = process.env.DATABASE_TEST_DOCKER_BINARY ?? 'docker';
const databaseUser = process.env.DATABASE_TEST_USER ?? 'supabase_admin';

const unexpectedArguments = process.argv.slice(2);

if (unexpectedArguments.length > 0) {
  console.error(`Argument inconnu : ${unexpectedArguments.join(' ')}`);
  process.exit(2);
}

const testFiles = readdirSync(testsDirectory, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
  .map((entry) => join(testsDirectory, entry.name))
  .sort((left, right) => left.localeCompare(right));

if (testFiles.length === 0) {
  console.error('Aucune suite pgTAP trouvée dans supabase/tests.');
  process.exit(1);
}

const config = readFileSync(configPath, 'utf8');
const projectId = config.match(/^project_id\s*=\s*"([^"]+)"\s*$/m)?.[1];

if (!projectId && !process.env.DATABASE_TEST_CONTAINER) {
  console.error(
    'Impossible de déterminer le conteneur PostgreSQL : project_id est absent de supabase/config.toml.',
  );
  process.exit(1);
}

const databaseContainer =
  process.env.DATABASE_TEST_CONTAINER ?? `supabase_db_${projectId}`;
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
  const detail = inspection.error?.message ?? inspection.stderr.trim();
  console.error(
    `Le conteneur PostgreSQL local ${databaseContainer} n’est pas disponible.${detail ? ` ${detail}` : ''}`,
  );
  process.exit(1);
}

const psqlArguments = [
  'exec',
  '-i',
  databaseContainer,
  'psql',
  '--username',
  databaseUser,
  '--dbname',
  'postgres',
  '--no-psqlrc',
  '--quiet',
  '--tuples-only',
  '--no-align',
  '--set',
  'ON_ERROR_STOP=1',
];

const failures = [];
let assertionTotal = 0;

for (const testFile of testFiles) {
  const suiteName = basename(testFile);
  const execution = spawnSync(dockerBinary, psqlArguments, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    input: readFileSync(testFile, 'utf8'),
    maxBuffer: 32 * 1024 * 1024,
  });
  const stdout = execution.stdout ?? '';
  const stderr = execution.stderr ?? '';

  if (execution.error || execution.status !== 0) {
    failures.push(
      `${suiteName} : erreur SQL/psql${execution.error ? ` (${execution.error.message})` : ''}\n${stdout}${stderr}`.trim(),
    );
    console.error(`FAIL ${suiteName} (erreur SQL/psql)`);
    continue;
  }

  const lines = stdout.split(/\r?\n/u).map((line) => line.trim());
  const plans = lines
    .map((line) => line.match(/^1\.\.(\d+)(?:\s|$)/u))
    .filter(Boolean);
  const assertions = lines
    .map((line) => line.match(/^(not )?ok\s+(\d+)(?:\s|$)/u))
    .filter(Boolean);
  const failedAssertions = assertions.filter((match) => match[1]);
  const diagnostics = lines.filter(
    (line) => line.startsWith('#') || /^Bail out!/iu.test(line),
  );

  if (plans.length !== 1) {
    failures.push(
      `${suiteName} : ${plans.length === 0 ? 'aucun plan pgTAP (NOTESTS)' : 'plusieurs plans pgTAP'}\n${stdout}${stderr}`.trim(),
    );
    console.error(`FAIL ${suiteName} (plan pgTAP invalide)`);
    continue;
  }

  const expectedAssertions = Number.parseInt(plans[0][1], 10);
  const actualNumbers = assertions.map((match) =>
    Number.parseInt(match[2], 10),
  );
  const expectedNumbers = Array.from(
    { length: expectedAssertions },
    (_, index) => index + 1,
  );

  if (
    expectedAssertions === 0 ||
    assertions.length !== expectedAssertions ||
    actualNumbers.some((number, index) => number !== expectedNumbers[index]) ||
    failedAssertions.length > 0 ||
    lines.some((line) => /^Bail out!/iu.test(line))
  ) {
    failures.push(
      `${suiteName} : ${assertions.length}/${expectedAssertions} assertions, ${failedAssertions.length} échec(s)\n${diagnostics.join('\n')}`.trim(),
    );
    console.error(
      `FAIL ${suiteName} (${assertions.length}/${expectedAssertions}, ${failedAssertions.length} échec(s))`,
    );
    continue;
  }

  assertionTotal += assertions.length;
  console.log(`PASS ${suiteName} (${assertions.length} assertions)`);
}

if (failures.length > 0) {
  console.error('\nDétails des suites pgTAP en échec :');
  for (const failure of failures) console.error(`\n${failure}`);
  process.exit(1);
}

if (assertionTotal === 0) {
  console.error('Aucune assertion pgTAP n’a été exécutée.');
  process.exit(1);
}

console.log(
  `${testFiles.length} suites pgTAP et ${assertionTotal} assertions exécutées avec succès.`,
);
