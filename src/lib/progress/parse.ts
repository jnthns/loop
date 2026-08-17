/**
 * Parse the harness's own state files into a progress view.
 *
 * `specs/PLAN.md`, `specs/BACKLOG.md`, and `specs/STATUS.md` are markdown
 * because humans and agents both read them. That makes them the source of truth
 * and this the risky part — a parser that silently stops matching would report
 * cheerful, wrong numbers. Hence: pure functions, tested against real files.
 */

export interface PhaseProgress {
  title: string;
  done: number;
  total: number;
  /** First unchecked task in this phase — what the loop does next. */
  next: string | null;
}

export interface PlanProgress {
  phases: PhaseProgress[];
  done: number;
  total: number;
  percent: number;
  /** The next unchecked task anywhere in the plan, in priority order. */
  nextTask: string | null;
}

const TASK = /^-\s+\[( |x|X)\]\s+([\s\S]*?)$/;

/** Collapse a multi-line task entry to its first sentence-ish line. */
function summarize(text: string): string {
  return text
    .replace(/\s*\(check:[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parsePlan(markdown: string): PlanProgress {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const phases: PhaseProgress[] = [];
  let current: PhaseProgress | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      current = { title: heading[1].trim(), done: 0, total: 0, next: null };
      phases.push(current);
      continue;
    }

    const task = line.match(TASK);
    if (!task || !current) continue;

    // Tasks wrap across lines; gather the continuation for a readable summary.
    let body = task[2];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s{4,}\S/.test(lines[j])) body += ` ${lines[j].trim()}`;
      else break;
    }

    const checked = task[1].toLowerCase() === 'x';
    current.total += 1;
    if (checked) current.done += 1;
    else if (!current.next) current.next = summarize(body);
  }

  const withTasks = phases.filter((p) => p.total > 0);
  const done = withTasks.reduce((sum, p) => sum + p.done, 0);
  const total = withTasks.reduce((sum, p) => sum + p.total, 0);

  return {
    phases: withTasks,
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    nextTask: withTasks.find((p) => p.next)?.next ?? null,
  };
}

export interface BacklogItem {
  priority: string;
  title: string;
  detail: string;
}

export interface BacklogProgress {
  items: BacklogItem[];
  byPriority: Record<string, number>;
}

export function parseBacklog(markdown: string): BacklogProgress {
  const items: BacklogItem[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^-\s+\[(P[0-3])\]\s+(.*)$/);
    if (!match) continue;

    let body = match[2];
    for (let j = i + 1; j < lines.length; j += 1) {
      if (/^\s{2,}\S/.test(lines[j])) body += ` ${lines[j].trim()}`;
      else break;
    }

    // `**Title.** detail (size: ... · check: ...)`
    const titleMatch = body.match(/^\*\*(.+?)\*\*\s*(.*)$/);
    const title = (titleMatch?.[1] ?? body.split('—')[0]).replace(/\s+/g, ' ').trim();
    const detail = (titleMatch?.[2] ?? body)
      .replace(/\s*\(size:[\s\S]*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    items.push({ priority: match[1], title, detail });
  }

  const byPriority: Record<string, number> = {};
  for (const item of items) byPriority[item.priority] = (byPriority[item.priority] ?? 0) + 1;

  return { items, byPriority };
}

export interface StatusProgress {
  /** Pass headings, newest last as written. */
  passes: string[];
  lastPass: string | null;
  /** True only when the sentinel is present and uncommented. */
  allTasksDone: boolean;
}

export function parseStatus(markdown: string): StatusProgress {
  const passes = [...markdown.matchAll(/^###\s+(.*)$/gm)].map((m) => m[1].trim());

  // The scaffold keeps the sentinel inside an HTML comment on purpose, so a
  // naive substring search would report a finished build from day one.
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, '');
  const allTasksDone = /^ALL TASKS DONE\s*$/m.test(withoutComments);

  return { passes, lastPass: passes.at(-1) ?? null, allTasksDone };
}

export interface Progress {
  plan: PlanProgress;
  backlog: BacklogProgress;
  status: StatusProgress;
}

export function parseProgress(input: {
  plan: string;
  backlog: string;
  status: string;
}): Progress {
  return {
    plan: parsePlan(input.plan),
    backlog: parseBacklog(input.backlog),
    status: parseStatus(input.status),
  };
}
