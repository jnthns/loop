# `data/` — the app's database

Every file here is committed, schema-validated at build time
(`src/lib/schemas/`), and read by both the site and the loop. There is no
runtime API: if a fact is not in this directory or in
`src/content/knowledge/`, the app does not know it.

| File            | Written by                                | Notes                                                      |
| --------------- | ----------------------------------------- | ---------------------------------------------------------- |
| `sleeper.json`  | a human, then filled in by the sync       | Which league to track. No secrets — Sleeper's API is keyless. |
| `feeds.json`    | a human                                   | RSS/Atom registry. Set `enabled: false` to park a feed.     |
| `news.json`     | `scripts/fetch-news.ts` (CI cron)         | Normalized, deduped items. Do not hand-edit.                |
| `players.json`  | `scripts/sync-sleeper.ts` (CI cron)       | Only players that matter; `tier` and `notes` survive a sync.|
| `team.json`     | Sleeper for roster/format/FAAB; you for the rest | See the ownership split below.                       |
| `trending.json` | `scripts/sync-sleeper.ts` (CI cron)       | League-wide add/drop counts. Market signal, **not news**.   |
| `insights.json` | the `roster-review` loop                  | Dated briefings; every suggestion cites news or knowledge.  |

## Who owns what in `team.json`

The sync overwrites only what Sleeper genuinely knows. Everything you wrote by
hand survives — an automated job deleting your own prose would make the file
untrustworthy, and an untrustworthy roster makes every downstream suggestion
worthless.

| Sleeper owns (overwritten every sync) | You own (never touched)                    |
| ------------------------------------- | ------------------------------------------ |
| `format` — slots, teams, PPR, TE premium | `targets[]` — rationale and cost         |
| `roster[]` player assignments          | per-slot `notes` (when the player is unchanged) |
| the `faab` budget total and spend       | the `auction` budget, entirely             |

A target whose player you have since acquired is **reported, not deleted** — the
sync tells you, and pruning it stays your call.

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
