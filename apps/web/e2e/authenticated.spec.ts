import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} est obligatoire pour ce parcours.`);
  return value;
}

const email = requiredEnvironment('E2E_LOGIN_EMAIL');
const password = requiredEnvironment('E2E_LOGIN_PASSWORD');
const totpSecret = requiredEnvironment('E2E_LOGIN_TOTP_SECRET');

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/[^A-Z2-7]/gu, '');
  let bits = '';

  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Secret TOTP Base32 invalide.');
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }

  return Buffer.from(bytes);
}

function currentTotp(secret: string) {
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

async function stableTotp(secret: string): Promise<string> {
  const remainingMilliseconds = 30_000 - (Date.now() % 30_000);
  if (remainingMilliseconds < 5_000) {
    await new Promise((resolve) =>
      setTimeout(resolve, remainingMilliseconds + 250),
    );
  }

  return currentTotp(secret);
}

test.use({ trace: 'off' });

test('connexion puis déconnexion avec un compte de test éphémère', async ({
  context,
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('E-mail professionnel').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/mfa$/);
  await page.getByLabel('Code à 6 chiffres').fill(await stableTotp(totpSecret));
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page).toHaveURL(/\/tools(?:\/planning)?(?:\?.*)?$/);

  const authCookies = (await context.cookies()).filter((cookie) =>
    cookie.name.startsWith('sb-corsica-auth-token'),
  );
  expect(authCookies.length).toBeGreaterThan(0);
  for (const cookie of authCookies) {
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe('Lax');
    expect(cookie.secure).toBe(true);
  }

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
  expect(
    (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith('sb-corsica-auth-token'),
    ),
  ).toHaveLength(0);
});
