import { useMemo } from 'react';
import type { Draft } from '~/lib/schemas/draft';
import { formatPickNumber } from '~/lib/picks/pick-math';
import { getDraftProgress } from '~/lib/team/availability';

/**
 * The picks page recommends who to take, and until now never said *when*.
 *
 * Mid-startup that is the missing half of the decision. "Take the best receiver
 * on the board" reads differently when your next turn is two picks away than
 * when it is nineteen, and in a snake the gap between consecutive turns swings
 * from one pick at the turn to twenty-two on the other side of it. The wait is
 * what decides whether you can let a player slide.
 *
 * Everything here is derived from the same live draft the board uses, so a
 * Sleeper refresh moves the countdown along with the recommendations. Nothing
 * renders before the draft opens or after it ends — there is no next pick to
 * name in either state.
 */

export interface NextPicksProps {
  draft: Draft;
  /** How many upcoming turns to show. The next one is always first. */
  limit?: number;
}

export function NextPicks({ draft, limit = 4 }: NextPicksProps) {
  const progress = useMemo(() => getDraftProgress(draft), [draft]);

  if (draft.status !== 'drafting' && draft.status !== 'paused') return null;
  if (progress.upcomingPicks.length === 0) return null;

  const [next, ...later] = progress.upcomingPicks;
  const ahead = progress.picksAhead ?? 0;
  const onTheClock = ahead === 0;

  return (
    <section
      aria-labelledby="next-picks"
      data-testid="next-picks"
      data-tone="violet"
      data-on-the-clock={onTheClock ? 'true' : 'false'}
      className="card-tone p-3.5"
    >
      <p className="label text-tone" id="next-picks">
        Your next picks
      </p>

      <p className="mt-1 text-[0.9375rem] font-bold text-ink" data-testid="next-pick-headline">
        {onTheClock ? (
          <>
            You are on the clock —{' '}
            <span data-numeric>{formatPickNumber(next, draft)}</span>.
          </>
        ) : (
          <>
            <span data-numeric>{formatPickNumber(next, draft)}</span> is yours ·{' '}
            <span data-numeric>{ahead}</span> pick{ahead === 1 ? '' : 's'} away.
          </>
        )}
      </p>

      {later.length > 0 && (
        <ol className="mt-2.5 space-y-1 text-[13px]" data-testid="next-pick-list">
          {later.slice(0, Math.max(0, limit - 1)).map((pick, i) => {
            const previous = i === 0 ? next : later[i - 1];
            const gap = pick - previous;
            return (
              <li key={pick} data-testid="next-pick" data-pick={pick}>
                <span className="font-bold text-ink" data-numeric>
                  {formatPickNumber(pick, draft)}
                </span>
                <span className="text-muted">
                  {' '}
                  — <span data-numeric>{gap - 1}</span> pick{gap - 1 === 1 ? '' : 's'} after the
                  last one
                </span>
              </li>
            );
          })}
        </ol>
      )}

      <p className="mt-2.5 text-[12px] text-muted" data-numeric data-testid="next-pick-remaining">
        {progress.myPicksMade} of {progress.myPicksMade + progress.upcomingPicks.length} picks made ·{' '}
        {progress.upcomingPicks.length} left
        {draft.reversalRound >= 2 ? ` · round ${draft.reversalRound} reversal` : ''}
      </p>
    </section>
  );
}

export default NextPicks;
