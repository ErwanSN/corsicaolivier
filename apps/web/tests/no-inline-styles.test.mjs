import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { glob } from 'node:fs/promises';
import test from 'node:test';

test('la source React ne contient aucune prop style', async () => {
  for await (const path of glob('src/**/*.{tsx,jsx}')) {
    const source = await readFile(path, 'utf8');

    assert.doesNotMatch(
      source,
      /\bstyle\s*=/,
      `${path} contient un style inline`,
    );
  }
});

test('le système visuel impose des angles droits', async () => {
  const source = await readFile('src/app/globals.css', 'utf8');

  for (const radius of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl']) {
    assert.match(source, new RegExp(`--radius-${radius}: 0;`));
  }

  assert.match(source, /\.rounded,\s*\.rounded-full\s*{\s*border-radius: 0;/);
});
