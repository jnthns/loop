# Skills

Skills are the **durable, reusable knowledge** of this repo — the asset that makes
each loop pass cheaper and sharper. A loop is plumbing; skills are what it calls.

> **The rule (Steinberger):** if you do something more than once, turn it into a
> named skill. If you do something hard, turn it into a skill afterward so next
> time is free.

## Skills vs. memory

- **Skills** (`skills/*/SKILL.md`) = how we do things: conventions, procedures,
  "we don't do it this way because of that incident." Durable.
- **Memory** (`memory/handoff.md`, `specs/STATUS.md`) = changing state: what's been
  tried, what passed, what's open.

Never put secrets in either.

## Format

Each skill is a folder with a `SKILL.md` containing YAML frontmatter (`name`,
`description`) and a body. Keep them short, imperative, and tested. Both Claude
Code and Codex discover `SKILL.md` files.

## Available skills

| Skill                 | Use it to…                                              |
| --------------------- | ------------------------------------------------------ |
| `create-spec`         | Turn a rough idea into a complete `specs/spec.md`.      |
| `write-a-loop`        | Author a new, trustworthy loop from the template.      |
| `run-checks`          | Run the project's mechanical check the canonical way.  |
| `commit-atomically`   | Make one small, reviewable, well-described commit.     |
| `curate-knowledge`    | Write one sourced article into the knowledge base.     |
| `ship-to-main`        | Push finished work straight to `main`. No PRs.         |

To capture a new skill after a successful hard task, see `write-a-loop` for the
extraction pattern (decisions, sequence, checks, failure-avoidance; strip secrets;
have an independent reviewer apply it to a fresh case before you keep it).
