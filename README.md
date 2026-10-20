<div align="center">

# 🐞 yashwanth.dev

**A portfolio that tests you back.**

QA engineering · AI-driven test automation · tools that make testers' lives easier

`0 dependencies` · `0 build steps` · `11 playable QA games` · `3 mock interviews`

</div>

---

## 🧪 What's inside

A single-page portfolio, plus a small arcade of hands-on testing games. Nothing here is a quiz: you send requests, inspect elements, run load tests and drag bugs around.

| | Game | Testing skill | What you actually do |
|---|---|---|---|
| 🐞 | Bug Hunt | Functional & UI | Inspect a checkout page, report real defects |
| 🔌 | API Lab | API testing | Fire requests at a mock API, catch bad responses |
| 📏 | Boundary Lab | Boundary value analysis | Type edge values, expose off-by-one validators |
| 🛡️ | Security Lab | Security | Break a demo app, then pick the right fix |
| ⚡ | Perf Lab | Performance | Run load tests, read metrics, find the bottleneck |
| 🎲 | Flaky Test Hunt | Automation reliability | Re-run a suite, spot flaky vs broken vs infra |
| ♿ | Accessibility Audit | Accessibility | Check contrast, labels, touch targets, focus |
| 📡 | Regression Radar | Risk-based regression | Spend a test budget to pin down the culprit |
| 🗄️ | Data Detective | Data testing | Find rows that violate the table's constraints |
| 🧩 | Pairwise Puzzle | Combinatorial testing | Cover every pair in the fewest runs |
| 🚑 | Bug Triage Board | Test management | Plan a sprint by dragging bugs into columns |

Every game has **Easy / Medium / Hard**, and best scores are kept in your browser's `localStorage`.

### 💬 Prompt library

`prompts.html` is a searchable, filterable library of 82 prompts written for AI coding assistants and LLM-enabled IDEs. They tell the assistant what to read in your repo, what to build, which commands to run and how to prove the result.

- **Filters:** category, mode (**Agent** reads, edits and runs things; **Analysis** only produces findings or documents) and **tool**, limited to the tools used in this profile: Playwright, Selenium, TestNG, Cucumber, REST Assured, Postman, Bruno, JMeter, SoapUI, axe-core, Chrome DevTools, SonarQube, Snyk, Trivy, Docker, GitLab CI, Git, Jira and Zephyr.
- **Accessibility:** 14 prompts covering keyboard testing, colour contrast, forms, ARIA widgets, screen reader scripts, axe-core automation and triage, reflow and zoom, DevTools-based manual testing, acceptance criteria and a conformance summary.
- **Fill in values:** type your own paths and commands into a prompt and copy the finished text.
- **Guardrails:** a safety block (stop and warn on secrets or personal data, stay on local or test environments, ask before risky actions, never weaken tests) is appended to every copied prompt, and can be turned off.
- **Secret scanner:** anything typed into the page is checked in the browser for API keys, tokens, private keys, passwords, card numbers and similar. If something looks real, the page asks the user to revoke or rotate it, blocks copying until it is replaced with an environment variable or placeholder, and never stores it, sends it anywhere or puts it in the URL.
- **Shareable links:** `prompts.html?q=flaky&mode=agent&tool=Playwright`.

### 🎯 Interview Mode

Three mock technical rounds, each chaining three games into one timed assessment with a scorecard and a hiring verdict:

- **QA Engineer · Screening**: Bug Hunt → Boundary Lab → API Lab
- **SDET · Technical**: API Lab → Flaky Test Hunt → Security Lab
- **QA Lead · Strategy**: Regression Radar → Bug Triage Board → Perf Lab

## 🧪 Tests

The site has no build step, but it is tested like a product. The suite uses [Playwright](https://playwright.dev) with [axe-core](https://github.com/dequelabs/axe-core), runs on desktop and a phone-sized viewport, and covers:

- **Accessibility:** axe-core (WCAG 2.2 A and AA) on every page in light and dark mode, and on the start, in-play and end state of every game
- **Keyboard use:** every game can be started, played and finished without a mouse; dialogs trap focus and are modal; focus is always visible; the inspector games use arrow keys, Enter to inspect and R to report
- **Gameplay:** each game is played to a correct result, scoring rules, levels, timers and saved scores are checked, and interview mode produces the right scorecard
- **Prompt library:** search, filters, tool list, guardrails on copy, and the secret scanner (it must block real-looking secrets and must not flag placeholders)
- **Site quality:** no console errors, working internal links, no horizontal scrolling on phones, and repository hygiene (no secrets, no personal phone number)

```bash
npm install
npx playwright install chromium   # once
npm test                          # whole suite (starts a local server)
npm run test:a11y                 # only the axe-core checks
npm run test:keyboard             # only the keyboard tests
npm run report                    # open the last HTML report
```

The suite also runs on every push through GitHub Actions (`.github/workflows/test.yml`).

## 🗺️ Repo map

```text
.
├── index.html            the portfolio
├── prompts.html          searchable library of prompts for testing
├── 404.html              a 404 that admits it is a bug
├── game/                 old Bug Hunt URL (redirects)
├── tests/                Playwright + axe-core tests (accessibility, keyboard, gameplay, prompts, site)
├── playwright.config.js  test configuration
└── games/
    ├── index.html        the arcade hub (+ saved best scores)
    ├── interview.html    interview runner + scorecard
    ├── shared.js         engine: levels, timer, scoring, inspector hunt
    ├── shared.css        one design system for every game
    └── *.html            one self-contained file per game
```

## 🚀 Run it

No build and no install are needed to view the site:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## ➕ Add your own game

1. Create `games/yourgame.html` (copy any small one, e.g. `pairwise.html`).
2. Call `QA.frame({ id, emoji, title, aspect, intro, levelInfo, max })`, then `QA.onStart(level => { … })`.
3. Finish with `QA.end(emoji, title, text, extraHtml, score)`. Scores are saved and interview mode picks them up automatically.
4. Add one line to the `G` array in `games/index.html`.

For a "click the bug" game, skip steps 2 and 3 and use `QA.hunt({...})`; it brings the inspector, hints, and timer for free.

## 🌐 Deploy

Push to GitHub, then **Settings → Pages → Deploy from a branch → `main` / root**. For a custom domain, add a `CNAME` file containing the domain.

---

<div align="center">

Built by [Yashwanth Reddy](https://github.com/kyashwanth). If you find a bug in this repo, that is the game working as intended. 🐛

</div>
