import { describe, expect, it } from 'vitest';
import { buildPositionBoards, BOARD_POSITIONS } from '~/lib/picks/board';
import { MarketSchema, type Market } from '~/lib/schemas/market';
import { TrendingSchema } from '~/lib/schemas/trending';
import { DraftSchema } from '~/lib/schemas/draft';
import { PlayersSchema } from '~/lib/schemas/players';
import { fixtureTeam } from './fixtures/league';

/**
 * Deterministic fixtures on purpose — `data/market.json` and
 * `data/trending.json` are rewritten every six hours by the sync, so asserting
 * against them would turn a waiver-wire Tuesday into a red build.
 */

function marketRow(over: Partial<Market['players'][number]> & { name: string; pos: string }) {
  return {
    fpId: `fp-${over.name.replace(/\s/g, '')}`,
    sleeperId: null,
    ktcId: null,
    espnId: null,
    playerId: null,
    nflTeam: 'ZZZ',
    age: 24,
    draftYear: 2022,
    ecrSf: 50,
    ecr1qb: 50,
    posEcr: 5,
    valueSf: 1000,
    value1qb: 1000,
    ...over,
  };
}

const market: Market = MarketSchema.parse({
  capturedAt: '2026-08-10T00:00:00.000Z',
  scrapeDate: '2026-08-09',
  sources: [{ label: 'DynastyProcess', url: 'https://github.com/dynastyprocess/data', kind: 'dataset' }],
  players: [
    marketRow({ name: 'Alpha QB', pos: 'QB', ecrSf: 3, ecr1qb: 20, valueSf: 8000, value1qb: 3000 }),
    marketRow({ name: 'Bravo QB', pos: 'QB', ecrSf: 9, ecr1qb: 15, valueSf: 7000, value1qb: 3200 }),
    marketRow({ name: 'Unranked QB', pos: 'QB', ecrSf: null, ecr1qb: null }),
    marketRow({ name: 'Alpha RB', pos: 'RB', ecrSf: 4, ecr1qb: 2, playerId: 'alpha-rb' }),
    marketRow({ name: 'Bravo RB', pos: 'RB', ecrSf: 12, ecr1qb: 6 }),
    marketRow({ name: 'Alpha WR', pos: 'WR', ecrSf: 1, ecr1qb: 1 }),
    marketRow({ name: 'Alpha TE', pos: 'TE', ecrSf: 20, ecr1qb: 10 }),
    marketRow({ name: 'Alpha K', pos: 'K', ecrSf: 300, ecr1qb: 300 }),
  ],
  picks: [],
  unmatched: [],
});

const trending = TrendingSchema.parse({
  capturedAt: '2026-08-11T00:00:00.000Z',
  lookbackHours: 24,
  adds: [
    { playerId: null, sleeperId: '1', name: 'Waiver RB', pos: 'RB', nflTeam: 'IND', count: 900 },
    { playerId: null, sleeperId: '2', name: 'Bravo RB', pos: 'RB', nflTeam: 'ZZZ', count: 4000 },
    { playerId: null, sleeperId: '3', name: 'Waiver WR', pos: 'WR', nflTeam: 'NO', count: 50 },
  ],
  drops: [{ playerId: null, sleeperId: '9', name: 'Bravo RB', pos: 'RB', nflTeam: 'ZZZ', count: 12 }],
});

const noDraft = DraftSchema.parse({ draftId: null, status: 'pre_draft' });
const superflex = { ...fixtureTeam.format, superflex: true };

function boards(overrides: Parameters<typeof buildPositionBoards>[0] extends never ? never : Partial<Parameters<typeof buildPositionBoards>[0]> = {}) {
  return buildPositionBoards({
    market,
    trending,
    players: [],
    draft: noDraft,
    format: superflex,
    ...overrides,
  });
}

function posBoard(result: ReturnType<typeof buildPositionBoards>, pos: string) {
  return result.boards.find((b) => b.pos === pos)!;
}

describe('position boards', () => {
  it('has one board per fantasy position, in a fixed order', () => {
    expect(boards().boards.map((b) => b.pos)).toEqual([...BOARD_POSITIONS]);
  });

  it('orders each position by consensus rank, most popular first', () => {
    expect(posBoard(boards(), 'QB').board.map((r) => r.name)).toEqual(['Alpha QB', 'Bravo QB']);
    expect(posBoard(boards(), 'QB').board.map((r) => r.rank)).toEqual([1, 2]);
  });

  it('reads the superflex sheet in a superflex league and the 1QB sheet otherwise', () => {
    expect(posBoard(boards(), 'QB').board[0]!.ecr).toBe(3);
    const oneQb = boards({ format: { ...superflex, superflex: false } });
    // On the 1QB sheet Bravo (15) outranks Alpha (20), flipping the board.
    expect(posBoard(oneQb, 'QB').board.map((r) => r.name)).toEqual(['Bravo QB', 'Alpha QB']);
    expect(posBoard(oneQb, 'QB').board[0]!.value).toBe(3200);
  });

  it('drops unranked rows rather than inventing a place for them', () => {
    expect(posBoard(boards(), 'QB').board.map((r) => r.name)).not.toContain('Unranked QB');
  });

  it('ignores positions the league does not start from the board', () => {
    expect(boards().boards.flatMap((b) => b.board.map((r) => r.pos))).not.toContain('K');
  });

  it('orders the trending list by Sleeper adds, not by rank', () => {
    const rb = posBoard(boards(), 'RB').trending;
    expect(rb.map((r) => r.name)).toEqual(['Bravo RB', 'Waiver RB']);
    expect(rb[0]!.adds).toBe(4000);
    expect(rb[0]!.drops).toBe(12);
  });

  it('joins trending rows to the market so a waiver add still shows its rank', () => {
    const rb = posBoard(boards(), 'RB').trending;
    expect(rb.find((r) => r.name === 'Bravo RB')!.ecr).toBe(12);
    // No market row for this one — null, never a guess.
    expect(rb.find((r) => r.name === 'Waiver RB')!.ecr).toBeNull();
  });

  it('carries add counts onto the draft board when a board player is trending', () => {
    const rb = posBoard(boards(), 'RB').board;
    expect(rb.find((r) => r.name === 'Bravo RB')!.adds).toBe(4000);
    expect(rb.find((r) => r.name === 'Alpha RB')!.adds).toBeNull();
  });

  it('marks players already drafted in this league', () => {
    const drafted = DraftSchema.parse({
      draftId: 'd1',
      status: 'drafting',
      picks: [
        { pick: 1, round: 1, slot: 1, rosterId: 2, playerId: null, playerName: 'Alpha WR', pos: 'WR' },
      ],
    });
    const result = boards({ draft: drafted });
    expect(posBoard(result, 'WR').board[0]!.availability).toBe('drafted');
    expect(posBoard(result, 'QB').board[0]!.availability).toBe('available');
  });

  it('marks players rostered by someone in the league', () => {
    const players = PlayersSchema.parse([
      {
        id: 'alpha-rb',
        name: 'Alpha RB',
        pos: 'RB',
        nflTeam: 'ZZZ',
        age: 24,
        tier: 'starter',
        rosteredInLeague: true,
      },
    ]);
    const result = boards({ players, depthRankById: { 'alpha-rb': 1 } });
    const row = posBoard(result, 'RB').board.find((r) => r.name === 'Alpha RB')!;
    expect(row.availability).toBe('rostered');
    expect(row.depthRank).toBe(1);
  });

  it('honors the per-list limits so the page stays scannable', () => {
    const result = boards({ boardLimit: 1, trendingLimit: 1 });
    expect(posBoard(result, 'QB').board).toHaveLength(1);
    expect(posBoard(result, 'RB').trending).toHaveLength(1);
  });

  it('passes the snapshot provenance through for the page to cite', () => {
    const result = boards();
    expect(result.marketCapturedAt).toBe('2026-08-10T00:00:00.000Z');
    expect(result.trendingCapturedAt).toBe('2026-08-11T00:00:00.000Z');
    expect(result.trendingLookbackHours).toBe(24);
    expect(result.sources).toHaveLength(1);
  });
});
