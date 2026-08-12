#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const baselinePath = 'ops/security/git-history-privacy-baseline.txt';
const emptyTree = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const maximumScannedFileBytes = 5 * 1024 * 1024;
const sensitiveArtifactPattern =
  /\.(?:7z|backup|csv|docx?|dump|ods|pdf|pptx?|rtf|tsv|xlsx?|xlsm|zip)(?:\.txt)?$/i;
const compressedSqlPattern = /\.sql\.(?:bz2|gz|xz)$/i;
const emailPattern =
  /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})/giu;
const frenchPhonePattern =
  /(?<![a-zA-Z\d+])(?:\+33(?:[ .-]?\(0\))?[ .-]?|0)[1-9](?:[ .-]?\d{2}){4}(?![a-zA-Z\d])/gu;
const reservedDomains = new Set([
  'example.com',
  'example.net',
  'example.org',
  'localhost',
]);
const reservedSuffixes = ['.example', '.invalid', '.localhost', '.test'];
const findings = new Map();

function git(args, encoding = 'utf8') {
  const result = spawnSync('git', args, {
    encoding,
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    throw new Error(`commande Git refusée (${args[0] ?? 'inconnue'})`);
  }

  return result.stdout;
}

function gitStatus(args) {
  return spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).status;
}

function opaqueTarget(pathname) {
  return createHash('sha256').update(pathname).digest('hex').slice(0, 12);
}

function report(scope, pathname, reason) {
  const target = opaqueTarget(pathname);
  findings.set(`${scope}\0${target}\0${reason}`, { reason, scope, target });
}

function normalizePath(pathname) {
  return pathname.replaceAll('\\', '/').replace(/^\.\//u, '');
}

function inspectPath(scope, pathname) {
  const normalized = normalizePath(pathname);
  const lower = normalized.toLocaleLowerCase('en-US');

  if (lower === 'corpus' || lower.startsWith('corpus/')) {
    report(scope, normalized, 'répertoire documentaire interdit');
  }

  if (
    sensitiveArtifactPattern.test(lower) ||
    compressedSqlPattern.test(lower)
  ) {
    report(scope, normalized, 'format documentaire ou archive interdit');
  }

  inspectText(scope, normalized, normalized);
}

function isReservedDomain(domain) {
  const normalized = domain.toLocaleLowerCase('en-US');

  return (
    reservedDomains.has(normalized) ||
    reservedSuffixes.some(
      (suffix) => normalized === suffix.slice(1) || normalized.endsWith(suffix),
    )
  );
}

function inspectText(scope, pathname, source) {
  emailPattern.lastIndex = 0;
  for (const match of source.matchAll(emailPattern)) {
    if (!isReservedDomain(match[1] ?? '')) {
      report(scope, pathname, 'adresse e-mail non réservée détectée');
      break;
    }
  }

  frenchPhonePattern.lastIndex = 0;
  if (frenchPhonePattern.test(source)) {
    report(scope, pathname, 'numéro de téléphone français détecté');
  }
}

function parseChangedPaths(buffer) {
  const fields = buffer.toString('utf8').split('\0');
  const changes = [];

  for (let index = 0; index < fields.length - 1;) {
    const status = fields[index++];
    if (!status) {
      continue;
    }

    const source = fields[index++];
    if (!source) {
      throw new Error('sortie Git name-status incomplète');
    }

    if (status.startsWith('R') || status.startsWith('C')) {
      const target = fields[index++];
      if (!target) {
        throw new Error('sortie Git rename/copy incomplète');
      }
      changes.push({ source, target });
    } else {
      changes.push({ source, target: source });
    }
  }

  return changes;
}

function inspectDiff(scope, from, to) {
  const revisions = to ? [from, to] : [from];
  const changes = parseChangedPaths(
    git(
      [
        'diff',
        '--no-ext-diff',
        '--name-status',
        '-z',
        '--diff-filter=ACMR',
        ...revisions,
        '--',
      ],
      null,
    ),
  );

  for (const { source, target } of changes) {
    inspectPath(scope, source);
    if (target !== source) {
      inspectPath(scope, target);
    }

    const patch = git([
      'diff',
      '--no-ext-diff',
      '--no-color',
      '--unified=0',
      '--diff-filter=ACMR',
      ...revisions,
      '--',
      target,
    ]);
    const additions = patch
      .split('\n')
      .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
      .map((line) => line.slice(1))
      .join('\n');

    inspectText(scope, target, additions);
  }
}

function inspectUntrackedFiles() {
  const paths = git(['ls-files', '--others', '--exclude-standard', '-z'], null)
    .toString('utf8')
    .split('\0')
    .filter(Boolean);

  for (const pathname of paths) {
    inspectPath('worktree', pathname);

    const size = statSync(pathname).size;
    if (size > maximumScannedFileBytes) {
      report(
        'worktree',
        pathname,
        'nouveau fichier trop volumineux pour la revue',
      );
      continue;
    }

    const content = readFileSync(pathname);
    if (!content.includes(0)) {
      inspectText('worktree', pathname, content.toString('utf8'));
    }
  }
}

function readBaseline() {
  const entries = readFileSync(baselinePath, 'utf8')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));

  if (entries.length !== 1 || !/^[a-f0-9]{40}$/u.test(entries[0] ?? '')) {
    throw new Error('baseline de confidentialité invalide');
  }

  return entries[0];
}

function main() {
  const baseline = readBaseline();

  if (gitStatus(['cat-file', '-e', `${baseline}^{commit}`]) !== 0) {
    throw new Error('commit baseline absent ; historique incomplet ou réécrit');
  }
  if (gitStatus(['merge-base', '--is-ancestor', baseline, 'HEAD']) !== 0) {
    throw new Error('le baseline n’est pas un ancêtre de HEAD');
  }

  const commits = git([
    'rev-list',
    '--reverse',
    '--topo-order',
    `${baseline}..HEAD`,
  ])
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const commit of commits) {
    const ancestry = git(['rev-list', '--parents', '-n', '1', commit])
      .trim()
      .split(/\s+/u);
    inspectDiff(
      `commit ${commit.slice(0, 12)}`,
      ancestry[1] ?? emptyTree,
      commit,
    );
  }

  inspectDiff('worktree', 'HEAD');
  inspectUntrackedFiles();

  if (findings.size > 0) {
    console.error(
      'Barrière de confidentialité refusée. Les valeurs et chemins restent masqués :',
    );
    for (const { reason, scope, target } of findings.values()) {
      console.error(`- ${scope}, cible ${target} : ${reason}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `Barrière de confidentialité validée depuis ${baseline.slice(0, 12)}.`,
  );
}

try {
  main();
} catch (error) {
  console.error(
    `Barrière de confidentialité impossible à prouver : ${error instanceof Error ? error.message : 'erreur inconnue'}`,
  );
  process.exitCode = 1;
}
