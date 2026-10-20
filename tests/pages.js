// Every page and game in the site, shared by the test files.
const GAMES = [
  { file: 'bughunt', name: 'Bug Hunt', kind: 'hunt' },
  { file: 'a11y', name: 'Accessibility Audit', kind: 'hunt' },
  { file: 'data', name: 'Data Detective', kind: 'hunt' },
  { file: 'api', name: 'API Lab', kind: 'lab' },
  { file: 'boundary', name: 'Boundary Lab', kind: 'lab' },
  { file: 'security', name: 'Security Lab', kind: 'lab' },
  { file: 'perf', name: 'Perf Lab', kind: 'lab' },
  { file: 'flaky', name: 'Flaky Test Hunt', kind: 'lab' },
  { file: 'regression', name: 'Regression Radar', kind: 'lab' },
  { file: 'triage', name: 'Bug Triage Board', kind: 'lab' },
  { file: 'pairwise', name: 'Pairwise Puzzle', kind: 'lab' }
];
const SITE_PAGES = [
  { path: '/index.html', name: 'Home' },
  { path: '/prompts.html', name: 'Prompts' },
  { path: '/404.html', name: '404' },
  { path: '/games/index.html', name: 'Games hub' },
  { path: '/games/interview.html', name: 'Interview mode' }
];
module.exports = { GAMES, SITE_PAGES };
