import { useEffect, useMemo, useState } from 'react';
import type { NewsItem } from '~/lib/schemas/news';
import { relativeTime } from '~/lib/time';

export const NEWS_RAIL_STORAGE_KEY = 'dynasty-guide:news-rail';

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

function readCollapsedPreference(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(NEWS_RAIL_STORAGE_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

function writeCollapsedPreference(collapsed: boolean): void {
  try {
    localStorage.setItem(NEWS_RAIL_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Private mode / quota — preference is session-only.
  }
}

/**
 * The persistent right-hand rail, present on every route.
 *
 * Two jobs: show what just happened, and mark the items that touch players this
 * manager actually owns or wants. Flagged items carry the amber rail and tint;
 * everything else stays quiet, which is the whole point of the coding. Below
 * `lg` it collapses to a drawer so the main column keeps the full width on a
 * phone. On `lg+` it can be collapsed to a thin strip (preference persisted) so
 * wide carousels keep room in the middle column.
 */
export function NewsPanel({
  items,
  watchedPlayerIds = [],
  archiveHref,
  limit = 25,
  now,
}: NewsPanelProps) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsedPreference());
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeCollapsedPreference(next);
      return next;
    });
  }

  const watched = useMemo(() => new Set(watchedPlayerIds), [watchedPlayerIds]);
  const visible = useMemo(
    () => [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, limit),
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
        data-tone="amber"
        className="fixed right-3 bottom-3 z-40 flex items-center gap-1.5 rounded-full border border-tone-line bg-surface px-4 py-2.5 text-xs font-bold shadow-lg lg:hidden"
      >
        News
        {relevantCount > 0 && <span className="badge">{relevantCount}</span>}
      </button>

      <aside
        id="news-panel"
        aria-label="News"
        data-open={open}
        data-collapsed={collapsed ? 'true' : 'false'}
        data-tone="amber"
        className={[
          'border-line bg-surface-alt',
          // Mobile: fixed drawer, toggled. Desktop: static right rail (collapsible).
          'fixed inset-y-0 right-0 z-30 w-80 max-w-[85vw] overflow-y-auto border-l shadow-2xl',
          open ? 'translate-x-0' : 'translate-x-full',
          'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:overflow-visible lg:shadow-none',
          // Collapse only shrinks the desktop rail — mobile keeps the full drawer.
          collapsed ? 'lg:w-11 lg:overflow-hidden' : 'lg:w-[21rem]',
        ].join(' ')}
      >
        {/* Collapsed desktop strip — expand control only. */}
        {collapsed && (
          <div className="hidden h-full flex-col items-center gap-3 border-l border-line bg-surface-alt py-4 lg:flex">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-expanded={false}
              aria-controls="news-panel"
              aria-label="Expand news panel"
              className="rounded-[0.5rem] border border-tone-line bg-tone-soft px-1.5 py-2 text-[10px] font-bold uppercase tracking-wide text-tone [writing-mode:vertical-rl] rotate-180"
            >
              News
              {relevantCount > 0 ? ` · ${relevantCount}` : ''}
            </button>
          </div>
        )}

        <div className={collapsed ? 'lg:hidden' : undefined}>
          <div className="sticky top-0 z-10 border-b border-line bg-surface-alt/95 px-4 py-3 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[0.9375rem] font-bold tracking-tight">
                <span className="size-2 rounded-full bg-tone" aria-hidden="true" />
                News
              </h2>
              <div className="flex items-center gap-3">
                <a href={archiveHref} className="section-link">
                  All news
                </a>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  className="hidden text-xs font-semibold text-muted hover:text-ink lg:inline"
                  aria-expanded={!collapsed}
                  aria-controls="news-panel"
                >
                  Collapse
                </button>
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
              <p className="mt-2 rounded-[0.5rem] border border-tone-line bg-tone-soft px-2 py-1 text-[11px] text-tone">
                <strong className="font-bold">{relevantCount}</strong> item
                {relevantCount === 1 ? '' : 's'} mention your players
              </p>
            )}
          </div>

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
                    className={mine ? 'border-l-[3px] border-l-tone bg-tone-soft/50' : ''}
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
                          className={`shrink-0 text-[11px] font-semibold ${
                            mine ? 'text-tone' : 'text-muted'
                          }`}
                          data-numeric
                        >
                          {relativeTime(item.publishedAt, now)}
                        </time>
                      </div>
                      <p className="mt-1 text-[13px] leading-snug">{item.title}</p>
                      {item.tags.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {item.tags.slice(0, 4).map((tag) => (
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
      </aside>
    </>
  );
}

export default NewsPanel;
