// Prompt library: search, filters, tools, guardrails, secret scanner and copy behaviour.
const { test, expect } = require('@playwright/test');

const PROFILE_TOOLS = ['Playwright', 'Selenium', 'TestNG', 'Cucumber', 'REST Assured', 'Postman', 'Bruno', 'JMeter', 'SoapUI', 'SonarQube', 'Snyk', 'Trivy', 'Docker', 'GitLab CI', 'axe-core', 'Chrome DevTools', 'Git', 'Jira', 'Zephyr'];

// Built at run time so no real-looking secret ever sits in the repository.
const fake = {
  github: () => 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'.slice(0, 36),
  aws: () => 'AKIA' + 'ABCDEFGH12345678',
  password: () => 'pass' + 'word=hunter2pass'
};

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/prompts.html');
});

const count = page => page.locator('.card').count();

test.describe('library', () => {
  test('lists the prompts with consistent counts', async ({ page }) => {
    const total = await count(page);
    expect(total).toBeGreaterThanOrEqual(80);
    await expect(page.locator('#count')).toHaveText(new RegExp(`^${total} of ${total} prompts`));
    const modes = await page.locator('#modes .chip').allTextContents();
    const agent = +modes.find(m => m.startsWith('Agent')).match(/\((\d+)\)/)[1], analysis = +modes.find(m => m.startsWith('Analysis')).match(/\((\d+)\)/)[1];
    expect(agent + analysis).toBe(total);
  });

  test('every prompt has a title, a mode badge, a category and filled-in placeholders markup', async ({ page }) => {
    const cards = page.locator('.card');
    const n = await cards.count();
    for (let i = 0; i < n; i++) {
      const c = cards.nth(i);
      await expect(c.locator('h2')).not.toBeEmpty();
      await expect(c.locator('.badge')).toHaveText(/Agent|Analysis/);
      await expect(c.locator('.cat')).not.toBeEmpty();
    }
  });

  test('analysis prompts never ask the assistant to change code', async ({ page }) => {
    await page.locator('#modes .chip', { hasText: 'Analysis' }).click();
    const texts = await page.locator('.card pre').allTextContents();
    expect(texts.length).toBeGreaterThan(10);
    for (const t of texts) expect(t).toMatch(/do not (change|edit)|read-only|not apply|reply in chat/i);
  });

  test('the tool filter only offers tools that belong to the profile', async ({ page }) => {
    const options = (await page.locator('#tool option').allTextContents()).map(o => o.replace(/\s*\(\d+\)$/, '')).filter(o => o !== 'All tools');
    expect(options.filter(o => !PROFILE_TOOLS.includes(o))).toEqual([]);
    expect(options).toContain('Playwright');
    expect(options).toContain('JMeter');
    expect(options).toContain('Postman');
  });

  test('has a substantial accessibility category', async ({ page }) => {
    await page.locator('#chips .chip', { hasText: /^Accessibility/ }).click();
    expect(await count(page)).toBeGreaterThanOrEqual(12);
  });
});

test.describe('search and filters', () => {
  test('search narrows results, highlights matches and supports several words', async ({ page }) => {
    await page.locator('#q').fill('flaky');
    expect(await count(page)).toBeGreaterThan(0);
    await expect(page.locator('mark').first()).toBeVisible();
    await page.locator('#q').fill('jmeter load');
    await expect(page.locator('.card h2').first()).toContainText(/JMeter/i);
    await page.locator('#q').fill('zzzzqq');
    await expect(page.getByText('No prompts match your search.')).toBeVisible();
    await page.getByRole('link', { name: /clear search/i }).click();
    expect(await count(page)).toBeGreaterThanOrEqual(80);
  });

  test('category, mode and tool filters combine and are shareable through the URL', async ({ page }) => {
    await page.goto('/prompts.html?cat=Accessibility&mode=agent&tool=Playwright');
    const titles = await page.locator('.card h2').allTextContents();
    expect(titles.length).toBeGreaterThan(0);
    await expect(page.locator('#count')).toContainText('Accessibility');
    await expect(page.locator('#tool')).toHaveValue('Playwright');
    for (const b of await page.locator('.badge').allTextContents()) expect(b).toContain('Agent');
  });

  test('search is case-insensitive and also matches tool names', async ({ page }) => {
    await page.locator('#q').fill('PLAYWRIGHT');
    expect(await count(page)).toBeGreaterThanOrEqual(8);
  });

  test('the "/" shortcut focuses the search box and Escape clears it', async ({ page }) => {
    await page.keyboard.press('/');
    await expect(page.locator('#q')).toBeFocused();
    await page.keyboard.type('boundary');
    expect(await count(page)).toBeLessThan(20);
    await page.keyboard.press('Escape');
    await expect(page.locator('#q')).toHaveValue('');
  });
});

test.describe('guardrails and secret scanner', () => {
  test('copying adds the guardrails block by default and can be turned off', async ({ page }) => {
    await page.locator('.card').first().getByRole('button', { name: 'Copy prompt' }).click();
    let clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/Guardrails/);
    expect(clip).toMatch(/secrets and personal data/i);
    expect(clip).toMatch(/revoked? or rotated?/i);
    await page.locator('#guard').uncheck();
    await page.locator('.card').first().getByRole('button', { name: 'Copy prompt' }).click();
    clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).not.toMatch(/Guardrails/);
  });

  test('agent and analysis prompts get different guardrails', async ({ page }) => {
    await page.locator('#modes .chip', { hasText: 'Analysis' }).click();
    await page.locator('.card').first().getByRole('button', { name: 'Copy prompt' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/Read-only: do not change/);
    await page.locator('#modes .chip', { hasText: 'Agent' }).click();
    await page.locator('.card').first().getByRole('button', { name: 'Copy prompt' }).click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/force push/);
    expect(clip).toMatch(/new branch/);
  });

  test('the guardrail preference is remembered', async ({ page }) => {
    await page.locator('#guard').uncheck();
    await page.reload();
    await expect(page.locator('#guard')).not.toBeChecked();
  });

  for (const [name, make] of Object.entries(fake)) {
    test(`a ${name} typed into a field blocks copying and asks the user to rotate it`, async ({ page }) => {
      const card = page.locator('.card').first();
      await card.getByRole('button', { name: 'Fill in values' }).click();
      await card.locator('.fill input').first().fill(make());
      await expect(card.locator('.alert').first()).toContainText(/revoke or rotate/i);
      const copy = card.locator('.copy');
      await expect(copy).toBeDisabled();
      await expect(copy).toHaveText(/Remove the sensitive value/);
      await card.locator('.fill input').first().fill('$API_TOKEN');       // an environment reference is fine
      await expect(copy).toBeEnabled();
      await expect(card.locator('.alert')).toHaveCount(0);
    });
  }

  test('the clipboard never receives the secret and filled values are substituted', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.getByRole('button', { name: 'Fill in values' }).click();
    const inputs = card.locator('.fill input');
    await inputs.nth(0).fill('orders.openapi.yaml');
    await inputs.nth(1).fill(fake.github());
    await card.locator('.copy').click({ force: true });               // disabled: nothing should be copied
    await inputs.nth(1).fill('$GITHUB_TOKEN');
    await card.locator('.copy').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('orders.openapi.yaml');
    expect(clip).toContain('$GITHUB_TOKEN');
    expect(clip).not.toMatch(/ghp_/);
  });

  test('a secret pasted into the search box is not used, shown in the URL or stored', async ({ page }) => {
    await page.locator('#q').fill(fake.aws());
    await expect(page.locator('#qalert')).toContainText(/revoke or rotate/i);
    expect(page.url()).not.toContain('AKIA');
    expect(await count(page)).toBeGreaterThanOrEqual(80);                // not used as a filter
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + document.cookie);
    expect(stored).not.toContain('AKIA');
    await page.locator('#q').fill('');
    await expect(page.locator('#qalert')).toBeHidden();
  });

  test('placeholders, environment references, hashes and the public test card are not flagged', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.getByRole('button', { name: 'Fill in values' }).click();
    const input = card.locator('.fill input').first();
    for (const ok of ['$API_TOKEN', 'token = process.env.API_TOKEN', '0123456789abcdef0123456789abcdef01234567', '550e8400-e29b-41d4-a716-446655440000', '4242 4242 4242 4242', 'tests/e2e/checkout.spec.ts', 'http://localhost:3000']) {
      await input.fill(ok);
      await expect(card.locator('.alert'), ok).toHaveCount(0);
    }
  });

  test('personal data and production URLs get an advisory warning but do not block copying', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.getByRole('button', { name: 'Fill in values' }).click();
    const input = card.locator('.fill input').first();
    await input.fill('jane.doe@acme.com');
    await expect(card.locator('.alert.soft')).toContainText(/email/i);
    await expect(card.locator('.copy')).toBeEnabled();
    await input.fill('https://shop.acme.com/production/api');
    await expect(card.locator('.alert.soft')).toContainText(/production/i);
    await expect(card.locator('.copy')).toBeEnabled();
  });

  test('typed text is never rendered as HTML', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.getByRole('button', { name: 'Fill in values' }).click();
    await card.locator('.fill input').first().fill('<img src=x onerror=window.__pwned=1>');
    expect(await page.evaluate(() => window.__pwned)).toBeUndefined();
    await expect(card.locator('pre img')).toHaveCount(0);
  });
});

test.describe('keyboard use', () => {
  test('chips are toggle buttons that work with Enter and report their state', async ({ page }) => {
    const chip = page.locator('#chips .chip', { hasText: /^Security/ });
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#chips .chip', { hasText: /^Security/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#count')).toContainText('Security');
  });

  test('a prompt can be filled in and copied using only the keyboard', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.getByRole('button', { name: 'Fill in values' }).focus();
    await page.keyboard.press('Enter');
    await expect(card.locator('.fill input').first()).toBeVisible();
    await card.locator('.fill input').first().focus();
    await page.keyboard.type('docs/spec.md');
    await card.getByRole('button', { name: 'Copy prompt' }).focus();
    await page.keyboard.press('Enter');
    await expect(card.getByRole('button', { name: 'Copied!' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('docs/spec.md');
  });
});
