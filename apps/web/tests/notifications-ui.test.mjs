import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('les notifications sont chargées non lues par défaut dans le shell', async () => {
  const layout = await readFile('src/app/tools/layout.tsx', 'utf8');
  const shell = await readFile('src/components/app-shell.tsx', 'utf8');

  assert.match(layout, /notifications\?pageSize=30&unreadOnly=true/);
  assert.match(layout, /notificationHasMore/);
  assert.match(layout, /notificationTotal/);
  assert.match(layout, /notificationLoadError/);
  assert.match(shell, /variant="desktop"/);
  assert.match(shell, /variant="mobile"/);
});

test('le panneau reste progressif, accessible et explicite dans tous ses états', async () => {
  const center = await readFile(
    'src/components/notification-center.tsx',
    'utf8',
  );

  assert.match(center, /<details/);
  assert.match(center, /<summary/);
  assert.match(center, /aria-controls=/);
  assert.match(center, /aria-label="Notifications non lues"/);
  assert.match(center, /Non lues uniquement/);
  assert.match(center, /plus récentes affichées sur/);
  assert.match(center, /Vous êtes à jour\./);
  assert.match(center, /role="alert"/);
  assert.match(center, /max-h-\[min\(70svh,32rem\)\]/);
});

test('chaque notification peut être acquittée sans exposer une mutation directe', async () => {
  const center = await readFile(
    'src/components/notification-center.tsx',
    'utf8',
  );
  const actions = await readFile(
    'src/app/tools/notification-actions.ts',
    'utf8',
  );

  assert.match(center, /useActionState/);
  assert.match(center, /name="notificationId"/);
  assert.match(center, /Marquer comme lue/);
  assert.match(actions, /\/notifications\/\$\{notificationId\}\/ack/);
  assert.match(actions, /method: 'POST'/);
  assert.match(actions, /UUID_PATTERN\.test/);
  assert.match(actions, /revalidatePath\('\/tools', 'layout'\)/);
});
