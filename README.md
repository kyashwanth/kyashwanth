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

### 🎯 Interview Mode

Three mock technical rounds, each chaining three games into one timed assessment with a scorecard and a hiring verdict:

- **QA Engineer · Screening**: Bug Hunt → Boundary Lab → API Lab
- **SDET · Technical**: API Lab → Flaky Test Hunt → Security Lab
- **QA Lead · Strategy**: Regression Radar → Bug Triage Board → Perf Lab

## 🗺️ Repo map

```text
.
├── index.html            the portfolio
├── 404.html              a 404 that admits it is a bug
├── game/                 old Bug Hunt URL (redirects)
└── games/
    ├── index.html        the arcade hub (+ saved best scores)
    ├── interview.html    interview runner + scorecard
    ├── shared.js         engine: levels, timer, scoring, inspector hunt
    ├── shared.css        one design system for every game
    └── *.html            one self-contained file per game
```

## 🚀 Run it

No build, no install:

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
