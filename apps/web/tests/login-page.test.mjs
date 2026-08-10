import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('la connexion utilise un seul logo et le fond Corsica Linea fourni', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');

  await access('public/brand/corsica-linea-background.webp');
  assert.match(source, /src="\/brand\/corsica-linea-background\.webp"/);
  assert.match(source, /Flotte Corsica Linea en mer/);
  assert.doesNotMatch(source, /CC BY-SA 4\.0/);
  assert.equal(source.match(/src="\/brand\/corsica-linea\.webp"/g)?.length, 1);
});

test('la page reste centrée sur la connexion', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');
  const form = await readFile('src/app/login/login-form.tsx', 'utf8');

  assert.match(source, />\s*Connexion\s*</);
  assert.match(form, /Se connecter/);
  assert.doesNotMatch(source, /Tools Panel/i);
  assert.doesNotMatch(source, /Tous vos outils métier/);
  assert.doesNotMatch(source, /\.env\.example/);
});
