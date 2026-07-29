# Product Spec — SOURCE OF TRUTH

> This is the single most important file in the repo. The loop reads it fresh on
> every pass. If a fact isn't here (or in a file this links to), the agent does
> not know it. Keep it precise, current, and free of secrets.

---

## 1. One-line summary

A dynasty fantasy football guide that compounds: RSS news is gathered on a
schedule, the loop files what matters into a durable knowledge base organized by
facet, and everything is cross-referenced against one real roster — with a news
panel visible on every page, a team page (roster + alternatives + budgets), and a
knowledge library that grows every pass.

## 2. Problem & users

- **Problem:** Dynasty fantasy football rewards accumulated context — player
  ages, depth-chart and contract moves, rookie classes, trade windows, league
  format effects. That context is scattered across feeds and forgotten between
  sessions. A redraft mental model loses in dynasty.
- **Primary user:** A single owner playing dynasty for the first time, with a
  poor redraft track record, who wants organized knowledge more than pretty
  charts — and wants it to improve over time without manual upkeep.
- **What they can do today without it:** Read social feeds and fantasy sites ad
  hoc, re-learning the same lessons each season with nothing durable retained.

## 3. Goals (measurable)

1. A **news panel is present on every page**, rendering the newest items from
   `data/news.json` with source and timestamp.
2. `scripts/fetch-news.ts` turns the feed registry in `data/feeds.json` into a
   **schema-valid, deduped `data/news.json`**, and runs **offline against
   fixtures** (`--fixtures`) so the build never needs network.
3. A **`/team` page** renders the roster by slot from `data/team.json`, shows
   **alternative players per slot**, and exposes **editable budget ledgers**
   (auction/cap and FAAB), persisting edits to `localStorage` with JSON export.
4. A **`/knowledge` library** organized by **facet**, with per-facet index pages
   and article pages showing `sources`, `confidence`, and `updated`.
5. Every knowledge article carries **at least one entry in `sources[]`** — a test
   fails the build otherwise. No uncited claims.
6. The **dashboard (`/`)** cross-references `data/team.json` against
   `data/news.json` and surfaces news items touching **rostered or targeted
   players**.
7. All committed data files **validate against their Zod schemas at build time**;
   invalid data fails `scripts/check.sh`.
8. `scripts/check.sh` exits 0 (typecheck + test + build).

## 4. Non-goals (explicitly out of scope)

- Live scoring, lineup optimizers, or projection engines.
- Accounts, auth, multi-user, or cloud sync — one owner, one repo.
- Any runtime LLM call or API key. The loop is the intelligence; the repo is the
  database. The shipped site is static and calls nothing at runtime.
- Automated ESPN/Yahoo league import (both need authenticated endpoints). A
  public, keyless **Sleeper** adapter is optional and additive.
- Heavy visual design, illustration, or animation. Information density wins.

## 5. Constraints & decisions

- **Tech stack:** Astro 7 (static output), `@astrojs/react` islands, Tailwind v4
  (`@tailwindcss/vite`), TypeScript strict (pinned to v6 — `@astrojs/check` does
  not accept v7 yet), Zod 4, Vitest 4 + `@testing-library/react`,
  `fast-xml-parser`. No animation library.
- **Runtime/deploy target:** GitHub Pages. `astro.config.mjs` sets
  `site: 'https://jnthns.github.io'` and `base: '/loop'` — the Pages URL is
  project-scoped, so every internal link goes through `import.meta.env.BASE_URL`.
  Push to `main` runs `.github/workflows/pages.yml` (check → build → deploy).
- **News freshness:** committed snapshot + CI cron.
  `.github/workflows/news.yml` runs the fetch on a schedule, commits
  `data/news.json` only when it changed, and that push redeploys Pages.
  **Builds must never require network** — sandboxes and forks block egress.
- **Data location:** `data/*.json` is committed and is the source of truth, so
  the loop can read the real roster and tailor advice. The UI writes edits to
  `localStorage` as an overlay and offers export back to JSON.
- **Secrets:** none. No API key is required to build, test, or run the app.
- **Explicit trade-offs:** committed news snapshot (hermetic, testable, one cron
  of staleness) over live client fetch (fresher, but needs a CORS proxy and
  breaks the no-backend property); manual roster entry (works on any platform)
  over platform lock-in.

## 6. Acceptance criteria (the contract the loop grades against)

| #  | End state (done means...)                                        | Evidence (how the check proves it)                                       |
| -- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1  | News panel renders on every route                                | Component test on `NewsPanel` + layout test asserting it in the shell     |
| 2  | Feed parser turns RSS **and** Atom XML into schema-valid items    | Unit test over `tests/fixtures/*.xml` (offline)                          |
| 3  | News items dedupe by stable id across repeated fetches            | Unit test: merging the same fixture twice yields no duplicate ids         |
| 4  | `/team` renders every roster slot in `data/team.json`             | Component test: one row per slot, starters and bench grouped             |
| 5  | Each slot lists alternative/target players with rationale         | Component test: targets render under their slot                          |
| 6  | Budgets are editable; remaining = total − allocated               | Unit test on budget math + component test on edit                        |
| 7  | Team edits persist across reload and export as valid JSON         | Test: localStorage round-trip parses against `TeamSchema`                |
| 8  | Knowledge articles grouped by facet with index + detail routes    | Route test: each facet page lists only its own articles                  |
| 9  | Every knowledge article has ≥1 source                             | Content test over the collection; a bare article fails the build          |
| 10 | Dashboard flags news mentioning rostered/targeted players         | Unit test on the cross-reference selector with fixture data              |
| 11 | All `data/*.json` validate at build                               | Schema tests; malformed fixture fails                                    |
| 12 | Base path applied to every internal link                          | Build output uses `/loop/`-prefixed hrefs; no root-absolute app links    |
| 13 | `scripts/check.sh` exits 0                                        | Real check output pasted into `specs/STATUS.md`                          |

## 7. Knowledge facets (the organizing spine)

Articles live at `src/content/knowledge/<facet>/<slug>.md`. The facet list is
fixed in `src/lib/knowledge/facets.ts` so the loop cannot invent categories:

| Facet                  | Covers                                                                   |
| ---------------------- | ------------------------------------------------------------------------ |
| `roster-construction`  | Age curves, positional value, roster shape, superflex/TE-premium effects |
| `startup-drafts`       | Startup draft and auction strategy, pick-vs-player, tier drafting        |
| `rookie-drafts`        | Rookie pick value, prospect evaluation, landing spot, draft capital      |
| `trading`              | Value frameworks, buy-low/sell-high windows, negotiation, pick trading   |
| `contend-vs-rebuild`   | Diagnosing your window, pivoting, the cost of the middle                 |
| `in-season-management` | FAAB, waivers, taxi/IR, streaming, bye planning                          |
| `league-settings`      | Scoring, roster slots, format effects on strategy                        |
| `player-evaluation`    | Archetypes, metrics that carry, aging by position, injury context        |
| `lessons-learned`      | This owner's own mistakes and corrections — the compounding log          |

Frontmatter contract: `title`, `facet`, `tags[]`, `confidence`
(`low` | `medium` | `high`), `updated` (date), `sources[]` (≥1 `{label, url}`).

## 8. Data contracts

Schemas live in `src/lib/schemas/`; every file below is validated at build.

- `data/feeds.json` — `{ id, name, url, category }[]`
- `data/news.json` — `{ id, title, url, source, publishedAt, summary, tags[], players[], teams[] }[]`
- `data/players.json` — `{ id, name, pos, nflTeam, age, tier, notes }[]`
- `data/team.json` — `{ leagueName, format: { teams, superflex, ppr, tePremium, rosterSlots[] }, roster[], targets[], budgets[] }`
- `data/insights.json` — dated briefings from the roster-review loop; every
  suggestion cites an existing news or article id.

## 9. Loops that grow this app

| Loop                         | Trigger       | One bounded action per pass                                       |
| ---------------------------- | ------------- | ----------------------------------------------------------------- |
| `loops/build.md`             | manual        | Implement the next unchecked task in `specs/PLAN.md`              |
| `loops/news-refresh.md`      | cron          | Fetch feeds, dedupe, tag, commit `data/news.json`                 |
| `loops/knowledge-curator.md` | after refresh | Write or update **one** article in the thinnest/stalest facet     |
| `loops/roster-review.md`     | weekly        | Cross-reference roster × news × knowledge into `data/insights.json` |

## 10. Definition of done (whole build)

- Every task in `specs/PLAN.md` is checked `- [x]`.
- Every acceptance criterion in §6 has passing evidence.
- `scripts/check.sh` exits 0 and the `checker` subagent approves.
- `specs/STATUS.md` contains the line `ALL TASKS DONE`.

## 11. Open questions / assumptions

- League platform unconfirmed: manual roster entry is the primary path; a
  keyless Sleeper adapter is optional and additive.
- Seed `data/team.json` uses a 12-team superflex, 1 PPR league as the default
  format until the real league settings are supplied.
- Two budget ledgers seeded: one `auction` (startup cap) and one `faab`.
- Seed roster and player rows are placeholders; the owner replaces them, and the
  loop keeps advice consistent with whatever is committed.
