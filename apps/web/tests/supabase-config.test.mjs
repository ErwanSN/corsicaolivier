import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const validator = await readFile(
  new URL('../src/lib/supabase/publishable-key.ts', import.meta.url),
  'utf8',
);
const config = await readFile(
  new URL('../src/lib/supabase/config.ts', import.meta.url),
  'utf8',
);
const nextConfig = await readFile(
  new URL('../next.config.ts', import.meta.url),
  'utf8',
);

test('la clé Supabase publique est validée au build et au runtime', () => {
  assert.match(nextConfig, /assertSafePublishableKey\(buildPublishableKey\)/);
  assert.match(config, /assertSafePublishableKey\(publishableKey\)/);
  assert.match(validator, /startsWith\('sb_secret_'\)/);
  assert.match(validator, /readJwtRole\(normalizedKey\) === 'service_role'/);
  assert.doesNotMatch(validator, /console\.|normalizedKey[^\n]*Error/);
});
