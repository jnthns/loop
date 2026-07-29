# Architecture — dynasty fantasy football guide

Companion to [`specs/spec.md`](../specs/spec.md) (the contract). This file covers
*how* the app is put together: layout, data flow, directory shape, and the
constraints that shaped them.

---

## 1. The core idea

The app is a **knowledge database with a UI**, not a service. Nothing is fetched
at runtime. Every fact the site shows is a file in the repo, and the loop's job is
to improve those files on a schedule:

```
RSS + ESPN API ──(CI cron)──► scripts/fetch-news.ts ──► data/news.json ────┐
Sleeper API ─────(CI cron)──► scripts/sync-sleeper.ts ─► data/team.json    │
                                                        data/players.json  ├──► static build ──► Pages
                                                        data/trending.json │
knowledge-curator loop ─────► src/content/knowledge/<facet>/*.md ──────────┤
roster-review loop ─────────► data/insights.json ──────────────────────────┘
```

Every external API used is **free and keyless** — Sleeper's read API and ESPN's
public JSON news endpoint both need no token, which is why this repo has no
secrets at all.

Three consequences worth internalizing:

1. **The build is hermetic.** No network at build time, so it works in sandboxes,
   forks, and offline. Tests run against XML fixtures, not live feeds.
2. **No secrets exist.** Nothing to leak, nothing to rotate, nothing to gate CI on.
3. **The loop's output is reviewable as a diff.** Every "the app got smarter" event
   is a commit you can read, revert, or argue with.

## 2. Layout

One shell, three regions, on every route:

```
┌──────────┬────────────────────────────────────┬──────────────────┐
│ nav rail │ main column                        │ news panel       │
│          │                                    │ (persistent)     │
│ Dashboard│  page content — dense, typographic │ ── newest first  │
│ Team     │  tables and definition lists over  │ source · time    │
│ Knowledge│  cards; hierarchy carried by type  │ tag chips        │
│ News     │  and rule weight, not color        │                  │
└──────────┴────────────────────────────────────┴──────────────────┘
```

Below `lg`, the nav rail collapses to a top bar and the news panel becomes a
toggleable drawer. The panel is a React island (it filters and re-renders); the
rest of each page is static Astro.

**Design posture:** information density over decoration. A restrained neutral
palette with a single accent, one type family, tabular numerals for anything
numeric, and `prefers-color-scheme` for dark mode. No animation library.

## 3. Routes

| Route                            | Rendering        | Purpose                                                       |
| -------------------------------- | ---------------- | ------------------------------------------------------------- |
| `/`                              | static + island  | Dashboard: digest, roster alerts, stale-knowledge nudges      |
| `/team`                          | island           | Roster by slot, alternatives per slot, budget ledgers         |
| `/knowledge`                     | static           | Facet index — counts, last-updated, coverage gaps             |
| `/knowledge/[facet]`             | static           | Articles in one facet                                         |
| `/knowledge/[facet]/[slug]`      | static           | Article + sources, confidence, updated date                   |
| `/news`                          | static + island  | Full archive with source/tag/team filters                     |
| `/progress`                      | static           | Plan progress, backlog queue, recorded passes                 |

## 4. Directory shape

```
data/                      committed app data (the database)
  feeds.json               RSS/Atom registry
  news.json                normalized, deduped news items
  players.json             player reference rows
  team.json                roster, targets, budgets, league format
  insights.json            dated briefings from the roster-review loop
src/
  components/              React islands (NewsPanel, RosterTable, BudgetLedger, …)
  layouts/BaseLayout.astro the three-region shell
  pages/                   routes (see above)
  content/knowledge/       one directory per facet, markdown articles
  lib/
    schemas/               Zod schemas — one per data file
    data/                  typed loaders that parse at import time
    news/                  feed parsing + merge/dedupe
    knowledge/facets.ts    the fixed facet list
    insights/              roster × news cross-reference
scripts/fetch-news.ts      the only thing that touches the network
tests/fixtures/            rss.xml, atom.xml, and data fixtures
```

## 5. Data flow rules

- **Parse at the boundary.** `src/lib/data/*` validates with Zod at import time,
  so a malformed `data/*.json` fails the build rather than rendering wrong.
- **Stable ids.** A news item's id is derived from its canonical URL, so refetching
  the same story never duplicates it and cross-references stay valid across passes.
- **The overlay pattern.** `data/team.json` is the committed baseline; the UI
  writes edits to `localStorage` and can export them back to JSON. The loop only
  ever sees the committed file, which is what keeps its advice auditable.
- **Citations are structural.** `sources[]` is required frontmatter, enforced by a
  test. An agent cannot quietly add a claim it made up.

## 6. Deployment

GitHub Pages, project-scoped at `https://jnthns.github.io/loop/`. That means
`base: '/loop'` in `astro.config.mjs`, and **every internal link resolves through
`import.meta.env.BASE_URL`** — the single most likely deploy-only breakage.

- `.github/workflows/pages.yml` — on push to `main`: `scripts/check.sh`, build,
  deploy `dist/`.
- `.github/workflows/refresh.yml` — on a 6-hourly cron: sync Sleeper, fetch news,
  run the check, and commit only what changed under `data/`. That push triggers
  `pages.yml`, so a data refresh and a deploy are one pipeline.
- `.github/workflows/verify.yml` — on every push and PR: the same
  `scripts/check.sh` the loop runs.

All three install dependencies **before** running `scripts/check.sh`. That
ordering is not incidental: the check auto-detects `package.json` and shells out
to `astro`, so without `npm ci` first it exits 127 and CI reports a failure that
looks like a code problem.

## 7. Why not the obvious alternatives

| Choice                        | Rejected alternative                     | Reason                                                                 |
| ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------- |
| Committed news snapshot       | Live client-side fetch via CORS proxy    | Adds a service to run, breaks the no-backend property, untestable offline |
| Committed news snapshot       | Fetch during the Astro build             | Build fails wherever egress is blocked; news only updates on deploy      |
| Committed `data/team.json`    | localStorage only                        | The loop could not see the roster, so all advice would stay generic      |
| Markdown content collection   | A knowledge table in JSON                | Prose needs review as prose; markdown diffs are readable                 |
| No runtime LLM                | Server-side model call per page          | Requires a key, a backend, and makes output unauditable                  |
