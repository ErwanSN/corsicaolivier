import { randomBytes, createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { appendFile, lstat, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BASE32_PATTERN = /^[A-Z2-7]+=*$/;
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const supabaseBinary = resolve(repositoryRoot, 'node_modules/.bin/supabase');
const sensitiveValues = new Set();

function fail(message) {
  throw new Error(message);
}

function requireGithubActions() {
  if (process.env.CI !== 'true' || process.env.GITHUB_ACTIONS !== 'true') {
    fail('Ce provisionneur est réservé à GitHub Actions.');
  }
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`Variable CI obligatoire absente : ${name}.`);
  return value;
}

function stateFilePath() {
  const runnerTemp = resolve(requiredEnvironment('RUNNER_TEMP'));
  const statePathValue = requiredEnvironment('E2E_AUTH_STATE_FILE');
  if (!isAbsolute(statePathValue)) {
    fail('E2E_AUTH_STATE_FILE doit être un chemin absolu.');
  }

  const statePath = resolve(statePathValue);
  const relativePath = relative(runnerTemp, statePath);
  if (
    !relativePath ||
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath)
  ) {
    fail('E2E_AUTH_STATE_FILE doit être un fichier dédié sous RUNNER_TEMP.');
  }

  return statePath;
}

function childEnvironment() {
  const environment = { ...process.env };
  for (const name of [
    'E2E_AUTH_RATE_LIMIT_SECRET',
    'E2E_LOGIN_EMAIL',
    'E2E_LOGIN_PASSWORD',
    'E2E_LOGIN_TOTP_SECRET',
    'SECRET_KEY',
    'SERVICE_ROLE_KEY',
    'SUPABASE_SECRET_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]) {
    delete environment[name];
  }
  return environment;
}

function parseStatusEnvironment(source) {
  const values = new Map();

  for (const line of source.split(/\r?\n/u)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const name = line.slice(0, separator);
    const rawValue = line.slice(separator + 1);
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name)) continue;

    let value = rawValue;
    if (rawValue.startsWith('"')) {
      try {
        value = JSON.parse(rawValue);
      } catch {
        fail('La sortie de `supabase status` est invalide.');
      }
    }
    if (typeof value !== 'string' || /[\r\n]/u.test(value)) {
      fail('La sortie de `supabase status` contient une valeur invalide.');
    }
    values.set(name, value);
  }

  return values;
}

function localSupabaseConfiguration() {
  const status = spawnSync(supabaseBinary, ['status', '--output', 'env'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: childEnvironment(),
    maxBuffer: 1024 * 1024,
  });
  if (status.error || status.status !== 0) {
    fail('Supabase local n’est pas disponible pour le parcours Auth réel.');
  }

  const values = parseStatusEnvironment(status.stdout);
  const apiURL = values.get('API_URL');
  const publishableKey = values.get('PUBLISHABLE_KEY');
  const secretKey = values.get('SECRET_KEY');
  if (!apiURL || !publishableKey || !secretKey) {
    fail('Supabase local n’a pas fourni ses clés CI attendues.');
  }

  const parsedURL = new URL(apiURL);
  if (
    parsedURL.protocol !== 'http:' ||
    !LOCAL_HOSTS.has(parsedURL.hostname) ||
    parsedURL.username ||
    parsedURL.password ||
    parsedURL.pathname !== '/' ||
    parsedURL.search ||
    parsedURL.hash
  ) {
    fail('Le provisionneur refuse toute cible Supabase non locale.');
  }
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/u.test(publishableKey)) {
    fail('La clé publiable locale est invalide.');
  }
  if (!/^sb_secret_[A-Za-z0-9_-]{20,}$/u.test(secretKey)) {
    fail('La clé d’administration locale est invalide.');
  }

  sensitiveValues.add(secretKey);
  mask(secretKey);
  return { apiURL: parsedURL.toString(), publishableKey, secretKey };
}

function mask(value) {
  if (!value || /[\r\n]/u.test(value)) fail('Valeur de masquage CI invalide.');
  sensitiveValues.add(value);
  process.stdout.write(`::add-mask::${value}\n`);
}

function redact(value) {
  let safeValue = value;
  for (const sensitiveValue of sensitiveValues) {
    safeValue = safeValue.replaceAll(sensitiveValue, '***');
  }
  return safeValue;
}

function authError(operation, error) {
  const code =
    typeof error?.code === 'string'
      ? error.code.replace(/[^A-Za-z0-9_-]/gu, '').slice(0, 40)
      : 'unknown';
  const status = Number.isInteger(error?.status)
    ? String(error.status)
    : 'none';
  return new Error(`${operation} a échoué (code=${code}, status=${status}).`);
}

function client(apiURL, key) {
  return createClient(apiURL, key, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: {
      fetch: (input, init) => {
        const timeout = AbortSignal.timeout(10_000);
        const signal = init?.signal
          ? AbortSignal.any([init.signal, timeout])
          : timeout;
        return fetch(input, { ...init, signal });
      },
    },
  });
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/u, '');
  let bits = '';

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) fail('Le facteur TOTP local a renvoyé un secret invalide.');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret) {
  const counter = BigInt(Math.floor(Date.now() / 30_000));
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', decodeBase32(secret))
    .update(counterBytes)
    .digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

async function stableTotp(secret) {
  const remainingMilliseconds = 30_000 - (Date.now() % 30_000);
  if (remainingMilliseconds < 5_000) {
    await new Promise((resolvePromise) =>
      setTimeout(resolvePromise, remainingMilliseconds + 250),
    );
  }
  return currentTotp(secret);
}

async function writeState(path, state) {
  await writeFile(path, `${JSON.stringify(state)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  });
}

async function readState(path) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) {
    fail('Le fichier d’état Auth CI n’est pas un fichier privé régulier.');
  }

  const parsed = JSON.parse(await readFile(path, 'utf8'));
  if (
    parsed?.version !== 1 ||
    typeof parsed.apiURL !== 'string' ||
    !UUID_PATTERN.test(parsed.userId)
  ) {
    fail('Le fichier d’état Auth CI est invalide.');
  }
  return parsed;
}

async function appendGithubEnvironment(values) {
  const githubEnvironment = requiredEnvironment('GITHUB_ENV');
  if (!isAbsolute(githubEnvironment)) {
    fail('GITHUB_ENV doit être un chemin absolu.');
  }

  const lines = [];
  for (const [name, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/u.test(name) || /[\r\n]/u.test(value)) {
      fail('Variable de parcours Auth CI invalide.');
    }
    lines.push(`${name}=${value}`);
  }
  await appendFile(githubEnvironment, `${lines.join('\n')}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

async function deleteEphemeralUser(adminClient, userId) {
  const deletion = await adminClient.auth.admin.deleteUser(userId, false);
  if (deletion.error && deletion.error.status !== 404) {
    throw authError('La suppression du compte Auth CI', deletion.error);
  }
}

async function provision() {
  const statePath = stateFilePath();
  const { apiURL, publishableKey, secretKey } = localSupabaseConfiguration();
  const adminClient = client(apiURL, secretKey);
  const runIdentifier = (process.env.GITHUB_RUN_ID ?? 'local').replace(
    /[^0-9A-Za-z-]/gu,
    '',
  );
  const email = `corsica-e2e-${runIdentifier}-${randomBytes(8).toString('hex')}@example.invalid`;
  const password = `Ci-E2E-${randomBytes(24).toString('base64url')}-9a`;
  const authRateLimitSecret = randomBytes(32).toString('base64url');
  let userId;

  mask(email);
  mask(password);
  mask(authRateLimitSecret);

  try {
    const creation = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: 'Compte éphémère CI' },
    });
    if (creation.error)
      throw authError('La création du compte Auth CI', creation.error);
    userId = creation.data.user?.id;
    if (!userId || !UUID_PATTERN.test(userId)) {
      fail('La création du compte Auth CI n’a pas renvoyé un UUID valide.');
    }
    await writeState(statePath, { apiURL, userId, version: 1 });

    const userClient = client(apiURL, publishableKey);
    const signIn = await userClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signIn.error)
      throw authError('La connexion du compte Auth CI', signIn.error);

    const enrollment = await userClient.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Corsica Linea CI',
    });
    if (enrollment.error) {
      throw authError('L’enrôlement TOTP CI', enrollment.error);
    }
    const factorId = enrollment.data.id;
    const totpSecret = enrollment.data.totp.secret;
    if (
      !UUID_PATTERN.test(factorId) ||
      !BASE32_PATTERN.test(totpSecret) ||
      totpSecret.length < 16
    ) {
      fail('L’enrôlement TOTP CI a renvoyé un facteur invalide.');
    }
    mask(totpSecret);

    const verification = await userClient.auth.mfa.challengeAndVerify({
      code: await stableTotp(totpSecret),
      factorId,
    });
    if (verification.error) {
      throw authError('La vérification initiale TOTP CI', verification.error);
    }
    const assurance =
      await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
    if (
      assurance.error ||
      assurance.data.currentLevel !== 'aal2' ||
      assurance.data.nextLevel !== 'aal2'
    ) {
      fail('Le compte Auth CI n’a pas atteint le niveau AAL2.');
    }
    await userClient.auth.signOut({ scope: 'local' });

    await appendGithubEnvironment({
      E2E_AUTH_RATE_LIMIT_SECRET: authRateLimitSecret,
      E2E_LOGIN_EMAIL: email,
      E2E_LOGIN_PASSWORD: password,
      E2E_LOGIN_TOTP_SECRET: totpSecret,
      E2E_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      E2E_SUPABASE_URL: apiURL,
    });
    process.stdout.write(
      'Compte Auth/MFA local éphémère prêt pour Playwright.\n',
    );
  } catch (error) {
    if (userId) {
      try {
        await deleteEphemeralUser(adminClient, userId);
        await rm(statePath, { force: true });
      } catch {
        fail(
          'Le provisionnement Auth CI et son nettoyage immédiat ont échoué.',
        );
      }
    }
    throw error;
  }
}

async function cleanup() {
  const statePath = stateFilePath();
  let state;
  try {
    state = await readState(statePath);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      process.stdout.write('Aucun compte Auth CI à nettoyer.\n');
      return;
    }
    throw error;
  }

  const { apiURL, secretKey } = localSupabaseConfiguration();
  if (state.apiURL !== apiURL) {
    fail(
      'La cible Supabase locale a changé depuis le provisionnement Auth CI.',
    );
  }
  await deleteEphemeralUser(client(apiURL, secretKey), state.userId);
  await rm(statePath);
  process.stdout.write('Compte Auth/MFA local éphémère supprimé.\n');
}

async function main() {
  requireGithubActions();
  const command = process.argv[2];
  if (command === 'provision') return provision();
  if (command === 'cleanup') return cleanup();
  fail('Usage : ci-real-auth.mjs provision|cleanup');
}

void main().catch((error) => {
  const message = error instanceof Error ? error.message : 'erreur inconnue';
  process.stderr.write(`Erreur Auth CI : ${redact(message)}\n`);
  process.exitCode = 1;
});
