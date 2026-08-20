import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import NextPicks from '~/components/NextPicks';
import { DraftSchema, type Draft } from '~/lib/schemas/draft';

/**
 * The picks page said who to take and never when. These cover the strip that
 * answers it — including the reversal round, which is why the numbers here are
 * 33 and 40 rather than the plain snake's 28 and 45.
 */

function pick(n: number, teams: number, mine = false) {
  const round = Math.ceil(n / teams);
  return {
    pick: n,
    round,
    slot: ((n - 1) % teams) + 1,
    rosterId: mine ? 4 : 1,
    playerId: null,
    playerName: `Player ${n}`,
    pos: 'WR',
    nflTeam: 'ZZZ',
    mine,
  };
}

const base = (over: Partial<Draft> = {}): Draft =>
  DraftSchema.parse({
    draftId: 'd1',
    status: 'drafting',
    type: 'snake',
    startTime: null,
    teams: 12,
    rounds: 30,
    myDraftSlot: 4,
    myPicks: [4, 21, 33, 40, 57, 64],
    reversalRound: 3,
    picks: [],
    ...over,
  });

describe('NextPicks', () => {
  it('names the next pick and how far away it is', () => {
    const picks = Array.from({ length: 21 }, (_, i) => pick(i + 1, 12, i + 1 === 4 || i + 1 === 21));
    render(<NextPicks draft={base({ picks })} />);

    // 21 picks are in; the manager's next is #33 — the reversal round's, four
    // picks earlier than a plain snake would put it — with 11 picks in between.
    expect(screen.getByTestId('next-pick-headline')).toHaveTextContent('3.04 (#33)');
    expect(screen.getByTestId('next-pick-headline')).toHaveTextContent('11 picks away');
    expect(screen.getByTestId('next-picks')).toHaveAttribute('data-on-the-clock', 'false');
  });

  it('says you are on the clock when the pick is now', () => {
    const picks = Array.from({ length: 20 }, (_, i) => pick(i + 1, 12, i + 1 === 4));
    render(<NextPicks draft={base({ myPicks: [21, 33], picks })} />);

    expect(screen.getByTestId('next-picks')).toHaveAttribute('data-on-the-clock', 'true');
    expect(screen.getByTestId('next-pick-headline')).toHaveTextContent('on the clock');
  });

  it('shows the wait between the turns after this one', () => {
    render(<NextPicks draft={base()} />);

    const rows = screen.getAllByTestId('next-pick');
    expect(rows[0]).toHaveTextContent('2.04 (#21)');
    // 16 picks separate #4 from #21.
    expect(rows[0]).toHaveTextContent('16 picks');
  });

  it('counts picks made against picks left, and names the reversal', () => {
    const picks = Array.from({ length: 21 }, (_, i) => pick(i + 1, 12, i + 1 === 4 || i + 1 === 21));
    render(<NextPicks draft={base({ picks })} />);

    expect(screen.getByTestId('next-pick-remaining')).toHaveTextContent('2 of 6 picks made');
    expect(screen.getByTestId('next-pick-remaining')).toHaveTextContent('round 3 reversal');
  });

  it('renders nothing before the draft opens', () => {
    render(<NextPicks draft={base({ status: 'pre_draft' })} />);
    expect(screen.queryByTestId('next-picks')).toBeNull();
  });

  it('renders nothing once every pick is in', () => {
    const picks = Array.from({ length: 64 }, (_, i) => pick(i + 1, 12, [4, 21, 33, 40, 57, 64].includes(i + 1)));
    render(<NextPicks draft={base({ picks })} />);
    expect(screen.queryByTestId('next-picks')).toBeNull();
  });
});
