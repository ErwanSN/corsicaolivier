import { expect, type Page, test } from '@playwright/test';

const mfaPassword = 'playwright-mfa-only';
const validCode = '123456';

async function passwordLogin(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail professionnel').fill(email);
  await page.getByLabel('Mot de passe').fill(mfaPassword);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/mfa$/);
}

test('aal1 impose le challenge TOTP, refuse un faux code puis établit aal2', async ({
  context,
  page,
}) => {
  await passwordLogin(page, 'e2e.mfa.challenge@example.invalid');
  await expect(
    page.getByRole('heading', { name: 'Vérification en deux étapes' }),
  ).toBeVisible();

  const code = page.getByLabel('Code à 6 chiffres');
  await code.fill('000000');
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page.locator('#mfa-error')).toHaveText(
    'Code incorrect ou expiré.',
  );
  await expect(page).toHaveURL(/\/mfa$/);

  await code.fill(validCode);
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page).toHaveURL(/\/tools\/planning(?:\?.*)?$/);

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
  expect(
    (await context.cookies()).filter((cookie) =>
      cookie.name.startsWith('sb-corsica-auth-token'),
    ),
  ).toHaveLength(0);
});

test('un compte sans facteur peut enrôler TOTP puis vérifier le code', async ({
  page,
}) => {
  await passwordLogin(page, 'e2e.mfa.enroll@example.invalid');

  await page.getByRole('button', { name: 'Configurer maintenant' }).click();
  await expect(page.getByAltText('QR code d’enrôlement TOTP')).toBeVisible();
  await page.getByLabel('Code à 6 chiffres').fill(validCode);
  await page.getByRole('button', { name: 'Vérifier' }).click();

  await expect(page).toHaveURL(/\/tools\/planning(?:\?.*)?$/);
});
