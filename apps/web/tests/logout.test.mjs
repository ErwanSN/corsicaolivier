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

test('l’authentification SSR utilise le réseau privé avec un délai borné', async () => {
  const config = await readFile('src/lib/supabase/config.ts', 'utf8');
  const server = await readFile('src/lib/supabase/server.ts', 'utf8');
  const proxy = await readFile('src/proxy.ts', 'utf8');

  assert.match(config, /process\.env\.SUPABASE_SERVER_URL/);
  assert.match(config, /AbortSignal\.timeout/);
  assert.match(config, /supabaseAuthCookieOptions/);
  assert.match(config, /hardenedSupabaseCookieOptions/);
  assert.match(config, /httpOnly: true/);
  assert.match(config, /sameSite: 'lax'/);
  assert.match(config, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(config, /path: '\/'/);
  assert.match(config, /SUPABASE_AUTH_COOKIE_MAX_AGE_SECONDS/);
  assert.match(server, /getServerSupabaseConfig/);
  assert.match(server, /cookieOptions: supabaseAuthCookieOptions\(\)/);
  assert.match(server, /hardenedSupabaseCookieOptions\(options\)/);
  assert.match(server, /supabaseFetchWithTimeout/);
  assert.match(proxy, /getServerSupabaseConfig/);
  assert.match(proxy, /cookieOptions: supabaseAuthCookieOptions\(\)/);
  assert.match(proxy, /hardenedSupabaseCookieOptions\(options\)/);
  assert.match(proxy, /supabaseFetchWithTimeout/);
});
