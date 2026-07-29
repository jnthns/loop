/** Compact relative timestamps for dense lists: "4h", "3d", "Mar 2". */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const delta = now.getTime() - then;

  if (delta < 0) return 'soon';
  if (delta < MINUTE) return 'now';
  if (delta < HOUR) return `${Math.floor(delta / MINUTE)}m`;
  if (delta < DAY) return `${Math.floor(delta / HOUR)}h`;
  if (delta < 7 * DAY) return `${Math.floor(delta / DAY)}d`;

  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** Absolute date for tooltips and article metadata. */
export function absoluteDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Whole days between `iso` and now — used for staleness nudges. */
export function daysSince(value: string | Date, now: Date = new Date()): number {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((now.getTime() - d.getTime()) / DAY);
}
