import { expect, type Page, test } from '@playwright/test';

// Ces valeurs appartiennent uniquement au serveur simulé local. Elles ne sont
// reconnues par aucun Supabase et le domaine .invalid ne peut recevoir de mail.
const mockEmail = 'e2e.operator@example.invalid';
const mockPassword = 'playwright-only-not-a-secret';

async function loginWithMockAccount(page: Page) {
  await page.goto('/login');
  await page.getByLabel('E-mail professionnel').fill(mockEmail);
  await page.getByLabel('Mot de passe').fill(mockPassword);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/tools\/planning(?:\?.*)?$/);
  await expect(
    page.getByRole('heading', { name: 'Planning opérationnel' }),
  ).toBeAttached();
}

test('connexion simulée, dashboard puis déconnexion fonctionnent de bout en bout', async ({
  page,
}) => {
  await loginWithMockAccount(page);

  const desktopNavigation = page.getByRole('navigation', {
    name: 'Navigation principale',
  });
  await expect(desktopNavigation).toBeVisible();
  await expect(
    desktopNavigation.getByRole('link', { name: 'Planning' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    desktopNavigation.getByRole('link', { name: 'Collaborateurs' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();

  await page.goto('/tools/planning');
  await expect(page).toHaveURL(/\/login$/);
});

test('le dashboard et ses menus restent accessibles à 390 et 320 px', async ({
  page,
}) => {
  await loginWithMockAccount(page);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/tools/planning');

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);

    const mobileNavigation = page.getByRole('navigation', {
      name: 'Navigation mobile',
    });
    await expect(mobileNavigation).toBeVisible();
    await expect(
      mobileNavigation.getByRole('link', { name: 'Planning' }),
    ).toHaveAttribute('aria-current', 'page');
    await expect(
      page.getByRole('navigation', { name: 'Navigation principale' }),
    ).toBeHidden();

    const actions = page.getByText('Actions', { exact: true });
    await actions.focus();
    await expect(actions).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(actions.locator('..')).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
  }
});
