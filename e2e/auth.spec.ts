import { test, expect } from '@playwright/test';

const uniqueEmail = () =>
  `e2e-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
const PASSWORD = 'E2eSecurePass!42';

test.describe('Authentication', () => {
  test('login page rejects bad credentials with an error', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    await page.fill('#login-email', uniqueEmail());
    await page.fill('#login-password', 'wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('register, logout, then login roundtrip', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
    await page.fill('#register-email', email);
    await page.fill('#register-password', PASSWORD);
    await page.fill('#register-confirm', PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await page.waitForURL((url) => !url.pathname.includes('/register'));
    await expect(page.locator('.landing-header__user')).toHaveText(email);

    const sessionCookies = (await page.context().cookies()).map((c) => c.name);
    expect(sessionCookies).toContain('af_sid');
    expect(sessionCookies).toContain('af_rt');

    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
    await expect(page.locator('.landing-header__user')).toHaveCount(0);
    expect((await page.context().cookies()).map((c) => c.name)).not.toContain('af_sid');

    await page.getByRole('button', { name: 'Log in' }).click();
    await page.waitForURL('**/login');
    await page.fill('#login-email', email);
    await page.fill('#login-password', PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();

    await page.waitForURL((url) => !url.pathname.includes('/login'));
    await expect(page.locator('.landing-header__user')).toHaveText(email);
  });

  test('register validates password rules and confirmation', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#register-email', uniqueEmail());
    await page.fill('#register-password', 'short');
    await page.fill('#register-confirm', 'different');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('oauth error params surface friendly messages on /login', async ({ page }) => {
    await page.goto('/login?error=access_denied');
    await expect(page.getByRole('alert')).toHaveText(/cancelled/i);

    await page.goto('/login?error=invalid_state');
    await expect(page.getByRole('alert')).toHaveText(/expired/i);
  });

  test('invalid google exchange code bounces back to login', async ({ page }) => {
    await page.goto('/auth/callback?code=definitely-not-a-real-code');
    await page.waitForURL('**/login**');
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('google entry point redirects to Google with PKCE + state', async ({ request }) => {
    const res = await request.get('/api/v1/auth/google', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const location = res.headers()['location'] ?? '';
    expect(location).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(location).toContain('code_challenge=');
    expect(location).toContain('code_challenge_method=S256');
    expect(location).toContain('state=');
    expect(res.headers()['set-cookie'] ?? '').toContain('af_google_state');
  });

  test('logged-out visits fire no auth probes (no 401 noise)', async ({ page }) => {
    const probed: string[] = [];
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/auth/me') || url.includes('/auth/refresh')) {
        probed.push(url);
      }
    });

    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    expect(probed).toHaveLength(0);
  });
});
