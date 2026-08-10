import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('la navigation principale reste limitée aux parcours utiles', async () => {
  const shell = await readFile('src/components/app-shell.tsx', 'utf8');
  const settings = await readFile(
    'src/app/tools/planning/referentiels/page.tsx',
    'utf8',
  );

  assert.match(shell, /<summary[^>]*>\s*Menu\s*<\/summary>/);
  assert.match(shell, /aria-label="Navigation principale"/);
  assert.doesNotMatch(shell, /data-app-shell-sidebar/);
  assert.doesNotMatch(shell, /data-app-shell-mobile-nav/);
  assert.doesNotMatch(shell, /mobileLabel/);
  assert.match(settings, /aria-label="Autres réglages"/);
  assert.match(settings, />\s*Zones\s*</);
  assert.match(settings, />\s*Groupes\s*</);
  assert.match(settings, />\s*Règles de besoins\s*</);
});

test('les commandes du planning tiennent dans une seule barre compacte', async () => {
  const page = await readFile('src/app/tools/planning/page.tsx', 'utf8');
  const styles = await readFile(
    'src/app/tools/planning/planning-page.module.css',
    'utf8',
  );

  assert.match(page, /<summary>Actions<\/summary>/);
  assert.match(page, /aria-label="Changer de site"/);
  assert.match(page, /isCurrentWeek \?/);
  assert.doesNotMatch(page, /styles\.zoneTabs/);
  assert.doesNotMatch(page, /styles\.toolbarActions/);
  assert.doesNotMatch(page, /styles\.publishMenu/);
  assert.match(styles, /min-height: 3\.1rem/);
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
