import type { Draft } from '~/lib/schemas/draft';
import { draftSummary } from '~/lib/schemas/draft';

export interface DraftPanelProps {
  draft: Draft;
  /** Total roster slots — with an auction cap this gives budget per pick. */
  rosterSize?: number;
  /** Auction cap, when the league has one, for the dollars-per-pick line. */
  auctionTotal?: number | null;
}

/**
 * Everything a manager needs about the draft, in the order they need it.
 *
 * Before a startup this is the most useful panel in the app: the roster is empty
 * and every decision is about picks. The pick numbers matter most — knowing your
 * turns are 7, 18, 31 rather than 7, 19, 31 is what lets you plan two rounds out
 * instead of reacting.
 */
export function DraftPanel({ draft, rosterSize, auctionTotal }: DraftPanelProps) {
  const scheduled = draft.startTime ? new Date(draft.startTime) : null;
  const isAuction = draft.type.includes('auction');
  const perPick =
    auctionTotal && rosterSize && rosterSize > 0 ? Math.round((auctionTotal / rosterSize) * 100) / 100 : null;

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
      aria-labelledby="draft-heading"
      className="border border-line"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line bg-surface-alt px-3 py-2">
        <h2 id="draft-heading" className="text-sm font-semibold">
          Draft
        </h2>
        <p className="text-[12px] text-muted">{draftSummary(draft)}</p>
      </div>

      {draft.status === 'none' ? (
        <p className="p-4 text-[13px] text-muted">
          Sleeper has no draft for this league yet. Once the commissioner creates one, the next{' '}
          <code className="font-mono">sync:sleeper</code> run will pull the date, the order, and
          your pick numbers.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 p-3 sm:grid-cols-3 lg:grid-cols-6">
            {facts.map(([label, value]) => (
              <div key={label}>
                <dt className="label">{label}</dt>
                <dd className="text-sm font-medium" data-numeric>
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          {draft.myPicks.length > 0 && (
            <div className="border-t border-line p-3">
              <h3 className="label mb-1.5">Your picks</h3>
              <ol className="flex flex-wrap gap-1.5" data-testid="my-picks">
                {draft.myPicks.map((pick, i) => (
                  <li
                    key={pick}
                    className="border border-line px-1.5 py-0.5 text-[12px]"
                    data-numeric
                    title={`Round ${i + 1}`}
                  >
                    <span className="text-muted">R{i + 1}</span> {pick}
                  </li>
                ))}
              </ol>
              <p className="mt-2 text-[12px] text-muted">
                Overall pick numbers, one per round
                {draft.type.includes('snake') ? ' — snake order, so every other round reverses' : ''}
                .
              </p>
            </div>
          )}

          {isAuction && perPick !== null && (
            <p className="border-t border-line p-3 text-[13px]">
              <span className="label">Budget per slot</span>{' '}
              <span data-numeric>${perPick}</span>{' '}
              <span className="text-muted">
                across {rosterSize} roster spots — the number that actually constrains an auction.
              </span>
            </p>
          )}

          {draft.picks.length > 0 && (
            <div className="border-t border-line p-3">
              <h3 className="label mb-1.5">Picks made ({draft.picks.length})</h3>
              <ul className="text-[13px]" data-testid="draft-picks">
                {draft.picks.slice(-12).map((pick) => (
                  <li
                    key={pick.pick}
                    data-testid="draft-pick"
                    data-mine={pick.mine ? 'true' : 'false'}
                    className={`flex items-baseline gap-2 border-b border-line py-1 ${
                      pick.mine ? 'font-medium text-accent' : ''
                    }`}
                  >
                    <span className="w-14 shrink-0 text-muted" data-numeric>
                      {pick.round}.{String(pick.slot).padStart(2, '0')}
                    </span>
                    <span>{pick.playerName || '—'}</span>
                    <span className="text-muted">
                      {[pick.pos, pick.nflTeam].filter(Boolean).join(' · ')}
                    </span>
                    {pick.mine && <span className="ml-auto text-[11px]">yours</span>}
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
