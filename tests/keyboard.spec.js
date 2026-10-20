// Keyboard-only accessibility: every game can be started, played and finished without a mouse; focus is managed; focus is visible.
const { test, expect } = require('@playwright/test');
const { GAMES } = require('./pages');

async function open(page, file, level = 'hard', timers = true) {
  await page.addInitScript(([lv, t]) => { localStorage.setItem('qa:level', JSON.stringify(lv)); localStorage.setItem('qa:timers', JSON.stringify(t)); }, [level, timers]);
  await page.goto(`/games/${file}.html`);
}
const activeId = page => page.evaluate(() => document.activeElement && document.activeElement.id);

// ================================================================ dialogs and focus order (all games)
for (const g of GAMES) {
  test.describe(`${g.name}: dialogs and focus`, () => {
    test('the Start button has focus on load and focus stays inside the dialog', async ({ page }) => {
      await open(page, g.file);
      await expect(page.locator('#go')).toBeFocused();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Tab');
        expect(await page.evaluate(() => !!document.activeElement.closest('#start')), `Tab ${i + 1}`).toBe(true);
      }
    });

    test('the dialog can be operated with the keyboard (levels, then Start)', async ({ page }) => {
      await open(page, g.file, 'medium');
      await page.locator('.lv').first().focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('.lv').first()).toHaveAttribute('aria-pressed', 'true');
      await page.locator('#go').focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#start')).toBeHidden();
      await expect(page.locator('#stage')).toBeFocused();
    });

    test('the skip link moves focus to the game', async ({ page }) => {
      await open(page, g.file);
      await page.locator('#go').click();
      await page.locator('body').click({ position: { x: 1, y: 1 } });
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Skip to the game' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.locator('#stage')).toBeFocused();
    });

    test('the end dialog takes focus and the game behind it is not reachable', async ({ page }) => {
      await open(page, g.file);
      await page.locator('#go').click();
      await page.evaluate(() => QA.end('🏆', 'Done', 'Finished.', '', 1));
      await expect(page.locator('#again')).toBeFocused();
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement.closest('#end'))).toBe(true); }
      expect(await page.locator('main').evaluate(m => m.inert)).toBe(true);
    });
  });
}

// ================================================================ inspector games: complete with the keyboard only
const HUNT = {
  bughunt: ['b-cart', 'b-total', 'b-qty', 'b-btn', 'b-email', 'b-expiry', 'b-link', 'b-pin'],
  a11y: ['x-img', 'x-label', 'x-div', 'x-link', 'x-cont', 'x-size', 'x-color', 'x-focus'],
  data: ['d2-amount', 'd4-email', 'd5-order_id', 'd6-status', 'd3-customer', 'd5-shipped_at', 'd7-created_at', 'd8-amount']
};
for (const [file, ids] of Object.entries(HUNT)) {
  test.describe(`${file}: keyboard-only play`, () => {
    test('the whole game can be won using only the keyboard', async ({ page }) => {
      await open(page, file);
      await page.keyboard.press('Enter');                         // Start button is focused
      await expect(page.locator('#stage')).toBeFocused();
      await page.keyboard.press('Tab');                           // into the page under test
      await expect(page.locator('#app [tabindex="0"]')).toBeFocused();
      await page.keyboard.press('Home');
      const remaining = new Set(ids);
      for (let step = 0; step < 400 && remaining.size; step++) {
        const id = await activeId(page);
        if (remaining.has(id)) { await page.keyboard.press('r'); remaining.delete(id); }
        if (!remaining.size) break;
        await page.keyboard.press('ArrowRight');
      }
      expect([...remaining]).toEqual([]);
      await expect(page.locator('#end')).toBeVisible();
      await expect(page.locator('#e-text')).toContainText('8 of 8');
      await expect(page.locator('#again')).toBeFocused();
    });

    test('arrow keys, Home and End move focus and Enter inspects', async ({ page }) => {
      await open(page, file);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      const first = await activeId(page);
      await page.keyboard.press('ArrowDown');
      const second = await page.evaluate(() => document.activeElement.outerHTML);
      await page.keyboard.press('ArrowUp');
      expect(await page.evaluate(() => document.activeElement.outerHTML)).not.toBe(second);
      await page.keyboard.press('End');
      const lastIsBeyondFirst = await page.evaluate(() => document.activeElement !== document.querySelector('#app [tabindex]'));
      expect(lastIsBeyondFirst).toBe(true);
      await page.keyboard.press('Home');
      expect(await activeId(page)).toBe(first);
      await page.keyboard.press('Enter');
      await expect(page.locator('#insp')).toContainText(/\d+×\d+px/);
      await expect(page.locator('#rep')).toBeEnabled();
    });

    test('there is only one tab stop in the page under test (roving tabindex)', async ({ page }) => {
      await open(page, file);
      await page.keyboard.press('Enter');
      expect(await page.locator('#app [tabindex="0"]').count()).toBe(1);
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
      expect(await page.locator('#app [tabindex="0"]').count()).toBe(1);
    });

    test('the focused element has a clearly visible focus indicator', async ({ page }) => {
      await open(page, file);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('ArrowRight');
      const outline = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return { style: s.outlineStyle, width: parseFloat(s.outlineWidth) }; });
      expect(outline.style).not.toBe('none');
      expect(outline.width).toBeGreaterThanOrEqual(2);
    });

    test('pressing R on a clean element is a false report; the log is a live region', async ({ page }) => {
      await open(page, file);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Tab');
      await page.keyboard.press('r');
      await expect(page.locator('#hud')).toContainText(/Score: (-25|100)/);
      await expect(page.locator('[role="log"]')).toHaveAttribute('aria-live', 'polite');
      await expect(page.locator('#insp')).toHaveAttribute('aria-live', 'polite');
    });

    test('a hint moves keyboard focus to the element it points at', async ({ page }) => {
      await open(page, file, 'easy');
      await page.keyboard.press('Enter');
      await page.locator('#hint').focus();
      await page.keyboard.press('Enter');
      expect(await page.evaluate(() => !!document.activeElement.closest('#app'))).toBe(true);
    });
  });
}

// ================================================================ the other games: operate controls from the keyboard
test.describe('API Lab by keyboard', () => {
  test('send a request and report a bug without a mouse', async ({ page }) => {
    await open(page, 'api', 'medium');
    await page.keyboard.press('Enter');
    await page.getByLabel('Request path').focus();
    await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('/books/999');
    await page.getByRole('button', { name: /Send/ }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#out')).toContainText('200');
    await page.getByLabel('What is wrong with this response?').focus(); await page.keyboard.type('Wrong');
    await page.getByRole('button', { name: /Report bug/ }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#hud')).toContainText('Score: 100');
    await expect(page.locator('#out')).toHaveAttribute('aria-live', 'polite');
  });
  test('every form control has an accessible name', async ({ page }) => {
    await open(page, 'api'); await page.locator('#go').click();
    for (const name of ['HTTP method', 'Request path', 'Authorization', 'JSON body', 'What is wrong with this response?']) await expect(page.getByLabel(name)).toHaveCount(1);
  });
});

test.describe('Boundary Lab by keyboard', () => {
  test('type, test with Enter, then report the result with the keyboard', async ({ page }) => {
    await open(page, 'boundary', 'easy');
    await page.keyboard.press('Enter');
    await page.getByLabel('Age: value to test').focus();
    await page.keyboard.type('65'); await page.keyboard.press('Enter');
    await expect(page.locator('.hist')).toHaveAttribute('aria-live', 'polite');
    const report = page.getByRole('button', { name: /Report a bug for this result: 65 was rejected/ });
    await report.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#end')).toBeVisible();
  });
});

test.describe('Security Lab by keyboard', () => {
  test('exploit and fix using the keyboard only', async ({ page }) => {
    await open(page, 'security', 'easy');
    await page.keyboard.press('Enter');
    await page.getByLabel('Username').focus(); await page.keyboard.type("admin' or 1=1 --");
    await page.keyboard.press('Tab'); await page.keyboard.type('x');
    await page.locator('.panel[data-k="login"] .send').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.panel[data-k="login"] .out')).toContainText('exploited');
    const fix = page.locator('.panel[data-k="login"] .fixbox .opt[data-i="0"]');
    await fix.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.panel[data-k="login"] .fb')).toContainText('✓');
    await expect(page.getByRole('group', { name: /right fix for the login/ })).toBeVisible();
  });
});

test.describe('Perf Lab by keyboard', () => {
  test('the slider responds to arrow keys and results are announced', async ({ page }) => {
    await open(page, 'perf', 'easy');
    await page.keyboard.press('Enter');
    const slider = page.getByLabel(/Virtual users/);
    await slider.focus();
    const before = await slider.inputValue();
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
    expect(+(await slider.inputValue())).toBeGreaterThan(+before);
    await page.getByRole('button', { name: /Run test/ }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#mt')).toContainText('p95');
    await expect(page.locator('#mt')).toHaveAttribute('aria-live', 'polite');
    await expect(page.getByRole('img', { name: /Chart of p95 latency/ })).toBeVisible();
  });
});

test.describe('Flaky Test Hunt by keyboard', () => {
  test('results are real buttons with text alternatives and verdicts are labelled', async ({ page }) => {
    await open(page, 'flaky', 'easy');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Run suite/ }).focus(); await page.keyboard.press('Enter');
    const cell = page.getByRole('button', { name: /login › valid user, run 1: passed/ });
    await cell.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#dt')).toContainText('passed');
    await expect(page.getByLabel('Your verdict for refund › total')).toHaveCount(1);
    await expect(page.getByRole('rowheader', { name: 'refund › total' })).toBeVisible();
  });
});

test.describe('Regression Radar by keyboard', () => {
  test('tests are checkboxes that can be toggled with Space and Enter', async ({ page }) => {
    await open(page, 'regression', 'easy');
    await page.keyboard.press('Enter');
    const card = page.getByRole('checkbox').first();
    await card.focus();
    await page.keyboard.press('Space');
    await expect(card).toHaveAttribute('aria-checked', 'true');
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-checked', 'false');
    await page.keyboard.press('Space');
    await page.getByRole('button', { name: /Run selected tests/ }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.tcard .pill').first()).toBeVisible();
  });
});

test.describe('Bug Triage Board by keyboard', () => {
  test('move cards with buttons, keep focus on the moved card, and submit', async ({ page }) => {
    await open(page, 'triage', 'easy');
    await page.keyboard.press('Enter');
    const move = page.getByRole('button', { name: /^Move to This sprint: Payment charged twice/ });
    await move.focus(); await page.keyboard.press('Enter');
    await expect(page.locator('.col[data-c="sprint"] .bug', { hasText: 'Payment charged twice' })).toBeVisible();
    expect(await page.evaluate(() => document.activeElement.closest('.bug')?.textContent.includes('Payment charged twice'))).toBe(true);
    await expect(page.getByRole('group', { name: /This sprint \(5 of 8 points used\)/ })).toBeVisible();
    await page.getByRole('button', { name: /Submit sprint plan/ }).focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#end')).toBeVisible();
  });
  test('capacity messages are announced', async ({ page }) => {
    await open(page, 'triage', 'easy'); await page.keyboard.press('Enter');
    await expect(page.locator('#msg')).toHaveAttribute('role', 'status');
  });
});

test.describe('Pairwise Puzzle by keyboard', () => {
  test('combinations are toggle buttons operated with Space', async ({ page }) => {
    await open(page, 'pairwise', 'easy');
    await page.keyboard.press('Enter');
    const first = page.locator('#grid .opt').first();
    await first.focus();
    await expect(first).toHaveAttribute('aria-pressed', 'false');
    await page.keyboard.press('Space');
    await expect(first).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#hud')).toContainText('Runs: 1');
    await expect(page.locator('#miss')).toHaveAttribute('aria-live', 'polite');
  });
});

// ================================================================ other pages
test.describe('Prompts and home pages by keyboard', () => {
  test('home: the first Tab stop is a navigation link and every nav link is reachable in order', async ({ page }) => {
    await page.goto('/index.html');
    const seen = [];
    for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); seen.push(await page.evaluate(() => document.activeElement.textContent.trim().slice(0, 25))); }
    for (const l of ['Profile', 'Competencies', 'Approach', 'Experience', 'Prompts', 'Playground', 'Contact']) expect(seen.join('|')).toContain(l);
  });
  test('no page has a keyboard trap: Tab always moves on', async ({ page }) => {
    for (const p of ['/index.html', '/prompts.html', '/games/index.html', '/games/interview.html']) {
      await page.goto(p);
      const ids = new Set();
      for (let i = 0; i < 30; i++) { await page.keyboard.press('Tab'); ids.add(await page.evaluate(() => document.activeElement.outerHTML.slice(0, 80))); }
      expect(ids.size, p).toBeGreaterThan(5);
    }
  });
  test('interview mode: rounds can be started and the iframe is titled', async ({ page }) => {
    await page.goto('/games/interview.html');
    await page.locator('[data-r="screening"]').focus(); await page.keyboard.press('Enter');
    await expect(page.locator('#fr')).toHaveAttribute('title', /.+/);
  });
});
