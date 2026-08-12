import { expect, test } from '@playwright/test';

test('le healthcheck web vérifie réellement son API interne', async ({
  request,
}) => {
  const response = await request.get('/health');

  expect(response.status()).toBe(200);
  expect(response.headers()['cache-control']).toContain('no-store');
  await expect(response.json()).resolves.toEqual({ status: 'ok' });
});

test('une route protégée redirige vers la connexion', async ({ page }) => {
  await page.goto('/tools/planning');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
});

test('la connexion reste sans débordement sur desktop et mobiles', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/login');

    await expect(
      page.getByRole('heading', { name: 'Connexion' }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test('les visuels WebP optimisés sont chargés avec leurs dimensions naturelles', async ({
  page,
  request,
}) => {
  await page.goto('/login');

  const images = [
    page.getByAltText('Flotte Corsica Linea en mer'),
    page.getByAltText('Tête corse Corsica Linea'),
  ];

  for (const image of images) {
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => ({
          complete: element.complete,
          height: element.naturalHeight,
          src: decodeURIComponent(element.currentSrc),
          width: element.naturalWidth,
        })),
      )
      .toMatchObject({ complete: true });

    const metadata = await image.evaluate((element: HTMLImageElement) => ({
      height: element.naturalHeight,
      src: decodeURIComponent(element.currentSrc),
      width: element.naturalWidth,
    }));
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
    expect(metadata.src).toContain('.webp');

    const asset = await request.get(metadata.src, {
      headers: { Accept: 'image/webp,image/*' },
    });
    expect(asset.ok()).toBe(true);
    expect(asset.headers()['content-type']).toContain('image/webp');
  }
});

test('le formulaire est libellé et utilisable entièrement au clavier', async ({
  page,
}) => {
  await page.goto('/login');

  const email = page.getByLabel('E-mail professionnel');
  const password = page.getByLabel('Mot de passe');
  const submit = page.getByRole('button', { name: 'Se connecter' });

  await expect(email).toHaveAttribute('autocomplete', 'email');
  await expect(password).toHaveAttribute('autocomplete', 'current-password');
  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(password).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(submit).toBeFocused();
});

test('un échec de connexion retourne une erreur accessible et neutre', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('E-mail professionnel').fill('inconnu@example.invalid');
  await page.getByLabel('Mot de passe').fill('identifiant-invalide');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  const alert = page.locator('#login-error');
  await expect(alert).toHaveAttribute('role', 'alert');
  await expect(alert).toHaveText('E-mail ou mot de passe incorrect.');
  await expect(page).toHaveURL(/\/login$/);
});
