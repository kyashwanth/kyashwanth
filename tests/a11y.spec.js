// Automated WCAG 2.2 A/AA checks with axe-core for every page, in light and dark mode, and for each state of every game.
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const { GAMES, SITE_PAGES } = require('./pages');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

// The mock "application under test" in the hunt games contains defects ON PURPOSE (that is the game), so it is excluded.
async function scan(page, { excludeApp = false } = {}) {
  let b = new AxeBuilder({ page }).withTags(TAGS);
  if (excludeApp) b = b.exclude('#app');
  const { violations } = await b.analyze();
  return violations.map(v => `${v.id} [${v.impact}] x${v.nodes.length}: ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
}

for (const scheme of ['light', 'dark']) {
  for (const p of SITE_PAGES) {
    test(`${p.name} has no axe violations (${scheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(p.path);
      expect(await scan(page)).toEqual([]);
    });
  }
}

for (const g of GAMES) {
  const hunt = g.kind === 'hunt';
  test(`${g.name}: start screen has no axe violations`, async ({ page }) => {
    await page.goto(`/games/${g.file}.html`);
    expect(await scan(page, { excludeApp: hunt })).toEqual([]);
  });
  test(`${g.name}: in play has no axe violations`, async ({ page }) => {
    await page.goto(`/games/${g.file}.html`);
    await page.locator('#go').click();
    expect(await scan(page, { excludeApp: hunt })).toEqual([]);
  });
  test(`${g.name}: end screen has no axe violations`, async ({ page }) => {
    await page.goto(`/games/${g.file}.html`);
    await page.locator('#go').click();
    await page.evaluate(() => QA.end('🏆', 'Test result', 'Finished for the test.', '<ul><li>Example</li></ul>', 10));
    expect(await scan(page, { excludeApp: hunt })).toEqual([]);
  });
}
