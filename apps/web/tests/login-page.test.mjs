import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('la connexion utilise un seul logo et une photo Corsica Linea créditée', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');

  await access('public/brand/corsica-linea-a-galeotta.webp');
  assert.match(source, /src="\/brand\/corsica-linea-a-galeotta\.webp"/);
  assert.match(source, /A Galeotta, navire Corsica Linea/);
  assert.match(source, /CC BY-SA 4\.0/);
  assert.equal(source.match(/src="\/brand\/corsica-linea\.webp"/g)?.length, 1);
});

test('la page reste centrée sur la connexion', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');
  const form = await readFile('src/app/login/login-form.tsx', 'utf8');

  assert.match(source, />\s*Connexion\s*</);
  assert.match(form, /Se connecter/);
  assert.doesNotMatch(source, /Tous vos outils métier/);
  assert.doesNotMatch(source, /\.env\.example/);
});
