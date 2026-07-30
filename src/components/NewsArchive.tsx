import { useMemo, useState } from 'react';
import type { NewsItem } from '~/lib/schemas/news';
import { facetCounts, queryNews, type NewsSort } from '~/lib/news/query';
import { relativeTime } from '~/lib/time';

export interface NewsArchiveProps {
  items: NewsItem[];
  watchedPlayerIds?: string[];
  now?: Date;
}

type Filter = {
  source: string;
  tag: string;
  team: string;
  query: string;
  mineOnly: boolean;
  dedupeTitles: boolean;
};

const ALL = '';

const SORT_OPTIONS: { value: NewsSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'source', label: 'Source A–Z' },
  { value: 'title', label: 'Title A–Z' },
];

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
    query: '',
    mineOnly: false,
    dedupeTitles: false,
  });
  const [sort, setSort] = useState<NewsSort>('newest');

  const sources = useMemo(() => facetCounts(items, 'source'), [items]);
  const tags = useMemo(() => facetCounts(items, 'tag'), [items]);
  const teams = useMemo(() => facetCounts(items, 'team'), [items]);

  const visible = useMemo(
    () =>
      queryNews(
        items,
        {
          source: filter.source || undefined,
          tag: filter.tag || undefined,
          team: filter.team || undefined,
          query: filter.query || undefined,
          mineOnly: filter.mineOnly,
          watchedPlayerIds,
          dedupeTitles: filter.dedupeTitles,
        },
        sort,
      ),
    [items, filter, sort, watchedPlayerIds],
  );

  const watched = useMemo(() => new Set(watchedPlayerIds), [watchedPlayerIds]);

  const active =
    filter.source ||
    filter.tag ||
    filter.team ||
    filter.query ||
    filter.mineOnly ||
    filter.dedupeTitles ||
    sort !== 'newest';

  const select = (
    label: string,
    value: string,
    options: [string, number][],
    onChange: (v: string) => void,
  ) => (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="label">{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-[0.375rem] border bg-surface px-2 py-1.5 text-sm ${
          value ? 'border-tone-line font-semibold text-tone' : 'border-line'
        }`}
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
    <div data-tone="amber">
      <div className="card mb-5 flex flex-wrap items-end gap-3 p-3">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
          <span className="label">Search</span>
          <input
            type="search"
            aria-label="Search"
            placeholder="Title or summary…"
            value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            className={`rounded-[0.375rem] border bg-surface px-2 py-1.5 text-sm ${
              filter.query ? 'border-tone-line font-semibold text-tone' : 'border-line'
            }`}
          />
        </label>
        {select('Source', filter.source, sources, (source) => setFilter((f) => ({ ...f, source })))}
        {select('Tag', filter.tag, tags, (tag) => setFilter((f) => ({ ...f, tag })))}
        {select('Team', filter.team, teams, (team) => setFilter((f) => ({ ...f, team })))}
        <label className="flex min-w-0 flex-col gap-1">
          <span className="label">Sort</span>
          <select
            aria-label="Sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as NewsSort)}
            className={`rounded-[0.375rem] border bg-surface px-2 py-1.5 text-sm ${
              sort !== 'newest' ? 'border-tone-line font-semibold text-tone' : 'border-line'
            }`}
          >
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={filter.mineOnly}
            onChange={(e) => setFilter((f) => ({ ...f, mineOnly: e.target.checked }))}
            className="accent-[var(--tone)]"
          />
          My players only
        </label>
        <label className="flex items-center gap-2 pb-1.5 text-sm">
          <input
            type="checkbox"
            checked={filter.dedupeTitles}
            onChange={(e) => setFilter((f) => ({ ...f, dedupeTitles: e.target.checked }))}
            className="accent-[var(--tone)]"
          />
          Hide duplicate titles
        </label>
        {active && (
          <button
            type="button"
            onClick={() => {
              setFilter({
                source: ALL,
                tag: ALL,
                team: ALL,
                query: '',
                mineOnly: false,
                dedupeTitles: false,
              });
              setSort('newest');
            }}
            className="section-link pb-1.5"
          >
            Reset
          </button>
        )}
        <p
          className="ml-auto pb-1.5 text-xs font-semibold text-muted"
          data-testid="result-count"
          data-numeric
        >
          {visible.length} of {items.length}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="empty">
          {items.length === 0
            ? 'No news on file yet. The news-refresh loop populates data/news.json on a schedule.'
            : 'No items match these filters.'}
        </p>
      ) : (
        <ul className="rows">
          {visible.map((item) => {
            const mine = item.players.some((p) => watched.has(p));
            return (
              <li
                key={item.id}
                data-testid="archive-item"
                data-relevant={mine ? 'true' : 'false'}
                className={mine ? 'border-l-[3px] border-l-tone bg-tone-soft/40' : ''}
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block px-3.5 py-3 hover:bg-surface-alt"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="label">{item.source}</span>
                    <time
                      dateTime={item.publishedAt}
                      className="text-[11px] text-muted"
                      data-numeric
                    >
                      {relativeTime(item.publishedAt, now)}
                    </time>
                    {mine && <span className="chip chip-tone">your player</span>}
                  </div>
                  <p className="mt-1 text-[0.9375rem] font-semibold group-hover:underline">
                    {item.title}
                  </p>
                  {item.summary && (
                    <p className="mt-1 max-w-3xl text-[13px] text-muted">{item.summary}</p>
                  )}
                  {item.tags.length > 0 && (
                    <p className="mt-1.5 flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <span key={tag} className="chip">
                          {tag}
                        </span>
                      ))}
                    </p>
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
