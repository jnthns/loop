# `data/` — the app's database

Every file here is committed, schema-validated at build time
(`src/lib/schemas/`), and read by both the site and the loop. There is no
runtime API: if a fact is not in this directory or in
`src/content/knowledge/`, the app does not know it.

| File            | Written by                           | Notes                                                     |
| --------------- | ------------------------------------ | --------------------------------------------------------- |
| `feeds.json`    | a human                              | RSS/Atom registry. Set `enabled: false` to park a feed.    |
| `news.json`     | `scripts/fetch-news.ts` (CI cron)    | Normalized, deduped items. Do not hand-edit.               |
| `players.json`  | a human, or the Sleeper adapter      | Player reference rows.                                     |
| `team.json`     | a human (or the UI's JSON export)    | Roster, targets, budgets, league format.                   |
| `insights.json` | the `roster-review` loop             | Dated briefings; every suggestion cites news or knowledge. |

## Seed data provenance — read this before trusting it

`players.json` and `team.json` ship with **placeholder seed data** so the app has
something to render on day one. It is a starting point, not a source of truth:

- Player ages are stated as of the **2026 season**, and NFL teams reflect the
  **2025 season**. Both drift. Verify before acting on anything.
- The `notes` field holds *evergreen* context — archetype, aging profile, what
  drives the player's dynasty value — deliberately, not week-to-week stats,
  which would be stale the moment they were written.
- The roster, targets, and budget entries are illustrative. Replace them with
  your actual league.
- `format` assumes a **12-team superflex, 1 PPR, 0.5 TE-premium** league. If
  yours differs, change it first — nearly every piece of advice the loop
  generates keys off these settings.

Replacing the seed is the highest-value thing a human can do in this repo: the
loop's suggestions are only as good as the roster it can see.
