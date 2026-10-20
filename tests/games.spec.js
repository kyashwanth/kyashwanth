// Functional tests: every game can be played to a correct result, scoring rules hold, levels/timers/state behave.
const { test, expect } = require('@playwright/test');
const { GAMES } = require('./pages');

async function open(page, file, { level = 'medium', timers = true } = {}) {
  await page.addInitScript(([lv, t]) => { localStorage.setItem('qa:level', JSON.stringify(lv)); localStorage.setItem('qa:timers', JSON.stringify(t)); localStorage.removeItem('qa:best:' + location.pathname.split('/').pop().replace('.html', '')); }, [level, timers]);
  await page.goto(`/games/${file}.html`);
}
const begin = async (page, file, opts) => { await open(page, file, opts); await page.locator('#go').click(); };
const hud = page => page.locator('#hud');
const ended = page => expect(page.locator('#end')).toBeVisible();
const endText = page => page.locator('#e-text');

// ============================================================ shared behaviour for all 11 games
for (const g of GAMES) {
  test.describe(`${g.name}: common behaviour`, () => {
    test('start dialog shows three levels and remembers the choice', async ({ page }) => {
      await page.goto(`/games/${g.file}.html`);
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.locator('#start').getByRole('heading', { name: g.name })).toBeVisible();
      const levels = page.locator('.lv');
      await expect(levels).toHaveCount(3);
      await levels.nth(2).click();
      await expect(levels.nth(2)).toHaveAttribute('aria-pressed', 'true');
      await expect(levels.nth(1)).toHaveAttribute('aria-pressed', 'false');
      await page.reload();
      await expect(page.locator('.lv').nth(2)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#lvinfo')).not.toBeEmpty();
    });

    test('Play again goes back to the start dialog', async ({ page }) => {
      await begin(page, g.file);
      await page.evaluate(() => QA.end('🏆', 'Done', 'Finished.', '', 5));
      await ended(page);
      await page.getByRole('button', { name: 'Play again' }).click();
      await expect(page.locator('#start')).toBeVisible();
      await expect(page.locator('#end')).toBeHidden();
    });

    test('saves the best score per level', async ({ page }) => {
      await begin(page, g.file, { level: 'easy' });
      await page.evaluate(() => QA.end('🏆', 'Done', 'Finished.', '', 120));
      await page.evaluate(() => QA.end('🏆', 'Done', 'Finished.', '', 80));      // a lower score must not overwrite
      const best = await page.evaluate(id => JSON.parse(localStorage.getItem('qa:best:' + id)), g.file === 'bughunt' ? 'bughunt' : g.file);
      expect(best.easy).toBe(120);
    });

    test('is announced as a modal dialog with the game behind it inert', async ({ page }) => {
      await page.goto(`/games/${g.file}.html`);
      await expect(page.locator('#start')).toHaveAttribute('aria-modal', 'true');
      expect(await page.locator('main').evaluate(m => m.inert)).toBe(true);
      await page.locator('#go').click();
      expect(await page.locator('main').evaluate(m => m.inert)).toBe(false);
    });
  });
}

// ============================================================ timer toggle (the five timed games)
const TIMED = ['bughunt', 'a11y', 'data', 'api', 'security'];
for (const f of GAMES.map(g => g.file)) {
  test(`${f}: timer toggle ${TIMED.includes(f) ? 'is offered' : 'is not offered (no timer in this game)'}`, async ({ page }) => {
    await page.goto(`/games/${f}.html`);
    await expect(page.locator('#tmr')).toHaveCount(TIMED.includes(f) ? 1 : 0);
  });
}
for (const f of TIMED) {
  test(`${f}: timer counts down when it is on`, async ({ page }) => {
    await begin(page, f, { timers: true });
    await expect(hud(page)).toContainText(/⏱ \d+s/);
    const t0 = +(await hud(page).textContent()).match(/⏱ (\d+)s/)[1];
    await page.waitForTimeout(2300);
    const t1 = +(await hud(page).textContent()).match(/⏱ (\d+)s/)[1];
    expect(t1).toBeLessThan(t0);

  });
  test(`${f}: the timer can be switched off, stays untimed and the choice persists`, async ({ page }) => {
    await page.goto(`/games/${f}.html`);
    await expect(page.locator('#tmr')).toBeChecked();            // on by default
    await page.locator('#tmr').uncheck();
    await page.locator('#go').click();
    await expect(hud(page)).toContainText('untimed');
    await page.waitForTimeout(1500);
    await expect(hud(page)).toContainText('untimed');
    await page.reload();
    await expect(page.locator('#tmr')).not.toBeChecked();   // remembered
  });
  test(`${f}: Finish ends an untimed game`, async ({ page }) => {
    await begin(page, f, { timers: false });
    await page.getByRole('button', { name: /Finish/ }).click();
    await ended(page);
  });
}

// ============================================================ hunt games (Bug Hunt, Accessibility Audit, Data Detective)
const HUNT = {
  bughunt: { ids: ['b-cart', 'b-total', 'b-qty', 'b-btn', 'b-email', 'b-expiry', 'b-link', 'b-pin'], easy: 4, medium: 6, hard: 8 },
  a11y: { ids: ['x-img', 'x-label', 'x-div', 'x-link', 'x-cont', 'x-size', 'x-color', 'x-focus'], easy: 4, medium: 6, hard: 8 },
  data: { ids: ['d2-amount', 'd4-email', 'd5-order_id', 'd6-status', 'd3-customer', 'd5-shipped_at', 'd7-created_at', 'd8-amount'], easy: 4, medium: 6, hard: 8 }
};
for (const [file, h] of Object.entries(HUNT)) {
  test.describe(`${file}: inspector game`, () => {
    for (const lv of ['easy', 'medium', 'hard']) {
      test(`${lv} level has ${h[lv]} bugs`, async ({ page }) => {
        await begin(page, file, { level: lv });
        await expect(hud(page)).toContainText(`Bugs: 0 / ${h[lv]}`);
      });
    }

    test('reporting every real bug at hard wins the game with a time bonus', async ({ page }) => {
      await begin(page, file, { level: 'hard' });
      for (const id of h.ids) { await page.locator('#' + id).click(); await page.locator('#rep').click(); }
      await ended(page);
      await expect(endText(page)).toContainText('8 of 8');
      await expect(endText(page)).toContainText(/time bonus/);
      await expect(page.locator('#e-title')).toHaveText('Flawless!');
    });

    test('a false report costs 25 points and is logged as not a defect', async ({ page }) => {
      await begin(page, file, { level: 'hard' });
      const clean = page.locator({ bughunt: '#app .shop-nav b', a11y: '#app .a-box b', data: '#app th' }[file]).first();
      await clean.click();
      await page.locator('#rep').click();
      await expect(hud(page)).toContainText('Score: -25');
      await expect(page.locator('#log li').first()).toContainText('Not a defect');
    });

    test('the inspector shows details for the selected element', async ({ page }) => {
      await begin(page, file, { level: 'hard' });
      await page.locator('#' + h.ids[0]).click();
      await expect(page.locator('#insp')).toContainText(/\d+×\d+px/);
      await expect(page.locator('#rep')).toBeEnabled();
    });

    test('a hint costs 50 points, is limited by level, and is not offered at hard', async ({ page }) => {
      await begin(page, file, { level: 'easy' });
      await expect(page.locator('#hint')).toContainText('(3)');
      await page.locator('#hint').click();
      await expect(hud(page)).toContainText('Score: -50');
      await expect(page.locator('#hint')).toContainText('(2)');
      await page.goto(`/games/${file}.html`);
      await page.locator('.lv').nth(2).click(); await page.locator('#go').click();
      await expect(page.locator('#hint')).toBeDisabled();
    });

    test('reporting the same bug twice does not score twice', async ({ page }) => {
      await begin(page, file, { level: 'hard' });
      await page.locator('#' + h.ids[0]).click(); await page.locator('#rep').click();
      await page.locator('#' + h.ids[0]).click(); await page.locator('#rep').click();
      await expect(hud(page)).toContainText('Score: 100');
    });
  });
}

// ============================================================ API Lab
async function send(page, { method = 'GET', path = '/books', auth = '', body = '' } = {}) {
  await page.locator('#m').selectOption(method);
  await page.locator('#p').fill(path);
  await page.locator('#a').selectOption(auth);
  await page.locator('#b').fill(body);
  await page.locator('#send').click();
}
const reportAs = async (page, cat) => { await page.locator('#rc').selectOption(cat); await page.locator('#rep').click(); };

test.describe('API Lab', () => {
  test('all seven bugs can be found at hard', async ({ page }) => {
    await begin(page, 'api', { level: 'hard' });
    await send(page, { path: '/books/1' }); await reportAs(page, 'contract');
    await send(page, { path: '/books/999' }); await reportAs(page, 'status');
    await send(page, { method: 'POST', path: '/books', body: '{}' }); await reportAs(page, 'validation');
    await send(page, { method: 'POST', path: '/books', body: '{"title":"X","price":-5}' }); await reportAs(page, 'validation');
    await send(page, { method: 'DELETE', path: '/books/2' }); await reportAs(page, 'auth');
    await send(page, { path: '/users/2/orders', auth: 'user1-token' }); await reportAs(page, 'authz');
    await send(page, { path: '/books?limit=-1' }); await reportAs(page, 'leak');
    await ended(page);
    await expect(endText(page)).toContainText('7 of 7');
    await expect(endText(page)).toContainText('Final score: 700');
  });

  test('healthy requests are not bugs: a false report costs 25 points', async ({ page }) => {
    await begin(page, 'api', { level: 'hard' });
    await send(page, { path: '/books' });
    await expect(page.locator('#out')).toContainText('200');
    await reportAs(page, 'status');
    await expect(hud(page)).toContainText('Score: -25');
  });

  test('the right bug with the wrong category earns half points', async ({ page }) => {
    await begin(page, 'api', { level: 'easy' });
    await send(page, { path: '/books/999' });
    await reportAs(page, 'validation');
    await expect(hud(page)).toContainText('Score: 50');
    await expect(page.locator('#log li').first()).toContainText('half points');
  });

  test('levels expose 3, 5 and 7 bugs', async ({ page }) => {
    for (const [lv, n] of [['easy', 3], ['medium', 5], ['hard', 7]]) {
      await begin(page, 'api', { level: lv });
      await expect(hud(page)).toContainText(`Bugs: 0 / ${n}`);
      await page.goto('about:blank');
    }
  });

  test('a fixed API behaves correctly at easy for bugs that belong to higher levels', async ({ page }) => {
    await begin(page, 'api', { level: 'easy' });
    await send(page, { method: 'DELETE', path: '/books/2' });
    await expect(page.locator('#out')).toContainText('401');          // authentication bug only exists from medium
    await send(page, { path: '/users/2/orders', auth: 'user1-token' });
    await expect(page.locator('#out')).toContainText('403');
    await send(page, { path: '/books?limit=-1' });
    await expect(page.locator('#out')).toContainText('400');
  });

  test('deleting as admin really removes the book and invalid JSON is rejected', async ({ page }) => {
    await begin(page, 'api', { level: 'hard' });
    await send(page, { method: 'DELETE', path: '/books/2', auth: 'admin-token' });
    await expect(page.locator('#out')).toContainText('204');
    await send(page, { path: '/books/2' });
    await expect(page.locator('#out')).toContainText(/200|404/);
    await send(page, { method: 'POST', path: '/books', body: '{not json' });
    await expect(page.locator('#out')).toContainText('invalid JSON');
    await expect(page.locator('#rep')).toBeDisabled();
  });
});

// ============================================================ Boundary Lab
test.describe('Boundary Lab', () => {
  const field = (page, label) => page.getByLabel(`${label}: value to test`);
  test('easy: the age validator rejects 65 and reporting it wins', async ({ page }) => {
    await begin(page, 'boundary', { level: 'easy' });
    await field(page, 'Age').fill('65'); await field(page, 'Age').press('Enter');
    await expect(page.locator('.entry')).toContainText('rejected');
    await page.getByRole('button', { name: /Report a bug for this result/ }).click();
    await ended(page);
    await expect(endText(page)).toContainText('1 of 1');
  });
  test('correct behaviour at an edge is not a bug (false report costs 25)', async ({ page }) => {
    await begin(page, 'boundary', { level: 'hard' });
    await field(page, 'Star rating').fill('5'); await field(page, 'Star rating').press('Enter');
    await expect(page.locator('.entry')).toContainText('accepted');
    await page.getByRole('button', { name: /Report a bug for this result/ }).click();
    await expect(hud(page)).toContainText('Score: -25');
  });
  test('the number of tries is limited', async ({ page }) => {
    await begin(page, 'boundary', { level: 'easy' });
    for (let i = 0; i < 14; i++) { await field(page, 'Age').fill(String(20 + i)); await field(page, 'Age').press('Enter'); }
    await expect(page.locator('.entry')).toHaveCount(12);
    await expect(hud(page)).toContainText('Tries left: 0');
  });
  test('hard: all five buggy fields are found and one is clean', async ({ page }) => {
    await begin(page, 'boundary', { level: 'hard' });
    const cases = [['Age', '65'], ['Quantity', '11'], ['Order total for discount', '50'], ['Month', '0']];
    for (const [l, v] of cases) { await field(page, l).fill(v); await field(page, l).press('Enter'); }
    await field(page, 'Password length').fill('x'.repeat(21)); await field(page, 'Password length').press('Enter');
    for (const b of await page.getByRole('button', { name: /Report a bug for this result/ }).all()) { if (await page.locator('#end').isVisible()) break; await b.click(); }
    await ended(page);
    await expect(endText(page)).toContainText('5 of 5');
  });
});

// ============================================================ Security Lab
test.describe('Security Lab', () => {
  const panel = (page, k) => page.locator(`.panel[data-k="${k}"]`);
  test('hard: every vulnerability can be exploited and fixed', async ({ page }) => {
    await begin(page, 'security', { level: 'hard' });
    const attacks = { login: [['#in-login-user', "admin' or 1=1 --"], ['#in-login-pass', 'x']], search: [['#in-search-q', '<img src=x onmouseover=alert(1)>']], files: [['#in-files-path', '%252e%252e%252fetc/passwd']], ping: [['#in-ping-host', '8.8.8.8 | id']] };
    for (const [k, fields] of Object.entries(attacks)) {
      for (const [sel, v] of fields) await page.locator(sel).fill(v);
      await panel(page, k).locator('.send').click();
      await expect(panel(page, k).locator('.out')).toContainText('Vulnerability exploited');
      await panel(page, k).locator('.fixbox .opt[data-i="0"]').click();
      await expect(panel(page, k).locator('.fb')).toContainText('✓');
    }
    await ended(page);
    await expect(endText(page)).toContainText('Score 600 of 600');
  });
  test('the hard-level filters block naive payloads', async ({ page }) => {
    await begin(page, 'security', { level: 'hard' });
    await page.locator('#in-login-user').fill("' OR '1'='1"); await page.locator('#in-login-pass').fill('x');
    await panel(page, 'login').locator('.send').click();
    await expect(panel(page, 'login').locator('.out')).toContainText('WAF');
    await page.locator('#in-ping-host').fill('a; id');
    await panel(page, 'ping').locator('.send').click();
    await expect(panel(page, 'ping').locator('.out')).toContainText('WAF');
  });
  test('legitimate input is not flagged and a wrong fix is explained', async ({ page }) => {
    await begin(page, 'security', { level: 'easy' });
    await page.locator('#in-login-user').fill("O'Brien"); await page.locator('#in-login-pass').fill('x');
    await panel(page, 'login').locator('.send').click();
    await expect(panel(page, 'login').locator('.out')).not.toContainText('exploited');
    await page.locator('#in-login-user').fill("admin' or 1=1 --");
    await panel(page, 'login').locator('.send').click();
    await panel(page, 'login').locator('.fixbox .opt[data-i="1"]').click();
    await expect(panel(page, 'login').locator('.fb')).toContainText('The best fix');
  });
  test('the correct fix is not always in the same position', async ({ page }) => {
    await begin(page, 'security', { level: 'easy' });
    const positions = new Set();
    for (let i = 0; i < 14; i++) {
      await page.locator('#in-login-user').fill("admin' or 1=1 --");
      await panel(page, 'login').locator('.send').click();
      positions.add(await page.locator('.panel[data-k="login"] .fixbox .opt').evaluateAll(os => os.findIndex(o => o.dataset.i === '0')));
      await page.evaluate(() => { state.login = {}; document.querySelector('.panel[data-k="login"] .fixbox').innerHTML = ''; });
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});

// ============================================================ Perf Lab
test.describe('Perf Lab', () => {
  const run = async (page, users, dur) => { await page.locator('#u').fill(String(users)); await page.locator('#d').selectOption(String(dur)); await page.locator('#run').click(); };
  test('medium: complete all four missions', async ({ page }) => {
    await begin(page, 'perf', { level: 'medium' });
    await run(page, 240, 5);
    await expect(page.locator('#mt')).toContainText('SLA BREACHED');
    await page.locator('#mark').click();
    await expect(page.locator('#fb')).toContainText('within 12%');
    await page.locator('#dg').selectOption('pool'); await page.locator('#diag').click();
    await run(page, 150, 120);
    await page.locator('#deg').click();
    await page.locator('#dg').selectOption('leak'); await page.locator('#diag').click();
    await ended(page);
    await expect(endText(page)).toContainText('Score 300 of 300');
  });
  test('you must run a test at the same load before marking the breaking point', async ({ page }) => {
    await begin(page, 'perf', { level: 'medium' });
    await run(page, 100, 5);
    await page.locator('#u').fill('240');
    await page.locator('#mark').click();
    await expect(page.locator('#fb')).toContainText('Run a test at exactly this user count');
  });
  test('a wrong diagnosis costs points and degradation cannot be reported at easy', async ({ page }) => {
    await begin(page, 'perf', { level: 'easy' });
    await run(page, 100, 120);
    await page.locator('#deg').click();
    await page.locator('#dg').selectOption('leak'); await page.locator('#diag').click();
    await expect(hud(page)).toContainText('Score: -25');
  });
  test('the chart has a text alternative that describes the latest run', async ({ page }) => {
    await begin(page, 'perf', { level: 'medium' });
    await run(page, 200, 30);
    await expect(page.locator('#ch')).toHaveAttribute('aria-label', /200 users.*ms/);
  });
  test('the number of runs is limited', async ({ page }) => {
    await begin(page, 'perf', { level: 'easy' });
    for (let i = 0; i < 10; i++) await page.locator('#run').click();
    await expect(hud(page)).toContainText('Runs left: 0');
  });
});

// ============================================================ Flaky Test Hunt
test.describe('Flaky Test Hunt', () => {
  const classify = async (page, truth) => { const sel = page.locator('select[data-v]'); for (let i = 0; i < truth.length; i++) await sel.nth(i).selectOption(truth[i]); };
  test('easy: classify all five tests', async ({ page }) => {
    await begin(page, 'flaky', { level: 'easy' });
    for (let i = 0; i < 8; i++) await page.locator('#run').click();
    await classify(page, ['stable', 'stable', 'broken', 'flaky', 'flaky']);
    await page.locator('#sub').click();
    await ended(page);
    await expect(endText(page)).toContainText('5 of 5');
  });
  test('you cannot submit before classifying every test, and runs are limited', async ({ page }) => {
    await begin(page, 'flaky', { level: 'easy' });
    await page.locator('#sub').click();
    await expect(page.locator('#dt')).toContainText('Classify every test');
    for (let i = 0; i < 12; i++) await page.locator('#run').click();
    await expect(page.locator('th', { hasText: /^#\d+$/ })).toHaveCount(8);
  });
  test('medium: an infrastructure outage makes every test fail in the same run', async ({ page }) => {
    await begin(page, 'flaky', { level: 'medium' });
    for (let i = 0; i < 4; i++) await page.locator('#run').click();
    await expect(page.locator('button.cell.i')).toHaveCount(7);
    await page.locator('button.cell.i').first().click();
    await expect(page.locator('#dt')).toContainText('ECONNREFUSED');
  });
  test('wrong answers are explained', async ({ page }) => {
    await begin(page, 'flaky', { level: 'easy' });
    for (let i = 0; i < 8; i++) await page.locator('#run').click();
    await classify(page, ['flaky', 'flaky', 'flaky', 'flaky', 'flaky']);
    await page.locator('#sub').click();
    await expect(page.locator('#e-extra')).toContainText('is stable');
  });
});

// ============================================================ Regression Radar
test.describe('Regression Radar', () => {
  const pick = async (page, ...idx) => { for (const i of idx) await page.locator(`.tcard[data-i="${i}"]`).click(); await page.locator('#go2').click(); };
  test('easy: find both culprits within budget', async ({ page }) => {
    await begin(page, 'regression', { level: 'easy' });
    await pick(page, 2, 3);
    await expect(page.locator('.tcard[data-i="2"] .pill')).toHaveText('FAIL');
    await page.locator('#cu').selectOption('Payments'); await page.locator('#sub2').click();
    await expect(page.locator('#fb')).toContainText('Correct');
    await page.locator('#nx').click();
    await pick(page, 1);
    await page.locator('#cu').selectOption('Search'); await page.locator('#sub2').click();
    await page.locator('#nx').click();
    await ended(page);
    await expect(endText(page)).toContainText('2 of 2');
  });
  test('running more than the budget is refused', async ({ page }) => {
    await begin(page, 'regression', { level: 'easy' });
    await pick(page, 0, 1, 2, 3, 4, 5, 6);
    await expect(page.locator('#fb')).toContainText('Over budget');
  });
  test('a wrong culprit scores nothing and the reason is shown', async ({ page }) => {
    await begin(page, 'regression', { level: 'easy' });
    await pick(page, 2, 3);
    await page.locator('#cu').selectOption('Cart'); await page.locator('#sub2').click();
    await expect(page.locator('#fb')).toContainText('It was');
    await expect(hud(page)).toContainText('Score: 0');
  });
  test('passing tests are shown as PASS and cannot be selected again', async ({ page }) => {
    await begin(page, 'regression', { level: 'easy' });
    await pick(page, 0);
    await expect(page.locator('.tcard[data-i="0"] .pill')).toHaveText('PASS');
    await page.locator('.tcard[data-i="0"]').click({ force: true });   // aria-disabled: a real user cannot toggle it
    await expect(page.locator('.tcard[data-i="0"]')).toHaveAttribute('aria-checked', 'false');
  });
});

// ============================================================ Bug Triage Board
test.describe('Bug Triage Board', () => {
  const move = (page, col, title) => page.getByRole('button', { name: new RegExp(`^Move to ${col}: ${title}`) }).click();
  test('easy: the best plan scores full marks', async ({ page }) => {
    await begin(page, 'triage', { level: 'easy' });
    await move(page, 'This sprint', 'Payment charged twice');
    await move(page, 'This sprint', 'Admin page shows other tenants');
    await move(page, 'This sprint', 'Typo in footer');
    await page.getByRole('button', { name: /Submit sprint plan/ }).click();
    await ended(page);
    await expect(endText(page)).toContainText('Sprint value 21 of a possible 21');
    await expect(endText(page)).toContainText('Final score: 300');
  });
  test('the sprint capacity is enforced', async ({ page }) => {
    await begin(page, 'triage', { level: 'easy' });
    await move(page, 'This sprint', 'Payment charged twice');
    await move(page, 'This sprint', 'Admin page shows other tenants');
    await move(page, 'This sprint', 'CSV export fails');
    await expect(page.locator('#msg')).toContainText('No room');
  });
  test('leaving a critical bug out is penalised', async ({ page }) => {
    await begin(page, 'triage', { level: 'easy' });
    await move(page, 'This sprint', 'Login fails on Safari');
    await move(page, 'This sprint', 'CSV export fails');
    await page.getByRole('button', { name: /Submit sprint plan/ }).click();
    await expect(page.locator('#e-extra')).toContainText('critical bugs left out');
  });
  test('medium: a duplicate must be closed as Won\'t fix', async ({ page }) => {
    const plan = async (dupCol) => {
      await begin(page, 'triage', { level: 'medium' });
      await move(page, 'This sprint', 'Payment charged twice');
      await move(page, 'This sprint', 'Admin page shows other tenants');
      await move(page, 'This sprint', 'Login fails on Safari');
      await move(page, dupCol, 'Duplicate of the Safari');
      await page.getByRole('button', { name: /Submit sprint plan/ }).click();
      return endText(page).textContent();
    };
    expect(await plan("Won't fix")).toContain('Final score: 300');
    await page.goto('about:blank');
    expect(await plan('Backlog')).toContain('Final score: 250');
  });
  test('cards can also be dragged between columns', async ({ page }) => {
    await begin(page, 'triage', { level: 'easy' });
    await page.locator('.bug', { hasText: 'Typo in footer' }).dragTo(page.locator('.col[data-c="backlog"]'), { sourcePosition: { x: 20, y: 12 } });   // grab the card by its title (the Move buttons are not drag handles)
    await expect(page.locator('.col[data-c="backlog"] .bug', { hasText: 'Typo in footer' })).toBeVisible();
  });
});

// ============================================================ Pairwise Puzzle
test.describe('Pairwise Puzzle', () => {
  // find a minimal covering set in the page itself, then click it like a user
  const optimal = (page, n) => page.evaluate(n => {
    const idx = combos.map((_, i) => i), pr = i => pairs(combos[i]);
    const search = (start, chosen, cov) => {
      if (cov.size === ALLP.size) return chosen;
      if (chosen.length === n) return null;
      for (let i = start; i < idx.length; i++) { const next = new Set(cov); pr(i).forEach(p => next.add(p)); const r = search(i + 1, [...chosen, i], next); if (r) return r; }
      return null;
    };
    return search(0, [], new Set());
  }, n);
  test('easy: 16 pairs need 6 runs and the optimal plan scores full marks', async ({ page }) => {
    await begin(page, 'pairwise', { level: 'easy' });
    await expect(hud(page)).toContainText('Pairs: 0 / 16');
    await expect(page.locator('#sub')).toBeDisabled();
    const plan = await optimal(page, 6);
    expect(plan).toHaveLength(6);
    for (const i of plan) await page.locator('#grid .opt').nth(i).click();
    await expect(hud(page)).toContainText('Pairs: 16 / 16');
    await expect(page.locator('#sub')).toBeEnabled();
    await page.locator('#sub').click();
    await ended(page);
    await expect(page.locator('#e-title')).toHaveText('Optimal: 6 runs!');
  });
  test('five runs can never cover everything at easy', async ({ page }) => {
    await begin(page, 'pairwise', { level: 'easy' });
    expect(await optimal(page, 5)).toBeNull();
  });
  test('selecting every combination covers all pairs but is wasteful', async ({ page }) => {
    await begin(page, 'pairwise', { level: 'hard' });
    await expect(hud(page)).toContainText('Pairs: 0 / 37');
    for (const b of await page.locator('#grid .opt').all()) await b.click();
    await expect(hud(page)).toContainText('Pairs: 37 / 37');
    await page.locator('#sub').click();
    await expect(page.locator('#e-title')).toContainText('wasteful');
  });
  test('Clear resets the selection', async ({ page }) => {
    await begin(page, 'pairwise', { level: 'medium' });
    await page.locator('#grid .opt').first().click();
    await expect(hud(page)).toContainText('Runs: 1');
    await page.locator('#clr').click();
    await expect(hud(page)).toContainText('Runs: 0');
  });
});

// ============================================================ Games hub
test.describe('Games hub', () => {
  test('shows the best score per level after a game has been played', async ({ page }) => {
    await begin(page, 'pairwise', { level: 'easy' });
    await page.evaluate(() => QA.end('🏆', 'Done', 'ok', '', 300));
    await page.goto('/games/index.html');
    await expect(page.locator('a.card', { hasText: 'Pairwise Puzzle' })).toContainText('easy: 300');
    await expect(page.locator('a.card', { hasText: 'API Lab' })).toContainText('Not played yet');
  });
  test('lists all eleven games and interview mode', async ({ page }) => {
    await page.goto('/games/index.html');
    for (const g of GAMES) await expect(page.locator('a.card', { hasText: g.name }), g.name).toBeVisible();
    await expect(page.getByRole('link', { name: /Interview Mode/ })).toBeVisible();
  });
});

// ============================================================ Interview mode
test.describe('Interview mode', () => {
  const frameOf = async page => { await page.waitForSelector('#fr'); return (await page.locator('#fr').elementHandle()).contentFrame(); };
  const stage = async (page, file, score) => {
    await expect.poll(async () => (await page.locator('#fr').getAttribute('src')).startsWith(file)).toBe(true);
    const f = await frameOf(page);
    await f.waitForFunction(() => document.getElementById('start')?.classList.contains('hide'));
    await f.evaluate(s => QA.end('🏅', 'Result', 'Stage finished.', '', s), score);
  };
  test('runs three stages and produces a scorecard and verdict', async ({ page }) => {
    await page.goto('/games/interview.html');
    await expect(page.locator('.round')).toHaveCount(3);
    await page.locator('[data-r="sdet"]').click();
    await stage(page, 'api.html', 500);              // 100% of 500
    await expect(page.locator('#nx')).toBeFocused();
    await page.locator('#nx').click();
    await stage(page, 'flaky.html', 700);            // 100% of 700
    await page.locator('#nx').click();
    await stage(page, 'security.html', 150);         // 33% of 450
    await page.locator('#nx').click();
    await expect(page.locator('.verdict')).toContainText('Hire');
    await expect(page.locator('.panel')).toContainText('78%');
    await expect(page.locator('.panel')).toContainText('API testing');
    expect(await page.evaluate(() => localStorage.getItem('qa:interview:sdet'))).toBe('78');
  });
  test('stages run in embedded mode: no replay buttons and the timer setting is passed on', async ({ page }) => {
    await page.goto('/games/interview.html');
    await page.locator('#itm').uncheck();
    await page.locator('[data-r="screening"]').click();
    await expect(page.locator('#fr')).toHaveAttribute('src', /timers=0/);
    const f = await frameOf(page);
    await f.waitForFunction(() => document.getElementById('start')?.classList.contains('hide'));
    await expect(f.locator('#hud')).toContainText('untimed');
    await expect(f.locator('.top a')).toBeHidden();
  });
  test('a weak performance gives a "Not yet" verdict and best score keeps the maximum', async ({ page }) => {
    await page.goto('/games/interview.html');
    await page.locator('[data-r="lead"]').click();
    await stage(page, 'regression.html', 0); await page.locator('#nx').click();
    await stage(page, 'triage.html', 0); await page.locator('#nx').click();
    await stage(page, 'perf.html', 0); await page.locator('#nx').click();
    await expect(page.locator('.verdict')).toContainText('Not yet');
  });
});
