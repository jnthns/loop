import { useMemo, useState } from 'react';
import type { Draft } from '~/lib/schemas/draft';
import { draftSummary } from '~/lib/schemas/draft';
import { DepthTag, PosTag } from '~/components/ui/Primitives';
import { getDraftProgress } from '~/lib/team/availability';

export interface DraftPanelProps {
  draft: Draft;
  /** Total roster slots — with an auction cap this gives budget per pick. */
  rosterSize?: number;
  /** Auction cap, when the league has one, for the dollars-per-pick line. */
  auctionTotal?: number | null;
  /**
   * Base-path-aware hrefs into the knowledge base, built by the Astro page
   * (see `src/lib/url.ts`) — a React island cannot resolve `import.meta.env.BASE_URL`
   * on its own and pass it through consistently, so the page hands it down.
   */
  links?: { positionalBuilds: string; offseasonLandscape: string };
  /** Optional lookup of depth chart ranks */
  depthRanks?: Record<string, number>;
}

type PickFilter = 'all' | 'mine' | 'recent';

/**
 * Everything a manager needs about the draft, in the order they need it.
 *
 * Before and during a startup this is the most useful panel in the app:
 * showing who you have drafted, who other teams have taken, your upcoming turns,
 * and the available talent on the board.
 */
export function DraftPanel({
  draft,
  rosterSize,
  auctionTotal,
  links,
  depthRanks = {},
}: DraftPanelProps) {
  const [filter, setFilter] = useState<PickFilter>('all');

  const scheduled = draft.startTime ? new Date(draft.startTime) : null;
  const isAuction = draft.type.includes('auction');
  const perPick =
    auctionTotal && rosterSize && rosterSize > 0
      ? Math.round((auctionTotal / rosterSize) * 100) / 100
      : null;

  const progress = useMemo(() => getDraftProgress(draft), [draft]);
  const myDraftedPicks = useMemo(
    () => (draft.picks ?? []).filter((p) => p.mine),
    [draft.picks],
  );

  const displayedPicks = useMemo(() => {
    const all = draft.picks ?? [];
    if (filter === 'mine') return all.filter((p) => p.mine);
    if (filter === 'recent') return all.slice(-12);
    return all;
  }, [draft.picks, filter]);

  const facts: [string, string][] = [
    ['Status', draft.status.replace('_', '-')],
    ['Type', draft.type || 'unknown'],
    ['Rounds', String(draft.rounds)],
    ['Teams', String(draft.teams)],
    ['Your slot', draft.myDraftSlot ? `${draft.myDraftSlot} of ${draft.teams}` : 'not set'],
    [
      'Starts',
      scheduled
        ? scheduled.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
        : 'not scheduled',
    ],
  ];

  return (
    <section
      data-testid="draft-panel"
      data-status={draft.status}
      data-tone="violet"
      aria-labelledby="draft-heading"
      className="card-tone"
    >
      <div className="panel-head">
        <h2 id="draft-heading" className="panel-title flex items-center gap-2">
          <span className="size-2 rounded-full bg-tone" aria-hidden="true" />
          Draft
        </h2>
        <div className="flex items-center gap-2">
          {myDraftedPicks.length > 0 && (
            <span className="chip chip-tone">{myDraftedPicks.length} drafted by you</span>
          )}
          <p className="text-[12px] font-semibold text-tone">{draftSummary(draft)}</p>
        </div>
      </div>

      {links && (
        <p className="border-b border-line px-3 py-2 text-[12px]" data-testid="draft-panel-links">
          <span className="label mr-1.5">Read before you draft</span>
          <a href={links.positionalBuilds} className="text-tone underline decoration-tone-line hover:decoration-tone">
            Positional builds for this format
          </a>
          <span className="mx-1.5 text-muted">·</span>
          <a href={links.offseasonLandscape} className="text-tone underline decoration-tone-line hover:decoration-tone">
            2026 offseason landscape
          </a>
        </p>
      )}

      {draft.status === 'none' ? (
        <p className="p-4 text-[13px] text-muted">
          Sleeper has no draft for this league yet. Once the commissioner creates one, the next{' '}
          <code className="font-mono">sync:sleeper</code> run will pull the date, the order, and
          your pick numbers.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
            {facts.map(([label, value]) => (
              <div key={label} className="px-3 py-2.5">
                <dt className="label">{label}</dt>
                <dd className="mt-0.5 text-[0.9375rem] font-bold" data-numeric>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Dedicated section: Who you have drafted so far */}
          {myDraftedPicks.length > 0 && (
            <div className="border-t border-line bg-surface-alt p-3" data-testid="my-drafted-team">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="label text-tone">Your drafted players ({myDraftedPicks.length})</h3>
                {progress.nextPickNumber !== null && progress.picksUntilNextTurn !== null && (
                  <span className="text-[12px] text-muted font-medium">
                    Next pick: <strong className="text-ink">#{progress.nextPickNumber}</strong>{' '}
                    (in {progress.picksUntilNextTurn} {progress.picksUntilNextTurn === 1 ? 'pick' : 'picks'})
                  </span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {myDraftedPicks.map((pick) => (
                  <div
                    key={pick.pick}
                    className="flex items-center gap-2 rounded-[0.375rem] border border-line bg-surface px-2.5 py-1.5 text-[13px]"
                  >
                    <span className="w-10 shrink-0 font-bold text-[11px] text-tone" data-numeric>
                      {pick.round}.{String(pick.slot).padStart(2, '0')}
                    </span>
                    <PosTag pos={pick.pos} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{pick.playerName || '—'}</p>
                      <p className="text-[11px] text-muted">
                        {pick.nflTeam}
                        {pick.playerId && depthRanks[pick.playerId] && (
                          <DepthTag rank={depthRanks[pick.playerId]} />
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {draft.myPicks.length > 0 && (
            <div className="border-t border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="label">Your picks schedule</h3>
                {progress.nextPickNumber !== null && myDraftedPicks.length === 0 && (
                  <span className="text-[12px] text-muted">
                    First pick is <strong className="text-ink">#{progress.nextPickNumber}</strong>
                  </span>
                )}
              </div>
              <ol className="flex flex-wrap gap-1.5" data-testid="my-picks">
                {draft.myPicks.map((pick, i) => {
                  const isCompleted = pick <= progress.totalPicksMade;
                  const isNext = pick === progress.nextPickNumber;
                  return (
                    <li
                      key={pick}
                      className={`rounded-[0.375rem] border px-1.5 py-0.5 text-[12px] font-bold ${
                        isCompleted
                          ? 'border-line bg-surface text-muted line-through opacity-70'
                          : isNext
                            ? 'border-accent bg-accent/15 text-accent ring-1 ring-accent'
                            : 'border-tone-line bg-tone-soft text-tone'
                      }`}
                      data-numeric
                      title={`Round ${i + 1}${isCompleted ? ' (completed)' : isNext ? ' (your next pick)' : ''}`}
                    >
                      <span className="opacity-70">R{i + 1}</span> {pick}
                    </li>
                  );
                })}
              </ol>
              <p className="mt-2 text-[12px] text-muted">
                Overall pick numbers, one per round
                {draft.type.includes('snake')
                  ? ' — snake order, so every other round reverses'
                  : ''}
                .
              </p>
            </div>
          )}

          {isAuction && perPick !== null && (
            <p className="border-t border-line p-3 text-[13px]">
              <span className="label">Budget per slot</span>{' '}
              <span className="font-bold text-tone" data-numeric>
                ${perPick}
              </span>{' '}
              <span className="text-muted">
                across {rosterSize} roster spots — the number that actually constrains an auction.
              </span>
            </p>
          )}

          {draft.picks.length > 0 && (
            <div className="border-t border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="label">Picks made ({draft.picks.length})</h3>
                <div role="group" aria-label="Draft picks filter" className="flex gap-1">
                  {(
                    [
                      ['all', `All (${draft.picks.length})`],
                      ['mine', `Yours (${myDraftedPicks.length})`],
                      ['recent', 'Recent (12)'],
                    ] as const
                  ).map(([val, lbl]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFilter(val)}
                      aria-pressed={filter === val}
                      className={`chip ${filter === val ? 'chip-tone' : ''}`}
                      data-tone={filter === val ? 'violet' : undefined}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <ul className="divide-y divide-line text-[13px]" data-testid="draft-picks">
                {displayedPicks.map((pick) => (
                  <li
                    key={pick.pick}
                    data-testid="draft-pick"
                    data-mine={pick.mine ? 'true' : 'false'}
                    className={`flex items-center gap-2 py-1.5 ${
                      pick.mine ? 'font-semibold text-tone bg-tone-soft/30 px-1.5 rounded-[0.25rem]' : ''
                    }`}
                  >
                    <span className="w-11 shrink-0 text-[11px] text-muted" data-numeric>
                      {pick.round}.{String(pick.slot).padStart(2, '0')}
                    </span>
                    <span className="w-6 shrink-0 text-[10px] text-muted" data-numeric>
                      #{pick.pick}
                    </span>
                    <PosTag pos={pick.pos} />
                    <span className="min-w-0 truncate font-medium">{pick.playerName || '—'}</span>
                    <span className="text-[11px] text-muted">{pick.nflTeam}</span>
                    {pick.mine && <span className="chip chip-tone ml-auto">yours</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default DraftPanel;
