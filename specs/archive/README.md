# Campaign archive

Finished build campaigns are moved here by `loops/intake.md` when intake promotes
the next goal from `specs/BACKLOG.md`.

Each folder is named `<nn>-<slug>/` and contains:

| File        | What it is                                      |
| ----------- | ----------------------------------------------- |
| `PLAN.md`   | The completed task checklist for that campaign.   |
| `STATUS.md` | The full append-only progress log + sentinel.   |
| `meta.md`   | Goal id, title, archive date, one-line summary. |

After archiving, `specs/PLAN.md` is regenerated for the new goal and
`specs/STATUS.md` is reset to a fresh header (no `ALL TASKS DONE` sentinel).
