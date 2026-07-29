import { useMemo, useState } from 'react';
import type { NewsItem } from '~/lib/schemas/news';
import { relativeTime } from '~/lib/time';

export interface NewsPanelProps {
  items: NewsItem[];
  /** Player ids on the roster or the target list — these get flagged. */
  watchedPlayerIds?: string[];
  /** Where the "all news" link points (base-path aware, built by the caller). */
  archiveHref: string;
  limit?: number;
  /** Injected in tests so relative times are deterministic. */
  now?: Date;
}

/**
 * The persistent right-hand rail, present on every route.
 *
 * Two jobs: show what just happened, and mark the items that touch players this
 * manager actually owns or wants. Below `lg` it collapses to a drawer so the
 * main column keeps the full width on a phone.
 */
export function NewsPanel({
  items,
  watchedPlayerIds = [],
  archiveHref,
  limit = 25,
  now,
}: NewsPanelProps) {
  const [open, setOpen] = useState(false);

  const watched = useMemo(() => new Set(watchedPlayerIds), [watchedPlayerIds]);
  const visible = useMemo(
    () =>
      [...items]
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, limit),
    [items, limit],
  );
  const relevantCount = useMemo(
    () => visible.filter((i) => i.players.some((p) => watched.has(p))).length,
    [visible, watched],
  );

  return (
    <>
      {/* Drawer trigger — hidden once the rail is permanently visible. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="news-panel"
        className="fixed right-3 bottom-3 z-40 border border-line-strong bg-surface px-3 py-2 text-xs font-semibold shadow-sm lg:hidden"
      >
        News
        {relevantCount > 0 && (
          <span className="ml-1.5 text-accent">{relevantCount}</span>
        )}
      </button>

      <aside
        id="news-panel"
        aria-label="News"
        data-open={open}
        className={[
          'border-line bg-surface-alt',
          // Mobile: fixed drawer, toggled. Desktop: static right rail.
          'fixed inset-y-0 right-0 z-30 w-80 max-w-[85vw] overflow-y-auto border-l',
          open ? 'translate-x-0' : 'translate-x-full',
          'lg:static lg:z-auto lg:w-full lg:max-w-none lg:translate-x-0 lg:overflow-visible',
        ].join(' ')}
      >
        <div className="sticky top-0 z-10 flex items-baseline justify-between gap-2 border-b border-line bg-surface-alt px-4 py-3">
          <h2 className="label">News</h2>
          <div className="flex items-center gap-3">
            <a href={archiveHref} className="text-xs text-accent hover:underline">
              All news
            </a>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted lg:hidden"
              aria-label="Close news panel"
            >
              Close
            </button>
          </div>
        </div>

        {relevantCount > 0 && (
          <p className="border-b border-line bg-accent-soft px-4 py-2 text-xs">
            <strong className="font-semibold">{relevantCount}</strong> item
            {relevantCount === 1 ? '' : 's'} mention your players
          </p>
        )}

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted">
            No news yet. The <code className="font-mono">news-refresh</code> loop fills{' '}
            <code className="font-mono">data/news.json</code> on a schedule; run{' '}
            <code className="font-mono">npm run news:fetch</code> to populate it now.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => {
              const mine = item.players.some((p) => watched.has(p));
              return (
                <li
                  key={item.id}
                  data-testid="news-item"
                  data-relevant={mine ? 'true' : 'false'}
                  className={mine ? 'border-l-2 border-l-accent bg-accent-soft/40' : ''}
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block px-4 py-2.5 hover:bg-surface"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="label truncate">{item.source}</span>
                      <time
                        dateTime={item.publishedAt}
                        className="shrink-0 text-[11px] text-muted"
                        data-numeric
                      >
                        {relativeTime(item.publishedAt, now)}
                      </time>
                    </div>
                    <p className="mt-0.5 text-[13px] leading-snug">{item.title}</p>
                    {item.tags.length > 0 && (
                      <p className="mt-1 truncate text-[11px] text-muted">
                        {item.tags.slice(0, 4).join(' · ')}
                      </p>
                    )}
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </aside>
    </>
  );
}

export default NewsPanel;
