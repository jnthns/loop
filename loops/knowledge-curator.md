# Loop: knowledge-curator

Turns a stream of news into a library. One article per pass — written or
revised, never both, never several — so every change is reviewable as prose by a
human who was not there when it was written.

This is the loop that makes the app compound. Everything else displays data;
this one adds understanding.

## Contract

- **End state (done means):** exactly one article in `src/content/knowledge/`
  has been created or materially revised, it cites at least one source, and its
  `updated` date is today.
- **Evidence required:** `scripts/check.sh` exits 0 (the knowledge tests enforce
  the source requirement, the facet whitelist, and the directory/frontmatter
  match); `git diff --stat` shows one markdown file.
- **Constraints (must hold):**
  - **Never write an uncited claim.** Every article needs ≥1 `sources[]` entry.
  - **Never invent a statistic.** If a number is not in a cited source, do not
    write the number. Write the reasoning instead.
  - **Never invent a facet.** The list in `src/lib/knowledge/facets.ts` is closed;
    adding to it is a deliberate human edit.
  - Do not touch `data/`, `src/pages/`, or any component. Prose only.
  - **The citation a claim needs depends on what kind of claim it is:**
    - **Time-sensitive, player-specific** (an injury, a depth-chart or camp-battle
      status, a transaction, "X is now Y's starter") — cite the exact
      `data/news.json` item by URL, and check its `publishedAt`. Never assert
      one of these from training knowledge: it may be stale, wrong, or have
      already changed by the time this runs. If the archive has no item for it,
      do not write the claim.
    - **Evergreen, general** (age curves, positional value, format math, named
      build archetypes) — cite reference sources (Sleeper, FantasyPros,
      KeepTradeCut, r/DynastyFF, etc.) and mark `confidence` accordingly.
      `confidence: high` needs settled reasoning across sources, not a hunch.
    - An article that mixes both should say so in prose (see
      `startup-drafts/2026-offseason-landscape.md` for the pattern: a
      "what's cited vs what's judgement" section) so a reader can tell which
      sentence to trust further and which to verify before drafting on it.
  - **Tag `time-sensitive` and set `asOf` to today** on any article whose value
    depends on current news rather than durable strategy.
    `tests/knowledge.test.ts` fails the build once `asOf` is more than 45 days
    old — that is deliberate: a dated article silently rotting into next
    season is worse than no article, so let the rot fail loudly instead.
- **Budget:** one article per pass. Stop after it.

## The five parts

| Part        | This loop's answer                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------ |
| **Trigger** | After a `news-refresh` pass that changed the snapshot, or manually.                                     |
| **Inputs**  | `data/news.json`, `src/content/knowledge/**`, the coverage gaps the dashboard computes, `specs/spec.md`. |
| **Action**  | Write or revise **one** article in the emptiest, then stalest, facet.                                    |
| **Check**   | `scripts/check.sh` — `tests/knowledge.test.ts` fails the build on an uncited or misfiled article.        |
| **Stop**    | Article committed ✅ / nothing new to say 🟰 / a claim cannot be sourced 🙋 / budget 🛑                     |

## Prompt (run each pass)

> Read `AGENTS.md`, then `specs/spec.md` §7 for the facet definitions.
>
> Pick the target facet the way the dashboard does: **empty facets first, then
> the one whose newest article is oldest.** Do not pick the facet you find most
> interesting — the gap is the point.
>
> Read the recent items in `data/news.json`. Decide whether they change anything
> a reader of that facet should know.
>
> - If they do, revise the existing article: add what changed, cite the news
>   items you used by URL, bump `updated` (and `asOf` if the article is tagged
>   `time-sensitive`), and adjust `confidence` honestly. Confidence goes
>   **down** when a source contradicts what you wrote before.
> - If the facet is empty, write the article that a first-year dynasty manager
>   would need first. Prefer decision rules over descriptions.
> - If you have nothing to add that is grounded in a source, **stop and change
>   nothing.** An empty pass is a real outcome; filler is worse than a gap.
>
> Run `scripts/check.sh`. On green, commit the single markdown file with an
> imperative message naming the facet, rewrite `memory/handoff.md`, and stop.

## Quality bar

An article earns its place if a reader can act on it. Concretely:

- It answers a question a manager actually asks ("do I sell this back?"), not a
  topic ("running backs").
- It states the heuristic *and* the condition where the heuristic breaks.
- It distinguishes what is well-established from what is one analyst's opinion,
  and sets `confidence` to match.
- It does not repeat another article. Link the reasoning instead of restating it.

## Hard stops (unattended runs)

- Max iterations: `${MAX_ITERATIONS}` — but one article per pass, always.
- No-progress: halt after `${MAX_NO_PROGRESS}` passes that produce no commit.
- Budget: `${BUDGET_USD}`.
