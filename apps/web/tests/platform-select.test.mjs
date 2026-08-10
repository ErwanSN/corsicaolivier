import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { sourceFiles } from './helpers/source-files.mjs';

test('tous les dropdowns utilisent le composant de la plateforme', async () => {
  const rawSelects = [];
  let platformSelectCount = 0;

  for await (const path of sourceFiles('src', ['.tsx'])) {
    const source = await readFile(path, 'utf8');
    const normalizedPath = path.replaceAll('\\', '/');

    if (!normalizedPath.endsWith('components/ui/platform-select.tsx')) {
      if (/<select\b/.test(source)) rawSelects.push(path);
      platformSelectCount += source.match(/<PlatformSelect\b/g)?.length ?? 0;
    }
  }

  assert.deepEqual(rawSelects, []);
  assert.ok(platformSelectCount > 0, 'aucun Dropdown de plateforme détecté');
});
