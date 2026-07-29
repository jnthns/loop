import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBacklog, parsePlan, parseProgress, parseStatus } from '~/lib/progress/parse';

/**
 * The progress view reads the harness's own markdown. A parser that quietly
 * stopped matching would report cheerful, wrong numbers — the worst failure mode
 * a status display can have — so it is tested against both synthetic input and
 * the real committed files.
 */

const spec = (file: string) => readFileSync(join(process.cwd(), 'specs', file), 'utf8');

describe('parsePlan', () => {
  const sample = `
# Plan

## Phase 0 — Reset

- [x] Did the thing. (check: it is done)
- [x] Did another thing.

## Phase 1 — Build

- [x] Shipped something.
- [ ] Build the widget so the thing works.
      (check: a test proves it)
- [ ] Later task.

## Notes

Prose, no tasks here.
`;

  const plan = parsePlan(sample);

  it('counts tasks per phase', () => {
    expect(plan.phases.map((p) => [p.title, p.done, p.total])).toEqual([
      ['Phase 0 — Reset', 2, 2],
      ['Phase 1 — Build', 1, 3],
    ]);
  });

  it('ignores headings with no tasks', () => {
    expect(plan.phases.some((p) => p.title === 'Notes')).toBe(false);
  });

  it('totals across phases', () => {
    expect(plan.done).toBe(3);
    expect(plan.total).toBe(5);
    expect(plan.percent).toBe(60);
  });

  it('reports the next unchecked task, without its check clause', () => {
    expect(plan.nextTask).toBe('Build the widget so the thing works.');
  });

  it('reports the next task per phase', () => {
    expect(plan.phases[0].next).toBeNull();
    expect(plan.phases[1].next).toBe('Build the widget so the thing works.');
  });

  it('accepts an uppercase X', () => {
    expect(parsePlan('## P\n\n- [X] done\n').done).toBe(1);
  });

  it('does not divide by zero on an empty plan', () => {
    const empty = parsePlan('# Nothing here\n');
    expect(empty.percent).toBe(0);
    expect(empty.nextTask).toBeNull();
  });
});

describe('parseBacklog', () => {
  const sample = `
# Backlog

- [P0] **Fix the thing.** It is broken and that matters.
  (size: S · check: a test)
- [P1] **Add a feature.** Would be nice.
- [P1] **Another.** Also nice.
- [P3] **Someday.** Eventually.

Some prose that is not an item.
- [ ] a plan-style checkbox that must not count
`;

  const backlog = parseBacklog(sample);

  it('reads every prioritized item', () => {
    expect(backlog.items).toHaveLength(4);
  });

  it('does not mistake plan checkboxes for backlog items', () => {
    expect(backlog.items.some((i) => i.title.includes('plan-style'))).toBe(false);
  });

  it('splits the bold title from the detail', () => {
    expect(backlog.items[0].title).toBe('Fix the thing.');
    expect(backlog.items[0].detail).toBe('It is broken and that matters.');
  });

  it('strips the size and check clause from the detail', () => {
    expect(backlog.items[0].detail).not.toMatch(/size:/);
    expect(backlog.items[0].detail).not.toMatch(/check:/);
  });

  it('counts by priority', () => {
    expect(backlog.byPriority).toEqual({ P0: 1, P1: 2, P3: 1 });
  });
});

describe('parseStatus', () => {
  it('lists pass headings newest last', () => {
    const status = parseStatus('### Pass 0 — start\n\n### Pass 1 — more\n');
    expect(status.passes).toEqual(['Pass 0 — start', 'Pass 1 — more']);
    expect(status.lastPass).toBe('Pass 1 — more');
  });

  it('does NOT report done when the sentinel is commented out', () => {
    // The scaffold ships the sentinel inside an HTML comment on purpose; a naive
    // substring search would call the build finished on day one.
    expect(parseStatus('<!-- ALL TASKS DONE -->').allTasksDone).toBe(false);
  });

  it('reports done when the sentinel is real', () => {
    expect(parseStatus('## Log\n\nALL TASKS DONE\n').allTasksDone).toBe(true);
  });

  it('handles an empty log', () => {
    const status = parseStatus('# Status\n');
    expect(status.passes).toEqual([]);
    expect(status.lastPass).toBeNull();
  });
});

describe('against the real committed files', () => {
  const progress = parseProgress({
    plan: spec('PLAN.md'),
    backlog: spec('BACKLOG.md'),
    status: spec('STATUS.md'),
  });

  it('finds the real phases', () => {
    expect(progress.plan.phases.length).toBeGreaterThan(5);
    expect(progress.plan.total).toBeGreaterThan(20);
  });

  it('agrees with a raw count of checkboxes', () => {
    const raw = spec('PLAN.md');
    const checked = (raw.match(/^- \[x\]/gim) ?? []).length;
    const unchecked = (raw.match(/^- \[ \]/gm) ?? []).length;
    expect(progress.plan.done).toBe(checked);
    expect(progress.plan.total).toBe(checked + unchecked);
  });

  it('finds the real backlog and its P0 items', () => {
    expect(progress.backlog.items.length).toBeGreaterThan(0);
    expect(progress.backlog.byPriority.P0).toBeGreaterThan(0);
  });

  it('reads the recorded passes', () => {
    expect(progress.status.passes.length).toBeGreaterThan(0);
    expect(progress.status.lastPass).toMatch(/^Pass /);
  });

  it('every backlog item names a check — the promotion gate', () => {
    const raw = spec('BACKLOG.md');
    const itemLines = raw.split('\n').reduce<string[]>((acc, line, i, lines) => {
      if (!/^-\s+\[P[0-3]\]/.test(line)) return acc;
      let body = line;
      for (let j = i + 1; j < lines.length && /^\s{2,}\S/.test(lines[j]); j += 1) {
        body += ` ${lines[j].trim()}`;
      }
      acc.push(body);
      return acc;
    }, []);

    const withoutCheck = itemLines.filter((l) => !/check:/i.test(l));
    expect(withoutCheck).toEqual([]);
  });
});
