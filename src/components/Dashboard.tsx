import type { NewsItem } from '~/lib/schemas/news';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import type { Alert, FacetCoverage } from '~/lib/insights/cross-reference';
import type { Trending, TrendingPlayer } from '~/lib/schemas/trending';
import { relativeTime } from '~/lib/time';

export interface DashboardProps {
  alerts: Alert[];
  digest: NewsItem[];
  gaps: FacetCoverage[];
  openSlots: { slotId: string; label: string }[];
  topTargets: { target: Team['targets'][number]; player?: Player; slotLabel: string }[];
  /** Base-path-aware hrefs, built by the page. */
  links: { news: string; team: string; knowledge: string; facet: (id: string) => string };
  newsCount: number;
  /** Sleeper add/drop counts — market signal, not news. */
  trending?: Trending;
  /** Player ids on the roster, used to flag market moves that concern you. */
  rosteredPlayerIds?: string[];
  now?: Date;
}

/**
 * The dashboard answers one question: what changed that concerns me?
 *
 * Rendered without a client directive — it is static HTML in production, and a
 * plain function to test.
 */
export function Dashboard({
  alerts,
  digest,
  gaps,
  openSlots,
  topTargets,
  links,
  newsCount,
  trending,
  rosteredPlayerIds = [],
  now,
}: DashboardProps) {
  const owned = new Set(rosteredPlayerIds);
  return (
    <div className="space-y-10">
      <section aria-labelledby="alerts" data-testid="alerts-section">
        <SectionHead
          id="alerts"
          title="Roster alerts"
          note="News mentioning players you own or are chasing."
          count={alerts.length}
        />
        {newsCount === 0 ? (
          <EmptyState>
            No news on file yet, so there is nothing to cross-reference. The{' '}
            <code className="font-mono">news-refresh</code> loop fills{' '}
            <code className="font-mono">data/news.json</code> on a schedule.
          </EmptyState>
        ) : alerts.length === 0 ? (
          <EmptyState>
            Nothing in the last 30 days mentions your players. That is usually good news.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {alerts.map(({ item, matches, relation }) => (
              <li
                key={item.id}
                data-testid="alert"
                data-relation={relation}
                className={`border-l-2 pl-3 ${
                  relation === 'rostered' ? 'border-l-accent' : 'border-l-line-strong'
                }`}
              >
                <a href={item.url} target="_blank" rel="noreferrer" className="group block py-3">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="label">{item.source}</span>
                    <time dateTime={item.publishedAt} className="text-[11px] text-muted">
                      {relativeTime(item.publishedAt, now)}
                    </time>
                    <span
                      className={`text-[11px] font-semibold ${
                        relation === 'rostered' ? 'text-accent' : 'text-muted'
                      }`}
                    >
                      {relation === 'rostered' ? 'on your roster' : 'a target'}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm font-medium group-hover:underline">{item.title}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {matches.map((m) => m.player.name).join(', ')}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="digest" data-testid="digest-section">
        <SectionHead
          id="digest"
          title="Latest news"
          note="Everything else the pipeline picked up."
          count={digest.length}
          link={{ href: links.news, label: 'Full archive' }}
        />
        {digest.length === 0 ? (
          <EmptyState>
            Nothing yet. Run <code className="font-mono">npm run news:fetch</code> or wait for the
            scheduled refresh.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {digest.map((item) => (
              <li key={item.id} data-testid="digest-item">
                <a href={item.url} target="_blank" rel="noreferrer" className="group block py-2.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="label">{item.source}</span>
                    <time dateTime={item.publishedAt} className="text-[11px] text-muted">
                      {relativeTime(item.publishedAt, now)}
                    </time>
                  </div>
                  <p className="mt-0.5 text-[13px] group-hover:underline">{item.title}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="market" data-testid="market-section">
        <SectionHead
          id="market"
          title="League market"
          note="What Sleeper managers added and dropped in the last 24 hours. Counts, not analysis — nobody wrote these."
          count={(trending?.adds.length ?? 0) + (trending?.drops.length ?? 0)}
        />
        {!trending || (trending.adds.length === 0 && trending.drops.length === 0) ? (
          <EmptyState>
            No market data yet. It arrives with the next{' '}
            <code className="font-mono">sync:sleeper</code> run.
          </EmptyState>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2">
            <TrendingList title="Most added" rows={trending.adds} owned={owned} testid="trending-adds" />
            <TrendingList title="Most dropped" rows={trending.drops} owned={owned} testid="trending-drops" />
          </div>
        )}
      </section>

      <section aria-labelledby="next" data-testid="roster-section">
        <SectionHead
          id="next"
          title="Roster to-do"
          note="Open slots and the top alternative for each priority need."
          link={{ href: links.team, label: 'My team' }}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="label mb-1.5">Open slots</h3>
            {openSlots.length === 0 ? (
              <p className="text-[13px] text-muted">Every slot is filled.</p>
            ) : (
              <ul className="text-[13px]" data-testid="open-slots">
                {openSlots.map((slot) => (
                  <li key={slot.slotId} className="border-b border-line py-1">
                    {slot.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="label mb-1.5">Top targets</h3>
            {topTargets.length === 0 ? (
              <p className="text-[13px] text-muted">No targets listed.</p>
            ) : (
              <ul className="text-[13px]" data-testid="top-targets">
                {topTargets.map(({ target, player, slotLabel }) => (
                  <li key={target.id} className="border-b border-line py-1">
                    <span className="font-medium">{player?.name ?? target.playerId}</span>{' '}
                    <span className="text-muted">for {slotLabel}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="coverage" data-testid="coverage-section">
        <SectionHead
          id="coverage"
          title="Knowledge gaps"
          note="Where the curator loop should write next."
          count={gaps.length}
          link={{ href: links.knowledge, label: 'Knowledge base' }}
        />
        {gaps.length === 0 ? (
          <EmptyState>Every facet has recent coverage.</EmptyState>
        ) : (
          <ul className="grid gap-px border border-line bg-line sm:grid-cols-2">
            {gaps.map((gap) => (
              <li key={gap.id} data-testid="gap" data-reason={gap.reason} className="bg-surface">
                <a href={links.facet(gap.id)} className="block p-3 hover:bg-surface-alt">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{gap.title}</span>
                    <span className="label">{gap.reason}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {gap.count === 0
                      ? 'No articles yet'
                      : `${gap.count} article${gap.count === 1 ? '' : 's'} · oldest gap ${gap.ageDays}d`}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TrendingList({
  title,
  rows,
  owned,
  testid,
}: {
  title: string;
  rows: TrendingPlayer[];
  owned: Set<string>;
  testid: string;
}) {
  return (
    <div>
      <h3 className="label mb-1.5">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing in this window.</p>
      ) : (
        <ul className="text-[13px]" data-testid={testid}>
          {rows.slice(0, 10).map((row) => {
            const mine = row.playerId !== null && owned.has(row.playerId);
            return (
              <li
                key={row.sleeperId}
                data-testid="trending-row"
                data-mine={mine ? 'true' : 'false'}
                className="flex items-baseline justify-between gap-2 border-b border-line py-1"
              >
                <span className={mine ? 'font-semibold text-accent' : ''}>
                  {row.name}
                  <span className="ml-1.5 text-muted">
                    {row.pos} · {row.nflTeam}
                  </span>
                </span>
                <span className="shrink-0 text-muted" data-numeric>
                  {row.count.toLocaleString('en-US')}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SectionHead({
  id,
  title,
  note,
  count,
  link,
}: {
  id: string;
  title: string;
  note: string;
  count?: number;
  link?: { href: string; label: string };
}) {
  return (
    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-line pb-1.5">
      <h2 id={id} className="text-sm font-semibold">
        {title}
        {count !== undefined && (
          <span className="ml-2 text-xs font-normal text-muted" data-numeric>
            {count}
          </span>
        )}
      </h2>
      {link && (
        <a href={link.href} className="text-xs text-accent hover:underline">
          {link.label}
        </a>
      )}
      <p className="w-full text-[12px] text-muted">{note}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-dashed border-line p-4 text-[13px] text-muted">{children}</p>
  );
}

export default Dashboard;
