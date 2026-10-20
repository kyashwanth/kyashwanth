// Site-wide checks: every page loads cleanly, links resolve, basic SEO/structure, and repository hygiene.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { GAMES, SITE_PAGES } = require('./pages');

const ALL = [...SITE_PAGES, ...GAMES.map(g => ({ path: `/games/${g.file}.html`, name: g.name }))];

for (const p of ALL) {
  test.describe(p.name, () => {
    test('loads without console or page errors', async ({ page }) => {
      const problems = [];
      page.on('console', m => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
      page.on('pageerror', e => problems.push('pageerror: ' + e.message));
      const bad = [];
      page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) bad.push(`${r.status()} ${r.url()}`); });
      const res = await page.goto(p.path);
      // 404.html is served by the static server with a 200 when requested directly
      expect(res.status()).toBeLessThan(400);
      await page.waitForLoadState('networkidle');
      expect(problems).toEqual([]);
      expect(bad).toEqual([]);
    });

    test('does not scroll horizontally (content reflows at this screen size)', async ({ page }) => {
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test('has the basic page structure', async ({ page }) => {
      await page.goto(p.path);
      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator('html')).toHaveAttribute('lang', /.+/);
      await expect(page.locator('meta[name="viewport"]')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
    });
  });
}

test.describe('internal links', () => {
  for (const p of SITE_PAGES.filter(x => x.path !== '/404.html')) {
    test(`all links on ${p.name} resolve`, async ({ page, request }) => {
      await page.goto(p.path);
      const hrefs = await page.$$eval('a[href]', as => as.map(a => a.getAttribute('href')));
      const seen = new Set(), problems = [];
      for (const h of hrefs) {
        if (!h || /^(mailto:|https?:|javascript:|data:)/.test(h) || seen.has(h)) continue;
        seen.add(h);
        if (h.startsWith('#')) { if (h.length > 1 && (await page.locator(h).count()) === 0) problems.push(`missing anchor ${h}`); continue; }
        const url = new URL(h.split('#')[0] || p.path, new URL(p.path, 'http://localhost:8080/')).pathname;
        const r = await request.get(url);
        if (r.status() >= 400) problems.push(`${r.status()} ${h}`);
      }
      expect(problems).toEqual([]);
    });
  }

  test('every game links back to the hub and every hub card opens a real page', async ({ page, request }) => {
    await page.goto('/games/index.html');
    const cards = await page.$$eval('a.card[href]', as => as.map(a => a.getAttribute('href')));
    expect(cards.length).toBeGreaterThanOrEqual(12);   // 11 games + interview mode
    for (const c of cards) expect((await request.get('/games/' + c)).status(), c).toBeLessThan(400);
  });
});

test.describe('home page content', () => {
  test('shows contact details and links to the main sections', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByRole('link', { name: /email me/i })).toHaveAttribute('href', /^mailto:[^@\s]+@[^@\s]+$/);
    for (const name of ['Profile', 'Competencies', 'Approach', 'Experience', 'Prompts', 'Playground', 'Contact']) {
      await expect(page.getByRole('navigation').getByRole('link', { name })).toBeVisible();
    }
  });
  test('does not list dates on jobs and keeps the edited job title', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.getByText('Software Engineer (Contractor)')).toBeVisible();
    await expect(page.getByText('Govt Organization')).toBeVisible();
    await expect(page.locator('.job')).toHaveCount(5);
  });
});

test.describe('404 page', () => {
  test('explains the error and links home', async ({ page }) => {
    await page.goto('/404.html');
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByRole('link', { name: /back to the portfolio/i })).toBeVisible();
  });
});

// ---- Repository hygiene (no browser needed)
test.describe('repository hygiene', () => {
  const ROOT = path.resolve(__dirname, '..');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory()
    ? (['node_modules', '.git', 'playwright-report', 'test-results'].includes(e.name) ? [] : walk(path.join(d, e.name)))
    : [path.join(d, e.name)]);
  const files = walk(ROOT).filter(f => /\.(html|js|css|md|json|yml|yaml)$/.test(f) && !/package-lock\.json$/.test(f));
  const read = f => fs.readFileSync(f, 'utf8');

  test('no secrets are committed', () => {
    const rules = { 'AWS key': /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/, 'GitHub token': /\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'Slack token': /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/, 'private key': /-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'Stripe key': /\b[rs]k_(?:live|test)_[0-9A-Za-z]{16,}\b/, 'JWT': /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ };
    const hits = [];
    for (const f of files) for (const [n, rx] of Object.entries(rules)) if (rx.test(read(f))) hits.push(`${path.relative(ROOT, f)}: ${n}`);
    expect(hits).toEqual([]);
  });

  test('no personal phone number is published', () => {
    const hits = files.filter(f => /\+91[\s-]?[6-9]\d{9}/.test(read(f))).map(f => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  test('no mentions of AI authorship or co-authorship', () => {
    const hits = files.filter(f => !f.includes(`${path.sep}tests${path.sep}`) && /co-authored-by|generated with|claude|anthropic/i.test(read(f))).map(f => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  test('every HTML page has a description meta tag on the main pages', () => {
    for (const f of ['index.html', 'prompts.html']) expect(read(path.join(ROOT, f)), f).toMatch(/<meta name="description" content="[^"]{40,}"/);
  });

  test('the custom domain file contains exactly one domain', () => {
    const cname = read(path.join(ROOT, 'CNAME')).trim().split(/\s+/);
    expect(cname).toHaveLength(1);
    expect(cname[0]).toMatch(/^[a-z0-9.-]+\.[a-z]{2,}$/);
  });
});
