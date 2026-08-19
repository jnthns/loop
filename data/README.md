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
| `depth.json`    | `scripts/sync-depth.ts` (CI cron)         | NFL depth-chart rank per player. Opportunity, **not** talent. |
| `profiles.json` | a human, or the `roster-review` loop      | Cited scouting notes — role, fit, risk. Never synced. See below. |

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

## Depth charts — what `depth.json` is and is not

`depthRank` is nflverse's reading of the team's published chart: 1 is listed
first at the position, 2 second, and so on. It is an **opportunity** signal, not
a talent one, and camp charts are notoriously conservative — a rookie who will
open the season starting is often listed second in August. Treat a DC2 behind an
aging starter as a question to investigate, never as a verdict.

A player with no entry is *not listed*, which is different from being buried.
The app renders nothing in that case rather than inventing a rank.

## Where the data comes from, and what each source owes

The full registry is [`src/lib/data/sources.ts`](../src/lib/data/sources.ts) —
one entry per upstream, carrying its license, refresh cadence, what it provides,
and its caveat. It renders on `/picks` under "Where this data comes from", and
`tests/sources.test.ts` fails the build if any host is fetched from `scripts/`
or `src/lib/` without an entry. That is deliberate: provenance drift is silent,
and a registry nothing enforces is a registry that rots.

| Upstream | Provides | License | Stability |
| -------- | -------- | ------- | --------- |
| [DynastyProcess](https://github.com/dynastyprocess/data) | FantasyPros ECR + trade-value model | GPL-3.0 | Open dataset (~100★) |
| [nflverse](https://github.com/nflverse/nflverse-data) | Depth-chart rank | **CC-BY-4.0** | Open dataset (~380★) |
| [Sleeper](https://docs.sleeper.com/) | League, rosters, search rank, trending | Public keyless API | Official API |
| ESPN `site.api.espn.com` | Standings, injuries, news | No published terms | **Undocumented** |
| RSS (ESPN, PFT, CBS, Yahoo, 2 subreddits) | Headlines | Publisher syndication | Public feeds |

Three things a future pass should not have to rediscover:

- **nflverse is CC-BY-4.0, so attribution is a license term, not a courtesy.**
  It is discharged by rendering the credit on the page — a comment in the source
  does not satisfy a licence whose obligation runs to the reader. Every `DC1`
  badge in this app is nflverse data.
- **We do not read KeepTradeCut.** No request is ever made to keeptradecut.com.
  `ktc_id` is an id in DynastyProcess's crosswalk, used only to build deep links
  to KTC player pages. Do not describe KTC as a data source.
- **FantasyPros ECR and the DynastyProcess value are one opinion, not two.**
  DynastyProcess derives the value curve from that consensus; sorting the
  snapshot both ways puts 69.5% of players in the identical position. Sleeper's
  `search_rank` is the only independent ranking here.

## Scouting profiles — the only prose the picks page treats as fact

`profiles.json` is the qualitative half of a pick recommendation: what a
player's **role** actually is, how the **fit** helps or caps him, and the
specific **risk** that would make the pick wrong. Everything else the picks
page reads is a number a sync wrote, and numbers cannot say why.

Two rules are enforced by `src/lib/schemas/profiles.ts` and
`tests/schemas.test.ts`, not by good intentions:

- **Every profile cites at least one source.** The same gate the knowledge
  collection uses. A profile is a claim about the real world, and the loop can
  write these unattended.
- **Every profile carries an `asOf` date, and goes stale at 45 days.** Roles
  churn — an August camp split is a different fact in November. A profile that
  outlived its reporting fails the check loudly rather than quietly misleading
  the next pick.

Keep them short and *evergreen-ish*: role, scheme, risk. Do not restate a rank
or a value that `market.json` already carries — two sources of truth for the
same fact is how they start disagreeing.

## Player availability

`players.json` carries two fields straight from Sleeper, overwritten every sync:

- `status` — roster availability: `Active`, `Injured Reserve`, `PUP`, `Practice Squad`.
- `injuryStatus` — the weekly designation: `Questionable`, `Doubtful`, `Out`, `IR`.

Neither is ever inferred, and neither survives a sync that no longer reports it —
a stale `Out` that outlived the injury is worse than no designation at all.
