---
name: curate-knowledge
description: Write or revise exactly one article in the dynasty knowledge base — sourced, filed under a real facet, and honest about confidence. Use when running the knowledge-curator loop or adding any prose to src/content/knowledge/.
---

# Skill: curate-knowledge

Write or revise one article in the dynasty knowledge base so that it is useful,
sourced, and filed where a reader will find it.

**Use when:** running `loops/knowledge-curator.md`, or any time you are about to
add prose to `src/content/knowledge/`.

## Why this is a skill

Writing into an unattended library is the highest-risk writing in the repo:
nobody reviews it before it ships, and confidently-worded invention is
indistinguishable from knowledge at a glance. The steps below are what make the
output trustworthy rather than merely fluent.

## Steps

1. **Pick the gap, not the topic.** Empty facets first, then the facet whose
   newest article is oldest. The dashboard's "Knowledge gaps" panel computes
   exactly this ordering (`src/lib/insights/cross-reference.ts`).
2. **Gather sources before writing a sentence, and match the citation to the
   claim.** A time-sensitive, player-specific claim (injury, depth chart, camp
   battle, transaction) needs the exact `data/news.json` item, by URL — never
   assert one of these from training knowledge, which may already be stale or
   wrong. A general, evergreen claim (age curves, positional value, format
   math) may cite stable reference sources instead. If you cannot find a
   source for a claim, you have found a reason not to write that sentence —
   write the reasoning without it, or leave it out.
3. **Draft the decision, then the reasoning.** Lead with what a manager should
   do; explain second. An article that is all context is a blog post, not a
   playbook entry.
4. **State the condition where it breaks.** Every heuristic has one. Naming it
   is what separates advice from folklore.
5. **Set `confidence` honestly.** `high` means well-established across sources;
   `medium` means reasonable and contested; `low` means one perspective or a
   first draft. Confidence goes *down* when a source contradicts you.
6. **Fill the frontmatter completely** — `title`, `facet` (must match the
   directory), `summary`, `tags`, `confidence`, `updated` (today), `sources`
   (≥1, each with a real URL). If the article's value depends on current news
   rather than durable strategy, add the `time-sensitive` tag and set `asOf`
   to today — `tests/knowledge.test.ts` fails the build once `asOf` passes
   45 days, so a stale draft article cannot silently survive into next season.
7. **Run `scripts/check.sh`.** `tests/knowledge.test.ts` enforces the source
   requirement, the facet whitelist, and the directory match.
8. **Commit the single markdown file** with an imperative message naming the
   facet.

## Hard rules

- **Never write an uncited claim.** The build rejects it, and it should.
- **Never invent a statistic, transaction, injury, or quote.** If the source
  does not say it, write the reasoning without the number.
- **Never assert a player-specific, time-sensitive fact from memory.** These
  change constantly and your training knowledge may already be wrong; the
  archive item is the only acceptable citation for one.
- **Never invent a facet.** `src/lib/knowledge/facets.ts` is closed by design.
- **One article per pass.** A five-file diff cannot be reviewed as prose.
- **Prefer stopping to filling.** An empty facet is honest; a padded article is
  a lie with a citation stapled to it.
- **If an article mixes cited fact and general judgement, say so in prose** —
  a short "what's cited vs what's judgement" section — so a reader knows which
  sentences to verify before acting and which are reasoning to weigh.

## Frontmatter template

```yaml
---
title: <the question this answers, phrased as a claim>
facet: <one of the ids in src/lib/knowledge/facets.ts>
summary: >-
  <two lines: the decision this article supports>
tags: [<3-5 tags>]              # add `time-sensitive` if news-dependent
confidence: low | medium | high
updated: YYYY-MM-DD
asOf: YYYY-MM-DD                # required when tagged time-sensitive
sources:
  - label: <what it is>
    url: <where it is>
---
```

## Related

- `loops/knowledge-curator.md` — the loop this skill runs inside.
- `skills/commit-atomically/SKILL.md` — one logical change per commit.
- `skills/run-checks/SKILL.md` — never weaken the check to go green.
