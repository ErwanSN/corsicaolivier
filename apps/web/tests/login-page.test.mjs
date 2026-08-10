import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('la connexion utilise un seul logo et le fond Corsica Linea fourni', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');
  const background = await readFile(
    'src/assets/brand/corsica-linea-background.webp',
  );

  await access('src/assets/brand/corsica-linea-head.webp');
  assert.equal(background.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(background.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.ok(background.byteLength < 700_000);
  assert.match(source, /import loginBackground from .*background\.webp/);
  assert.match(source, /src=\{loginBackground\}/);
  assert.match(source, /placeholder="blur"/);
  assert.match(source, /preload/);
  assert.match(source, /Flotte Corsica Linea en mer/);
  assert.doesNotMatch(source, /CC BY-SA 4\.0/);
  assert.doesNotMatch(source, /src="\/brand\/corsica-linea\.webp"/);
  assert.match(source, /import corsicaHead from .*corsica-linea-head\.webp/);
  assert.match(source, /src=\{corsicaHead\}/);
  assert.match(source, /sizes="80px"/);
  assert.match(source, /Tête corse Corsica Linea/);
  assert.ok(
    source.indexOf('src={corsicaHead}') > source.indexOf('</section>'),
    'la tête corse doit être placée dans le bloc de connexion',
  );
  assert.doesNotMatch(source, /priority/);
});

test('la page reste centrée sur la connexion', async () => {
  const source = await readFile('src/app/login/page.tsx', 'utf8');
  const form = await readFile('src/app/login/login-form.tsx', 'utf8');

  assert.match(source, />\s*Connexion\s*</);
  assert.match(form, /Se connecter/);
  assert.match(form, /placeholder="Votre mot de passe"/);
  assert.doesNotMatch(source, /Tools Panel/i);
  assert.doesNotMatch(source, /Tous vos outils métier/);
  assert.doesNotMatch(source, /\.env\.example/);
});
