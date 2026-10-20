// Shared engine for the QA games: frame (levels, start/end overlays), timer, scoring, and an inspector-style "find the bug" hunt.
const QA = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const LV = ['easy', 'medium', 'hard'];
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  const params = new URLSearchParams(location.search), embed = params.get('embed') === '1';
  // Timers are optional: remembered per browser, and forced by the interview runner via ?timers=0|1
  const timersOn = () => embed ? params.get('timers') !== '0' : store.get('qa:timers') !== false;
  const clock = left => left === null ? '⏱ untimed' : `⏱ ${left}s`;
  let cfg, level = 'medium';

  function frame(c) {
    cfg = c;
    const saved = embed ? params.get('level') : store.get('qa:level'); level = LV.includes(saved) ? saved : 'medium';
    if (embed) document.body.classList.add('embed');
    document.title = c.title + ' — QA Games';
    document.head.insertAdjacentHTML('beforeend', `<link rel=icon href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E${encodeURIComponent(c.emoji)}%3C/text%3E%3C/svg%3E">`);
    document.body.innerHTML = `
    <a class="skip" href="#stage">Skip to the game</a>
    <main class="wrap">
      <div class="top"><div><h1><span aria-hidden="true">${c.emoji}</span> ${c.title}</h1><a href="index.html">← All games</a></div><div class="hud" id="hud" role="group" aria-label="Game status"></div></div>
      <div id="stage" tabindex="-1"></div>
    </main>
    <div class="overlay" id="start" role="dialog" aria-modal="true" aria-labelledby="start-title"><div class="modal"><div class="big" aria-hidden="true">${c.emoji}</div><span class="tag">${c.aspect}</span><h2 id="start-title">${c.title}</h2><p>${c.intro}</p>
      <div class="levels" role="group" aria-label="Difficulty level">${LV.map(l => `<button class="lv" data-l="${l}" aria-pressed="false">${l[0].toUpperCase() + l.slice(1)}</button>`).join('')}</div>
      <p id="lvinfo"></p>${c.timed ? '<label class="tg"><input type="checkbox" id="tmr"> ⏱ Timer <span>(off: no countdown, no time bonus)</span></label>' : ''}<button class="btn" id="go">Start</button></div></div>
    <div class="overlay hide" id="end" role="dialog" aria-modal="true" aria-labelledby="e-title" aria-describedby="e-text"><div class="modal"><div class="big" id="e-emoji" aria-hidden="true"></div><h2 id="e-title"></h2><p id="e-text"></p><div class="missed" id="e-extra"></div><button class="btn" id="again">Play again</button><a class="btn ghost" href="index.html">All games</a></div></div>`;
    const paint = () => {
      document.querySelectorAll('.lv').forEach(b => { const on = b.dataset.l === level; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $('#lvinfo').textContent = (c.levelInfo || {})[level] || '';
    };
    document.querySelectorAll('.lv').forEach(b => b.onclick = () => { level = b.dataset.l; if (!embed) store.set('qa:level', level); paint(); });
    paint();
    if (c.timed) { const t = $('#tmr'); t.checked = timersOn(); t.onchange = () => { if (!embed) store.set('qa:timers', t.checked); }; }
    // Modal behaviour: Tab and Shift+Tab wrap inside whichever dialog is open
    ['start', 'end'].forEach(id => $('#' + id).addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const f = [...$('#' + id).querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea')].filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }));
    if (!embed) { sync(); $('#go').focus(); }   // keyboard users land on the Start button
  }
  // While a dialog is open the game behind it is inert (not focusable, hidden from assistive tech)
  const sync = () => { const m = $('main'); if (m) m.inert = !!document.querySelector('.overlay:not(.hide)'); };
  const openDlg = (id, focusSel) => { $('#' + id).classList.remove('hide'); sync(); $(focusSel).focus(); };
  const closeDlg = id => { $('#' + id).classList.add('hide'); sync(); };
  const hud = items => { $('#hud').innerHTML = items.map(t => `<span class="chip">${t}</span>`).join(''); };
  const onStart = fn => {
    $('#go').onclick = () => { closeDlg('start'); fn(level); if (!embed) $('#stage').focus({ preventScroll: true }); };
    $('#again').onclick = () => { closeDlg('end'); openDlg('start', '#go'); };
    if (embed) setTimeout(() => $('#go').click(), 0);   // interview mode: skip the start screen
  };
  const timer = (sec, draw, done) => {
    const t = $('#tmr'); if (!embed && t) store.set('qa:timers', t.checked);   // honour the toggle at the moment of starting
    if (!timersOn()) { draw(null); return { stop: () => {}, left: () => null }; }
    let left = sec; draw(left);
    const id = setInterval(() => { left--; draw(left); if (left <= 0) { clearInterval(id); done(); } }, 1000);
    return { stop: () => clearInterval(id), left: () => left };
  };
  const rate = (pct, labels) => {
    const L = labels || ['Flawless!', 'Sharp tester', 'Getting there', 'Keep practising'];
    return pct >= .9 ? ['🏆', L[0]] : pct >= .7 ? ['🥈', L[1]] : pct >= .4 ? ['🧐', L[2]] : ['😅', L[3]];
  };
  const end = (emoji, title, text, extra = '', score = null) => {
    if (score !== null && cfg.id) {
      const best = store.get('qa:best:' + cfg.id) || {};
      if (!(best[level] >= score)) best[level] = score;
      store.set('qa:best:' + cfg.id, best);
    }
    if (embed) {   // tell the interview runner how this stage went (normalised 0..1)
      const max = cfg.max && cfg.max[level];
      parent.postMessage({ type:'qa-result', id:cfg.id, level, score, pct:max && score !== null ? Math.max(0, Math.min(1, score / max)) : null, title }, '*');
    }
    $('#e-emoji').textContent = emoji; $('#e-title').textContent = title; $('#e-text').textContent = text; $('#e-extra').innerHTML = extra;
    openDlg('end', '#again');
  };

  // ---- inspector helpers (a tiny devtools: size, contrast, element info) ----
  const rgb = s => { const m = s.match(/[\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m[3] === undefined ? 1 : m[3] }; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const effBg = el => { for (let n = el; n; n = n.parentElement) { const c = rgb(getComputedStyle(n).backgroundColor); if (c.a > .5) return c; } return { r: 255, g: 255, b: 255 }; };
  const contrast = el => { const a = lum(rgb(getComputedStyle(el).color)), b = lum(effBg(el)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };

  function hunt(c) {
    c.timed = true;
    frame(c);
    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: c.css || '' }));
    $('#stage').innerHTML = `<div class="layout"><div id="app" class="app"></div>
      <aside class="side"><div class="panel"><h2>Inspector</h2><p class="hint" style="margin-top:0">Keyboard: Tab into the page, arrow keys move between elements, Enter inspects, R reports the focused element.</p>
        <div id="insp" class="insp" aria-live="polite">Click or focus any element on the page to inspect it, then report it if you think it is a defect.</div>
        <div class="actions"><button class="btn small" id="rep" disabled>🐞 Report bug</button><button class="btn small ghost" id="hint">💡 Hint</button><button class="btn small ghost" id="fin">🏁 Finish</button></div></div>
      <div class="panel" style="margin-top:14px"><h2>Bug report</h2><div role="log" aria-live="polite" aria-label="Bug report log"><ul id="log"></ul></div></div></aside></div>`;
    $('#app').setAttribute('role', 'group'); $('#app').setAttribute('aria-label', 'Page under test');
    const app = $('#app'), log = $('#log'), rep = $('#rep'), hint = $('#hint');
    let active, bugs, found, score, hints, sel, tm, running = false;
    const draw = (left = tm ? tm.left() : 0) => hud([`Bugs: ${found ? found.size : 0} / ${bugs ? bugs.length : 0}`, `Score: ${score || 0}`, clock(left)]);
    const addLog = (t, miss) => { log.querySelector('.empty')?.remove(); const li = document.createElement('li'); if (miss) li.className = 'miss'; li.textContent = (miss ? '✗ ' : '✓ ') + t; log.prepend(li); };
    const bugFor = el => { for (let n = el; n && n !== app; n = n.parentElement) { const b = bugs.find(b => b.els.includes(n.id)); if (b) return b; } };
    const clearSel = () => { sel?.classList.remove('sel-el'); sel = null; rep.disabled = true; };

    function inspect(el) {
      const r = el.getBoundingClientRect(), hasText = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
      const lines = [`<b>&lt;${el.tagName.toLowerCase()}&gt;</b>  ${Math.round(r.width)}×${Math.round(r.height)}px`];
      if (hasText) { const k = contrast(el); lines.push(`contrast <b>${k.toFixed(1)}:1</b> ${k >= 4.5 ? '(passes AA)' : '(below 4.5:1)'}`); }
      const info = el.closest('[data-info]')?.dataset.info; if (info) lines.push(info.replace(/</g, '&lt;'));
      $('#insp').innerHTML = lines.join('<br>');
    }
    function finish() {
      running = false; tm?.stop(); clearSel();
      const n = found.size, total = bugs.length, bonus = n === total ? (tm.left() || 0) : 0, [e, t] = rate(n / total, c.ratings);
      score += bonus;
      const missed = bugs.filter(b => !found.has(b.id));
      end(e, t, `You found ${n} of ${total} bugs. Final score: ${score}${bonus ? ` (includes +${bonus} time bonus)` : ''}.`,
        missed.length ? '<b>Missed:</b><ul>' + missed.map(b => `<li>${b.text}</li>`).join('') + '</ul>' : '', score);
    }
    const select = el => { clearSel(); sel = el; sel.classList.add('sel-el'); rep.disabled = false; inspect(sel); };
    app.addEventListener('click', e => { if (running && e.target !== app) select(e.target); });
    // Keyboard support: every element that has text or inspector info is reachable (roving tabindex + arrow keys)
    let targets = [];
    const hasOwnText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const focusTarget = el => { targets.forEach(t => { t.tabIndex = t === el ? 0 : -1; }); el.focus(); };
    const makeNavigable = () => {
      const ids = new Set(bugs.flatMap(b => b.els));
      targets = [...app.querySelectorAll('*')].filter(el => el.tagName !== 'STYLE' && el.tagName !== 'SCRIPT' && (hasOwnText(el) || el.dataset.info || ids.has(el.id)));
      targets.forEach((el, i) => { el.tabIndex = i === 0 ? 0 : -1; });
    };
    app.addEventListener('focusin', e => { if (targets.includes(e.target)) targets.forEach(t => { t.tabIndex = t === e.target ? 0 : -1; }); });
    app.addEventListener('keydown', e => {
      if (!running) return; const i = targets.indexOf(e.target); if (i < 0) return;
      const move = j => { e.preventDefault(); focusTarget(targets[Math.max(0, Math.min(targets.length - 1, j))]); };
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') move(i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') move(i - 1);
      else if (e.key === 'Home') move(0);
      else if (e.key === 'End') move(targets.length - 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(e.target); }
      else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); select(e.target); rep.click(); }
    });
    app.addEventListener('keyup', e => { if (e.key === ' ' && targets.includes(e.target)) e.preventDefault(); });
    rep.onclick = () => {
      if (!running || !sel) return;
      const bug = bugFor(sel), target = sel;
      if (bug) {
        if (found.has(bug.id)) addLog('Already reported: ' + bug.text, true);
        else { found.add(bug.id); score += 100; bug.els.forEach(id => document.getElementById(id).classList.add('found')); addLog(bug.text, false); }
      } else {
        score -= 25; target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
        addLog('Not a defect: ' + (target.textContent.trim().slice(0, 40) || target.tagName.toLowerCase()), true);
      }
      clearSel(); draw();
      if (found.size === bugs.length) finish();
    };
    $('#fin').onclick = () => { if (running) finish(); };
    hint.onclick = () => {
      if (!running || hints <= 0) return;
      const b = bugs.find(b => !found.has(b.id)); if (!b) return;
      hints--; score -= 50; const el = document.getElementById(b.els[0]); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 2600);
      hint.textContent = `💡 Hint (${hints})`; hint.disabled = hints <= 0; draw();
      if (targets.includes(el)) focusTarget(el);   // bring keyboard focus to the hinted element
    };
    onStart(lv => {
      const L = c.levels[lv]; active = new Set(L.bugs); bugs = c.bugs.filter(b => active.has(b.id));
      app.innerHTML = c.app(id => active.has(id));
      found = new Set(); score = 0; hints = L.hints; running = true; clearSel();
      log.innerHTML = '<li class="empty">No bugs reported yet.</li>';
      $('#insp').textContent = 'Click or focus any element on the page to inspect it, then report it if you think it is a defect.';
      hint.textContent = `💡 Hint (${hints})`; hint.disabled = hints <= 0;
      tm?.stop(); tm = timer(L.seconds, draw, finish);
      makeNavigable();
    });
  }
  return { $, LV, store, frame, hud, onStart, timer, clock, end, rate, hunt };
})();
