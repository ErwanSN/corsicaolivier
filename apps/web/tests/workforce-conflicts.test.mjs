import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('les incompatibilités RH restent une alerte progressive et compacte', async () => {
  const page = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const styles = await readFile(
    'src/app/tools/planning/planning-page.module.css',
    'utf8',
  );

  assert.match(page, /planning-workforce-conflicts\?/);
  assert.match(page, /<details className=\{styles\.workforceConflictNotice\}/);
  assert.match(page, /Une contrainte RH à corriger/);
  assert.match(page, /workforceConflicts\.slice\(0, 5\)/);
  assert.match(page, /workforceConflictTotal/);
  assert.match(page, /workforceConflicts\.slice\(5\)/);
  assert.match(page, /className=\{styles\.workforceConflictMore\}/);
  assert.match(page, /Afficher la copie de travail/);
  assert.match(
    page,
    /version\.status === 'draft' \|\|\s*version\.status === 'validated'/,
  );
  assert.match(page, /Revérifier/);
  assert.match(styles, /\.workforceConflictNotice/);
  assert.doesNotMatch(page, /<nav[^>]*>[\s\S]{0,120}contrainte RH/i);
});

test('le brouillon et la résolution passent par les commandes API dédiées', async () => {
  const actions = await readFile('src/app/tools/planning/actions.ts', 'utf8');

  assert.match(actions, /export async function prepareWorkforceConflictDraft/);
  assert.match(
    actions,
    /planning-workforce-conflicts\/\$\{conflictId\}\/draft/,
  );
  assert.match(actions, /export async function resolveWorkforceConflict/);
  assert.match(
    actions,
    /planning-workforce-conflicts\/\$\{conflictId\}\/resolve/,
  );
  assert.match(actions, /Vérification manuelle après correction du planning/);
  assert.match(actions, /UUID_PATTERN\.test/);
});
