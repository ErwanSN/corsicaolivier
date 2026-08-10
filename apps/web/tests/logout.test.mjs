import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la déconnexion nettoie la session et revient toujours à la connexion', async () => {
  const route = await readFile('src/app/logout/route.ts', 'utf8');

  assert.match(route, /export async function POST/);
  assert.match(route, /signOut\(\{ scope: 'global' \}\)/);
  assert.match(route, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(route, /status: 303/);
  assert.match(route, /Location: '\/login'/);
});

test('la déconnexion est disponible sur desktop et mobile avec un état d’attente', async () => {
  const shell = await readFile('src/components/app-shell.tsx', 'utf8');

  assert.equal(shell.match(/<form action="\/logout"/g)?.length, 2);
  assert.equal(shell.match(/method="post"/g)?.length, 2);
  assert.match(shell, /useFormStatus/);
  assert.match(shell, /Déconnexion…/);
  assert.match(shell, /<LogoutButton compact \/>/);
});
