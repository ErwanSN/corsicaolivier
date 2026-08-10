import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la navigation principale reste limitée aux parcours utiles', async () => {
  const shell = await readFile('src/components/app-shell.tsx', 'utf8');
  const settings = await readFile(
    'src/app/tools/planning/referentiels/page.tsx',
    'utf8',
  );

  assert.match(shell, /grid-cols-4/);
  assert.doesNotMatch(shell, /grid-cols-5/);
  assert.match(shell, /mobileLabel: 'Équipe'/);
  assert.match(shell, /mobileLabel: 'Réglages'/);
  assert.match(settings, /aria-label="Autres réglages"/);
  assert.match(settings, />\s*Zones\s*</);
  assert.match(settings, />\s*Groupes\s*</);
  assert.match(settings, />\s*Règles de besoins\s*</);
});

test('la grille conserve huit lignes et les remplace avec les postes saisis', async () => {
  const grid = await readFile('src/components/weekly-planning-grid.tsx', 'utf8');
  const styles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );

  assert.match(grid, /MIN_VISIBLE_POSITION_ROWS = 8/);
  assert.match(
    grid,
    /MIN_VISIBLE_POSITION_ROWS - data\.positions\.length/,
  );
  assert.match(grid, /data-empty-planning-row/);
  assert.match(styles, /min-height: 4\.25rem/);
});

test('la grille tient sur desktop et montre plusieurs jours sur mobile', async () => {
  const styles = await readFile(
    'src/components/weekly-planning-grid.module.css',
    'utf8',
  );

  assert.match(
    styles,
    /grid-template-columns: minmax\(8rem, 11rem\) repeat\(7, minmax\(7\.25rem, 1fr\)\)/,
  );
  assert.match(styles, /min-width: 64rem/);
  assert.match(styles, /@media \(max-width: 767px\)/);
  assert.match(styles, /grid-template-columns: 7\.25rem repeat\(7, 7\.25rem\)/);
  assert.match(styles, /min-width: 58rem/);
});
