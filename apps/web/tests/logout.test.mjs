import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la déconnexion nettoie la session et revient toujours à la connexion', async () => {
  const actions = await readFile('src/app/login/actions.ts', 'utf8');

  assert.match(actions, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(actions, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(actions, /revalidatePath\('\/', 'layout'\)/);
  assert.match(actions, /redirect\('\/login'\)/);
});

test('la déconnexion reste disponible dans le menu avec un état d’attente', async () => {
  const shell = await readFile('src/components/app-shell.tsx', 'utf8');

  assert.equal(shell.match(/<form action=\{logout\}/g)?.length, 1);
  assert.match(shell, /useFormStatus/);
  assert.match(shell, /Déconnexion…/);
  assert.match(shell, /<summary[^>]*>\s*Menu\s*<\/summary>/);
  assert.match(shell, /<LogoutButton \/>/);
});
