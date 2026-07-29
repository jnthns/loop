# loop

A **loop-engineered workspace** — a fully-harnessed system for building software
with autonomous coding agents, safely and verifiably.

The app being built is a **dynasty fantasy football guide** — a knowledge base
that compounds. RSS news is gathered on a schedule, the loop files what matters
into articles organized by facet, and everything is cross-referenced against one
real roster. A news panel sits on every page; `/team` holds the roster,
alternative targets, and editable budgets; `/knowledge` is the library that grows.

- Product spec: [`specs/spec.md`](specs/spec.md)
- Task checklist: [`specs/PLAN.md`](specs/PLAN.md)
- Architecture (layout, data flow, deployment): [`docs/architecture.md`](docs/architecture.md)

## App — quick start

```bash
npm install
npm run dev                   # http://localhost:4321/loop/
npm run news:fetch            # refresh data/news.json from data/feeds.json
```

**No API keys.** The site is static and calls nothing at runtime — the loop is the
intelligence and the repo is the database. News is fetched by a scheduled GitHub
Action and committed as `data/news.json`, so **the build never needs network**.

**Mechanical check** (lint, typecheck, test, build — same as CI):

```bash
scripts/check.sh
```

> A loop is a task with a check. A task without a check is just hope.

This synthesizes the established teachings of agentic / loop engineering: Geoffrey
Huntley's **Ralph technique**, Addy Osmani's **loop engineering**, Boris Cherny
and Peter Steinberger ("write loops, not prompts"), Simon Willison's agentic/TDD
patterns, and the community **Loop Library**. See [`docs/`](docs/).

## The loop every pass runs

```
OBSERVE → ACT → CHECK → DECIDE → HANDOFF
```

Read fresh state from disk → make one small reversible change → run the fixed
mechanical check → continue or stop by explicit rules → record evidence and hand
off. Each pass is a **fresh agent with a clean context** that re-reads the truth
from `specs/` and `memory/`. The agent forgets; the repo doesn't.

## Loop harness — quick start

Autonomous agents build and verify the app using the loop in
[`AGENTS.md`](AGENTS.md) — read that file first for the full operational contract
(`OBSERVE → ACT → CHECK → DECIDE → HANDOFF`).

```bash
cp .env.example .env          # configure AGENT_CMD and the budget ceilings

# Product is defined — start the build loop:
#   specs/spec.md          (dynasty guide — Astro, static, no keys)
#   specs/PLAN.md          (ordered task checklist)
#   docs/architecture.md   (layout, data flow, deployment)

# Dry-run the harness with a mock agent (no real work, safe):
AGENT_CMD=echo MAX_ITERATIONS=1 scripts/loop.sh

# Point AGENT_CMD at a real agent CLI and let it build:
scripts/loop.sh
```

Each pass runs `scripts/check.sh` as the fixed mechanical gate. The runner stops
on success (`ALL TASKS DONE` in `specs/STATUS.md`) or on any of the **three hard
stops**: max iterations, no-progress, or budget.

## The loops that keep the app growing

Beyond the build loop, three scheduled loops keep the guide current — this is the
whole point of the app living in a loop-engineered repo:

| Loop                                                     | Trigger       | One bounded action per pass                                 |
| -------------------------------------------------------- | ------------- | ----------------------------------------------------------- |
| [`loops/build.md`](loops/build.md)                       | manual        | Implement the next unchecked task in `specs/PLAN.md`        |
| [`loops/news-refresh.md`](loops/news-refresh.md)         | cron          | Fetch feeds, dedupe, tag, commit `data/news.json`           |
| [`loops/knowledge-curator.md`](loops/knowledge-curator.md) | after refresh | Write or update **one** cited article in the thinnest facet |
| [`loops/roster-review.md`](loops/roster-review.md)       | weekly        | Cross-reference roster × news × knowledge into `data/insights.json` |

## What's in here

| Path                 | What it is                                                          |
| -------------------- | ----------------------------------------------------------------- |
| `AGENTS.md`          | **Single source of truth** for agent behavior (read this first).   |
| `CLAUDE.md`, `.cursor/rules/`, `.codex/` | Tool entrypoints that defer to `AGENTS.md`.    |
| `.claude/agents/`, `.codex/agents/` | `planner` / `maker` / `checker` subagents.         |
| `specs/`             | `spec.md` (what to build), `PLAN.md` (checklist), `STATUS.md` (progress + sentinel). |
| `data/`              | The app's database — news, players, team, insights. All committed. |
| `src/`               | The Astro app — pages, islands, schemas, knowledge content.        |
| `docs/architecture.md` | Layout, data flow, directory shape, deployment.                  |
| `memory/handoff.md`  | Durable state between runs. No secrets.                             |
| `loops/`             | The Loop Library — reusable loop definitions.                       |
| `skills/`            | Reusable named skills (`SKILL.md`) — the compounding asset.         |
| `scripts/`           | `loop.sh` (runner + hard stops), `check.sh`, `verify.sh`, `lib/`.   |
| `docs/`              | The discipline, maturity ladder, guardrails, loop authoring.       |
| `.github/workflows/` | CI runs `check.sh`; push to `main` deploys GitHub Pages.            |

## The principles baked in

- **Fresh context per task**; state on disk, not in the context window.
- **Small, atomic, reversible changes**; one commit per pass.
- **Verification built in** — build things the agent can run and check.
- **Evidence over claims** — "done" means the check exits 0.
- **Maker ≠ checker** — a separate verifier grades the work.
- **Skills compound** — capture repeated/hard work as a named skill.
- **Bounded authority** — the three hard stops + human gates on destructive actions.
- **Deploy on `main`** — push directly to `main`; GitHub Pages updates via CI.
- **Hermetic builds** — no network, no keys; external data is fetched by CI and committed.
- **No uncited claims** — every knowledge article carries its sources.
- **Stay the engineer** — read what the loop produces; avoid comprehension debt.

## Adopt it safely

Start on a low rung (triage / draft PRs), watch the token bill, and climb only
once the loop produces work you'd have merged by hand. See
[`docs/maturity-ladder.md`](docs/maturity-ladder.md) and
[`docs/guardrails.md`](docs/guardrails.md).

## Learn more

- [`docs/architecture.md`](docs/architecture.md) — how the app is built.
- [`docs/loop-engineering.md`](docs/loop-engineering.md) — the discipline & lineage.
- [`docs/loop-library.md`](docs/loop-library.md) — how to author loops.
- [`AGENTS.md`](AGENTS.md) — the operational contract every agent follows.
