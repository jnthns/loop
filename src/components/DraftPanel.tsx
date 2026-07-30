import type { Draft } from '~/lib/schemas/draft';
import { draftSummary } from '~/lib/schemas/draft';
import { PosTag } from '~/components/ui/Primitives';

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
}

/**
 * Everything a manager needs about the draft, in the order they need it.
 *
 * Before a startup this is the most useful panel in the app: the roster is empty
 * and every decision is about picks. The pick numbers matter most — knowing your
 * turns are 7, 18, 31 rather than 7, 19, 31 is what lets you plan two rounds out
 * instead of reacting.
 */
export function DraftPanel({ draft, rosterSize, auctionTotal, links }: DraftPanelProps) {
  const scheduled = draft.startTime ? new Date(draft.startTime) : null;
  const isAuction = draft.type.includes('auction');
  const perPick =
    auctionTotal && rosterSize && rosterSize > 0
      ? Math.round((auctionTotal / rosterSize) * 100) / 100
      : null;

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
        <p className="text-[12px] font-semibold text-tone">{draftSummary(draft)}</p>
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

          {draft.myPicks.length > 0 && (
            <div className="border-t border-line p-3">
              <h3 className="label mb-2">Your picks</h3>
              <ol className="flex flex-wrap gap-1.5" data-testid="my-picks">
                {draft.myPicks.map((pick, i) => (
                  <li
                    key={pick}
                    className="rounded-[0.375rem] border border-tone-line bg-tone-soft px-1.5 py-0.5 text-[12px] font-bold text-tone"
                    data-numeric
                    title={`Round ${i + 1}`}
                  >
                    <span className="opacity-70">R{i + 1}</span> {pick}
                  </li>
                ))}
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
              <h3 className="label mb-2">Picks made ({draft.picks.length})</h3>
              <ul className="divide-y divide-line text-[13px]" data-testid="draft-picks">
                {draft.picks.slice(-12).map((pick) => (
                  <li
                    key={pick.pick}
                    data-testid="draft-pick"
                    data-mine={pick.mine ? 'true' : 'false'}
                    className={`flex items-center gap-2 py-1.5 ${
                      pick.mine ? 'font-semibold text-tone' : ''
                    }`}
                  >
                    <span className="w-11 shrink-0 text-[11px] text-muted" data-numeric>
                      {pick.round}.{String(pick.slot).padStart(2, '0')}
                    </span>
                    <PosTag pos={pick.pos} />
                    <span className="min-w-0 truncate">{pick.playerName || '—'}</span>
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
