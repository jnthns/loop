import { describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import { LivePicks } from '~/components/LivePicks';
import { buildPositionBoards } from '~/lib/picks/board';
import { MarketSchema, type Market } from '~/lib/schemas/market';
import { TrendingSchema } from '~/lib/schemas/trending';
import { DraftSchema, type Draft } from '~/lib/schemas/draft';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { SleeperConfigSchema } from '~/lib/schemas/sleeper';
import { TeamSchema } from '~/lib/schemas/team';
import type { LiveSleeperSnapshot } from '~/lib/team/live-storage';
import { SLEEPER_REFRESH_EVENT } from '~/lib/team/live-storage';
import { fixtureTeam } from './fixtures/league';

/**
 * The bug this covers: the recommender always excluded drafted players, but it
 * excluded them against a snapshot CI refreshes every six hours. Mid-draft that
 * meant recommending players who were already gone. These tests assert the page
 * reflects the *live* draft, not the committed one.
 */

function marketRow(over: { name: string; pos: string; playerId: string; ecrSf: number; valueSf: number }) {
  return {
    fpId: `fp-${over.playerId}`,
    sleeperId: null,
    ktcId: null,
    espnId: null,
    nflTeam: 'ZZZ',
    age: 24,
    draftYear: 2022,
    ecr1qb: over.ecrSf,
    posEcr: 5,
    value1qb: over.valueSf,
    ...over,
  };
}

const market: Market = MarketSchema.parse({
  capturedAt: '2026-08-10T00:00:00.000Z',
  scrapeDate: '2026-08-09',
  sources: [{ label: 'DynastyProcess', url: 'https://github.com/dynastyprocess/data', kind: 'dataset' }],
  players: [
    marketRow({ name: 'Alpha WR', pos: 'WR', playerId: 'alpha-wr', ecrSf: 5, valueSf: 6000 }),
    marketRow({ name: 'Bravo WR', pos: 'WR', playerId: 'bravo-wr', ecrSf: 12, valueSf: 4500 }),
    marketRow({ name: 'Delta RB', pos: 'RB', playerId: 'delta-rb', ecrSf: 20, valueSf: 3000 }),
  ],
  picks: [],
  unmatched: [],
});

const trending = TrendingSchema.parse({
  capturedAt: '2026-08-11T00:00:00.000Z',
  lookbackHours: 24,
  adds: [],
  drops: [],
});

const players: Player[] = PlayersSchema.parse([
  { id: 'alpha-wr', name: 'Alpha WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'cornerstone', notes: '', rank: 5 },
  { id: 'bravo-wr', name: 'Bravo WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'starter', notes: '', rank: 12 },
  { id: 'delta-rb', name: 'Delta RB', pos: 'RB', nflTeam: 'ZZZ', age: 24, tier: 'starter', notes: '', rank: 20 },
]);

/** The stale committed snapshot: nobody drafted yet. */
const committedDraft: Draft = DraftSchema.parse({ draftId: 'd1', status: 'drafting', picks: [] });

/** What Sleeper actually knows now: Alpha WR went two minutes ago. */
const liveDraft: Draft = DraftSchema.parse({
  draftId: 'd1',
  status: 'drafting',
  picks: [
    { pick: 1, round: 1, slot: 1, rosterId: 3, playerId: 'alpha-wr', playerName: 'Alpha WR', pos: 'WR' },
  ],
});

const emptyTeam = TeamSchema.parse({
  ...fixtureTeam,
  roster: fixtureTeam.format.rosterSlots.map((s) => ({ slotId: s.id, playerId: null, acquired: '', notes: '' })),
  targets: [],
});

const boards = buildPositionBoards({
  market,
  trending,
  players,
  draft: committedDraft,
  format: emptyTeam.format,
});

const sleeperConfig = SleeperConfigSchema.parse({
  username: 'fixture-manager',
  userId: '456',
  leagueId: '123',
});

function snapshot(draft: Draft): LiveSleeperSnapshot {
  return { team: emptyTeam, draft, playerPatches: [], syncedAt: '2026-08-19T00:30:00.000Z' };
}

function setup(loadSnapshot: () => LiveSleeperSnapshot | null) {
  return render(
    <LivePicks
      boards={boards}
      market={market}
      trending={trending}
      players={players}
      draft={committedDraft}
      team={emptyTeam}
      profiles={[]}
      depthRankById={{}}
      sleeperConfig={sleeperConfig}
      links={{ team: '/t', compare: '/c' }}
      loadSnapshot={loadSnapshot}
    />,
  );
}

function rowText(): string[] {
  return screen.getAllByTestId('recommendation').map((row) => row.textContent ?? '');
}

describe('LivePicks', () => {
  it('recommends everyone when nothing has been drafted', () => {
    setup(() => null);
    expect(rowText().some((t) => t.includes('Alpha WR'))).toBe(true);
    expect(rowText().some((t) => t.includes('Bravo WR'))).toBe(true);
  });

  it('drops a player the live Sleeper snapshot says is already drafted', () => {
    setup(() => snapshot(liveDraft));
    const rows = rowText();
    expect(rows.some((t) => t.includes('Alpha WR'))).toBe(false);
    expect(rows.some((t) => t.includes('Bravo WR'))).toBe(true);
  });

  it('re-ranks the survivors rather than leaving a hole where the pick was', () => {
    setup(() => snapshot(liveDraft));
    const rows = screen.getAllByTestId('recommendation');
    // The board closes up: the best remaining player is rank 1, not rank 2.
    expect(rows[0]!.dataset.rank).toBe('1');
    expect(rows[0]!.textContent).toContain('Bravo WR');
  });

  it('restates positional rank against the live board, not the stale one', () => {
    setup(() => snapshot(liveDraft));
    const bravo = screen.getAllByTestId('recommendation')[0]!;
    // Alpha is gone, so Bravo is now WR1 available on every platform column.
    const strip = within(bravo).getByTestId('platform-strip');
    const cells = within(strip).getAllByTestId('platform-cell');
    expect(cells.every((c) => c.textContent?.includes('WR1'))).toBe(true);
  });

  it('says whether the board is live or from the committed snapshot', () => {
    const { unmount } = setup(() => null);
    expect(screen.getByTestId('live-picks-bar').dataset.live).toBe('false');
    expect(screen.getByTestId('live-picks-status')).toHaveTextContent('last committed snapshot');
    unmount();

    setup(() => snapshot(liveDraft));
    expect(screen.getByTestId('live-picks-bar').dataset.live).toBe('true');
    expect(screen.getByTestId('live-picks-status')).toHaveTextContent('Live from Sleeper');
    expect(screen.getByTestId('live-picks-status')).toHaveTextContent('1 player off the board');
  });

  it('picks up a refresh that happens while the page is open', async () => {
    let current: LiveSleeperSnapshot | null = null;
    setup(() => current);
    expect(rowText().some((t) => t.includes('Alpha WR'))).toBe(true);

    // A refresh lands: Sleeper now reports Alpha WR as taken.
    current = snapshot(liveDraft);
    await act(async () => {
      window.dispatchEvent(new CustomEvent(SLEEPER_REFRESH_EVENT));
    });

    expect(rowText().some((t) => t.includes('Alpha WR'))).toBe(false);
  });

  it('offers the Sleeper refresh control on the page that needs it', () => {
    setup(() => null);
    expect(screen.getByTestId('sleeper-refresh')).toBeInTheDocument();
  });
});
