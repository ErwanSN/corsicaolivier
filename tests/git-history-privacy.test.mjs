import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const scanner = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../scripts/git-history-privacy.mjs',
);

function command(directory, executable, args, options = {}) {
  const result = spawnSync(executable, args, {
    cwd: directory,
    encoding: 'utf8',
    ...options,
  });

  assert.equal(
    result.status,
    0,
    `${executable} ${args[0] ?? ''} a échoué : ${result.stderr}`,
  );
  return result.stdout.trim();
}

async function repository() {
  const directory = await mkdtemp(`${tmpdir()}/corsica-privacy-`);
  command(directory, 'git', ['init', '--quiet']);
  command(directory, 'git', ['config', 'user.name', 'CI privacy test']);
  command(directory, 'git', ['config', 'user.email', 'ci@example.invalid']);
  await writeFile(`${directory}/README.md`, 'baseline\n');
  command(directory, 'git', ['add', 'README.md']);
  command(directory, 'git', ['commit', '--quiet', '-m', 'baseline']);
  const baseline = command(directory, 'git', ['rev-parse', 'HEAD']);
  await mkdir(`${directory}/ops/security`, { recursive: true });
  await writeFile(
    `${directory}/ops/security/git-history-privacy-baseline.txt`,
    `${baseline}\n`,
  );
  return directory;
}

function scan(directory) {
  return spawnSync(process.execPath, [scanner], {
    cwd: directory,
    encoding: 'utf8',
  });
}

test('accepte les données de test réservées après le baseline', async () => {
  const directory = await repository();
  await writeFile(`${directory}/safe.txt`, 'operator@example.invalid\n');
  command(directory, 'git', ['add', 'safe.txt']);
  command(directory, 'git', ['commit', '--quiet', '-m', 'safe fixture']);

  assert.equal(scan(directory).status, 0);
});

test('refuse la réintroduction du corpus sans exposer son chemin', async () => {
  const directory = await repository();
  await mkdir(`${directory}/corpus`, { recursive: true });
  await writeFile(`${directory}/corpus/agent-list.csv`, 'synthetic\n');
  command(directory, 'git', ['add', 'corpus/agent-list.csv']);
  command(directory, 'git', ['commit', '--quiet', '-m', 'unsafe corpus']);

  const result = scan(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /répertoire documentaire interdit/u);
  assert.doesNotMatch(result.stderr, /agent-list/u);
});

test('refuse un e-mail ou un téléphone ajouté sans les journaliser', async () => {
  const directory = await repository();
  const privateAddress = ['agent', 'internal.company.fr'].join('@');
  const privatePhone = ['+33', '6', '12', '34', '56', '78'].join(' ');
  await writeFile(
    `${directory}/notes.txt`,
    `${privateAddress}\n${privatePhone}\n`,
  );

  const result = scan(directory);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /adresse e-mail non réservée/u);
  assert.match(result.stderr, /numéro de téléphone français/u);
  assert.doesNotMatch(result.stderr, new RegExp(privateAddress, 'u'));
  assert.doesNotMatch(result.stderr, /\+33 6 12/u);
  assert.doesNotMatch(result.stderr, /notes\.txt/u);
});
