import type { NewsItem } from '~/lib/schemas/news';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import type { Alert, FacetCoverage } from '~/lib/insights/cross-reference';
import type { Trending, TrendingPlayer } from '~/lib/schemas/trending';
import type { Draft } from '~/lib/schemas/draft';
import { draftSummary } from '~/lib/schemas/draft';
import { relativeTime } from '~/lib/time';
import { facetTone } from '~/lib/ui/tone';
import { Chip, EmptyState, PosTag, SectionHead } from '~/components/ui/Primitives';

export interface DashboardProps {
  alerts: Alert[];
  digest: NewsItem[];
  gaps: FacetCoverage[];
  openSlots: { slotId: string; label: string }[];
  topTargets: { target: Team['targets'][number]; player?: Player; slotLabel: string }[];
  /** Base-path-aware hrefs, built by the page. */
  links: { team: string; knowledge: string; facet: (id: string) => string };
  newsCount: number;
  /** Sleeper add/drop counts — market signal, not news. */
  trending?: Trending;
  /** Player ids on the roster, used to flag market moves that concern you. */
  rosteredPlayerIds?: string[];
  /** The league's draft, when Sleeper knows about one. */
  draft?: Draft;
  /**
   * True when no roster slot is filled. Passed explicitly rather than inferred
   * from `rosteredPlayerIds`, which is about flagging news and would read an
   * omitted prop as an empty roster.
   */
  rosterEmpty?: boolean;
  now?: Date;
}

/**
 * The dashboard answers one question: what changed that concerns me?
 *
 * Each section owns a tone — alerts rose, news amber, market orange, roster
 * green, knowledge violet — so a long scroll stays navigable by color alone.
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
  draft,
  rosterEmpty = false,
  now,
}: DashboardProps) {
  const owned = new Set(rosteredPlayerIds);
  return (
    <div className="space-y-12">
      <section aria-labelledby="alerts" data-testid="alerts-section">
        <SectionHead
          id="alerts"
          tone="rose"
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
          <ul className="rows">
            {alerts.map(({ item, matches, relation }) => (
              <li
                key={item.id}
                data-testid="alert"
                data-relation={relation}
                data-tone={relation === 'rostered' ? 'rose' : 'amber'}
                className="border-l-[3px] border-l-tone"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group block px-3.5 py-3 hover:bg-surface-alt"
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Chip tone={relation === 'rostered' ? 'rose' : 'amber'}>
                      {relation === 'rostered' ? 'on your roster' : 'a target'}
                    </Chip>
                    <span className="label">{item.source}</span>
                    <time dateTime={item.publishedAt} className="text-[11px] text-muted">
                      {relativeTime(item.publishedAt, now)}
                    </time>
                  </div>
                  <p className="mt-1 text-[0.9375rem] font-semibold group-hover:underline">
                    {item.title}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {matches.map((m) => (
                      <span key={m.player.id} className="chip">
                        {m.player.name}
                        <PosTag pos={m.player.pos} className="ml-0.5" />
                      </span>
                    ))}
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
          tone="amber"
          title="Latest news"
          note="Everything else the pipeline picked up."
          count={digest.length}
        />
        {digest.length === 0 ? (
          <EmptyState>
            Nothing yet. Run <code className="font-mono">npm run news:fetch</code> or wait for the
            scheduled refresh.
          </EmptyState>
        ) : (
          <ul className="rows" data-tone="amber">
            {digest.map((item) => (
              <li key={item.id} data-testid="digest-item">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-baseline gap-3 px-3.5 py-2.5 hover:bg-surface-alt"
                >
                  <time
                    dateTime={item.publishedAt}
                    className="w-10 shrink-0 text-[11px] font-semibold text-tone"
                    data-numeric
                  >
                    {relativeTime(item.publishedAt, now)}
                  </time>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] group-hover:underline">{item.title}</span>
                    <span className="label mt-0.5 block">{item.source}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="market" data-testid="market-section">
        <SectionHead
          id="market"
          tone="orange"
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
          <div className="grid gap-5 sm:grid-cols-2">
            <TrendingList
              title="Most added"
              tone="green"
              rows={trending.adds}
              owned={owned}
              testid="trending-adds"
            />
            <TrendingList
              title="Most dropped"
              tone="rose"
              rows={trending.drops}
              owned={owned}
              testid="trending-drops"
            />
          </div>
        )}
      </section>

      <section aria-labelledby="next" data-testid="roster-section">
        <SectionHead
          id="next"
          tone="green"
          title={rosterEmpty ? 'Draft to-do' : 'Roster to-do'}
          note={
            draft && draft.status !== 'none'
              ? draftSummary(draft)
              : 'Open slots and the top alternative for each priority need.'
          }
          link={{ href: links.team, label: 'My team' }}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="card-tone p-3.5" data-tone="slate">
            <h3 className="label mb-2">Open slots</h3>
            {openSlots.length === 0 ? (
              <p className="text-[13px] text-muted">Every slot is filled.</p>
            ) : rosterEmpty ? (
              // Listing 26 empty slots one per line is noise, and it implies the
              // roster is broken rather than undrafted.
              <p className="text-[13px]" data-testid="open-slots-summary">
                <span className="text-lg font-bold text-tone" data-numeric>
                  All {openSlots.length}
                </span>{' '}
                <span className="text-muted">
                  — the draft has not happened yet.
                  {draft && draft.myDraftSlot
                    ? ` You pick ${draft.myDraftSlot} of ${draft.teams}.`
                    : ''}
                </span>
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5 text-[13px]" data-testid="open-slots">
                {openSlots.map((slot) => (
                  <li key={slot.slotId} className="chip">
                    {slot.label}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="card-tone p-3.5" data-tone="green">
            <h3 className="label mb-2">{rosterEmpty ? 'Shortlist' : 'Top targets'}</h3>
            {topTargets.length === 0 ? (
              <p className="text-[13px] text-muted">No targets listed.</p>
            ) : (
              <ul className="space-y-1.5 text-[13px]" data-testid="top-targets">
                {topTargets.map(({ target, player, slotLabel }) => (
                  <li key={target.id} className="flex items-center gap-2">
                    <PosTag pos={player?.pos} />
                    <span className="font-semibold">{player?.name ?? target.playerId}</span>
                    <span className="ml-auto text-[11px] text-muted">{slotLabel}</span>
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
          tone="violet"
          title="Knowledge gaps"
          note="Where the curator loop should write next."
          count={gaps.length}
          link={{ href: links.knowledge, label: 'Knowledge base' }}
        />
        {gaps.length === 0 ? (
          <EmptyState>Every facet has recent coverage.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {gaps.map((gap) => (
              <li
                key={gap.id}
                data-testid="gap"
                data-reason={gap.reason}
                data-tone={facetTone(gap.id)}
              >
                <a href={links.facet(gap.id)} className="card-tone card-link block h-full p-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-bold">{gap.title}</span>
                    <span className="chip chip-tone">{gap.reason}</span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted">
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
  tone,
}: {
  title: string;
  rows: TrendingPlayer[];
  owned: Set<string>;
  testid: string;
  tone: 'green' | 'rose';
}) {
  const top = rows.slice(0, 10);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <div className="card-tone" data-tone={tone}>
      <div className="panel-head">
        <h3 className="panel-title text-[0.8125rem]">{title}</h3>
        <span className="label">adds/drops · 24h</span>
      </div>
      {top.length === 0 ? (
        <p className="p-3.5 text-[13px] text-muted">Nothing in this window.</p>
      ) : (
        <ul className="divide-y divide-line text-[13px]" data-testid={testid}>
          {top.map((row) => {
            const mine = row.playerId !== null && owned.has(row.playerId);
            return (
              <li
                key={row.sleeperId}
                data-testid="trending-row"
                data-mine={mine ? 'true' : 'false'}
                className={`relative flex items-center gap-2 px-3 py-1.5 ${
                  mine ? 'bg-tone-soft' : ''
                }`}
              >
                {/* A count bar, not a chart — relative volume at a glance. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-tone-soft/60"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
                <PosTag pos={row.pos} className="relative" />
                <span className={`relative min-w-0 truncate ${mine ? 'font-bold text-tone' : ''}`}>
                  {row.name}
                  <span className="ml-1.5 text-[11px] text-muted">{row.nflTeam}</span>
                </span>
                <span className="relative ml-auto shrink-0 font-semibold text-muted" data-numeric>
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

export default Dashboard;
