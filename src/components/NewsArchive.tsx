import { useMemo, useState } from 'react';
import type { NewsItem } from '~/lib/schemas/news';
import { relativeTime } from '~/lib/time';

export interface NewsArchiveProps {
  items: NewsItem[];
  watchedPlayerIds?: string[];
  now?: Date;
}

type Filter = { source: string; tag: string; team: string; mineOnly: boolean };

const ALL = '';

function counts(values: string[]): [string, number][] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/**
 * The full news archive. The right-hand panel is the condensed view of the same
 * data; this is where you go to actually work through it, so it filters by
 * source, tag, and team, and can narrow to items touching your own players.
 */
export function NewsArchive({ items, watchedPlayerIds = [], now }: NewsArchiveProps) {
  const [filter, setFilter] = useState<Filter>({
    source: ALL,
    tag: ALL,
    team: ALL,
    mineOnly: false,
  });

  const watched = useMemo(() => new Set(watchedPlayerIds), [watchedPlayerIds]);

  const sources = useMemo(() => counts(items.map((i) => i.source)), [items]);
  const tags = useMemo(() => counts(items.flatMap((i) => i.tags)), [items]);
  const teams = useMemo(() => counts(items.flatMap((i) => i.teams)), [items]);

  const visible = useMemo(
    () =>
      items
        .filter((i) => (filter.source ? i.source === filter.source : true))
        .filter((i) => (filter.tag ? i.tags.includes(filter.tag) : true))
        .filter((i) => (filter.team ? i.teams.includes(filter.team) : true))
        .filter((i) => (filter.mineOnly ? i.players.some((p) => watched.has(p)) : true))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
    [items, filter, watched],
  );

  const active = filter.source || filter.tag || filter.team || filter.mineOnly;

  const select = (
    label: string,
    value: string,
    options: [string, number][],
    onChange: (v: string) => void,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border border-line bg-surface px-2 py-1.5 text-sm"
      >
        <option value={ALL}>All</option>
        {options.map(([option, count]) => (
          <option key={option} value={option}>
            {option} ({count})
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 border border-line bg-surface-alt p-3">
        {select('Source', filter.source, sources, (source) => setFilter((f) => ({ ...f, source })))}
        {select('Tag', filter.tag, tags, (tag) => setFilter((f) => ({ ...f, tag })))}
        {select('Team', filter.team, teams, (team) => setFilter((f) => ({ ...f, team })))}
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={filter.mineOnly}
            onChange={(e) => setFilter((f) => ({ ...f, mineOnly: e.target.checked }))}
          />
          My players only
        </label>
        {active && (
          <button
            type="button"
            onClick={() => setFilter({ source: ALL, tag: ALL, team: ALL, mineOnly: false })}
            className="pb-1.5 text-sm text-accent hover:underline"
          >
            Reset
          </button>
        )}
        <p className="ml-auto pb-1.5 text-xs text-muted" data-testid="result-count" data-numeric>
          {visible.length} of {items.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="border border-line border-dashed p-6 text-sm text-muted">
          {items.length === 0
            ? 'No news on file yet. The news-refresh loop populates data/news.json on a schedule.'
            : 'No items match these filters.'}
        </p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {visible.map((item) => {
            const mine = item.players.some((p) => watched.has(p));
            return (
              <li
                key={item.id}
                data-testid="archive-item"
                data-relevant={mine ? 'true' : 'false'}
                className={mine ? 'border-l-2 border-l-accent pl-3' : 'pl-3'}
              >
                <a href={item.url} target="_blank" rel="noreferrer" className="block py-3 group">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="label">{item.source}</span>
                    <time dateTime={item.publishedAt} className="text-[11px] text-muted" data-numeric>
                      {relativeTime(item.publishedAt, now)}
                    </time>
                    {mine && <span className="text-[11px] font-semibold text-accent">your player</span>}
                  </div>
                  <p className="mt-0.5 text-sm font-medium group-hover:underline">{item.title}</p>
                  {item.summary && (
                    <p className="mt-1 max-w-3xl text-[13px] text-muted">{item.summary}</p>
                  )}
                  {item.tags.length > 0 && (
                    <p className="mt-1 text-[11px] text-muted">{item.tags.join(' · ')}</p>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default NewsArchive;
