import { describe, expect, it } from 'vitest';
import {
  buildPickRecommendations,
  formatWeight,
  requiredStarters,
  type RecommendInput,
} from '~/lib/picks/recommend';
import { MarketSchema, type Market } from '~/lib/schemas/market';
import { TrendingSchema } from '~/lib/schemas/trending';
import { DraftSchema } from '~/lib/schemas/draft';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { ProfilesSchema } from '~/lib/schemas/profiles';
import { TeamSchema, type Team } from '~/lib/schemas/team';
import { fixtureTeam } from './fixtures/league';

/**
 * Deterministic fixtures on purpose — see tests/data-coupling.test.ts. The
 * recommender's whole job is ordering, and an ordering test written against a
 * file the sync rewrites every six hours is a test that grades the weather.
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
    // Two receivers with the same market value, so only the roster gap and the
    // format weighting can separate them from the backs below.
    marketRow({ name: 'Big WR', pos: 'WR', playerId: 'big-wr', ecrSf: 10, valueSf: 5000, age: 24 }),
    marketRow({ name: 'Mid WR', pos: 'WR', playerId: 'mid-wr', ecrSf: 40, valueSf: 2500, age: 24 }),
    marketRow({ name: 'Big RB', pos: 'RB', playerId: 'big-rb', ecrSf: 12, valueSf: 5000, age: 24 }),
    marketRow({ name: 'Old RB', pos: 'RB', playerId: 'old-rb', ecrSf: 30, valueSf: 2500, age: 30 }),
    marketRow({ name: 'Big QB', pos: 'QB', playerId: 'big-qb', ecrSf: 8, valueSf: 5000, age: 26 }),
    marketRow({ name: 'Big TE', pos: 'TE', playerId: 'big-te', ecrSf: 45, valueSf: 2500, age: 25 }),
    marketRow({ name: 'Third WR', pos: 'WR', playerId: 'third-wr', ecrSf: 45, valueSf: 2200, age: 24 }),
    marketRow({ name: 'Fourth WR', pos: 'WR', playerId: 'fourth-wr', ecrSf: 55, valueSf: 2000, age: 24 }),
    // Market loves him, the consensus does not — the disagreement case. Value
    // makes him WR2 available; his consensus rank makes him the last WR listed.
    marketRow({ name: 'Market Darling', pos: 'WR', playerId: 'darling', ecrSf: 150, valueSf: 4800 }),
    marketRow({ name: 'Kicker', pos: 'K', playerId: 'kicker', ecrSf: 200, valueSf: 100 }),
  ],
  picks: [],
  unmatched: [],
});

const trending = TrendingSchema.parse({
  capturedAt: '2026-08-11T00:00:00.000Z',
  lookbackHours: 24,
  adds: [{ playerId: 'mid-wr', sleeperId: '1', name: 'Mid WR', pos: 'WR', nflTeam: 'ZZZ', count: 900 }],
  drops: [],
});

/**
 * Roster filler — players who exist only to occupy my starting slots so a
 * position can be tested as "already handled". They are deliberately absent
 * from the market fixture: a player on my roster is not on the board, so he has
 * no business appearing in a recommendation either way.
 */
const FILLER: { kind: string; pos: 'QB' | 'RB' | 'WR' | 'TE' }[] = [
  { kind: 'QB', pos: 'QB' },
  { kind: 'SUPERFLEX', pos: 'QB' },
  { kind: 'RB', pos: 'RB' },
  { kind: 'WR', pos: 'WR' },
  { kind: 'TE', pos: 'TE' },
  { kind: 'FLEX', pos: 'WR' },
];

/** One distinct filler per slot — reusing an id would dedupe and undercount. */
function fillerIdFor(slotId: string): string {
  return `filler-${slotId}`;
}

const fillerPlayers = fixtureTeam.format.rosterSlots
  .filter((slot) => FILLER.some((f) => f.kind === slot.kind))
  .map((slot) => ({
    id: fillerIdFor(slot.id),
    name: `Filler ${slot.label}`,
    pos: FILLER.find((f) => f.kind === slot.kind)!.pos,
    nflTeam: 'ZZZ',
    age: 25,
    tier: 'cornerstone' as const,
    notes: '',
  }));

const players: Player[] = PlayersSchema.parse([
  { id: 'big-wr', name: 'Big WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'cornerstone', notes: '' },
  { id: 'mid-wr', name: 'Mid WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'starter', notes: '' },
  { id: 'third-wr', name: 'Third WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'starter', notes: '' },
  { id: 'fourth-wr', name: 'Fourth WR', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'depth', notes: '' },
  { id: 'big-rb', name: 'Big RB', pos: 'RB', nflTeam: 'ZZZ', age: 24, tier: 'cornerstone', notes: '' },
  { id: 'old-rb', name: 'Old RB', pos: 'RB', nflTeam: 'ZZZ', age: 30, tier: 'win-now', notes: '' },
  { id: 'big-qb', name: 'Big QB', pos: 'QB', nflTeam: 'ZZZ', age: 26, tier: 'cornerstone', notes: '' },
  { id: 'big-te', name: 'Big TE', pos: 'TE', nflTeam: 'ZZZ', age: 25, tier: 'starter', notes: '' },
  { id: 'darling', name: 'Market Darling', pos: 'WR', nflTeam: 'ZZZ', age: 24, tier: 'starter', notes: '' },
  { id: 'kicker', name: 'Kicker', pos: 'K', nflTeam: 'ZZZ', age: 24, tier: 'depth', notes: '' },
  ...fillerPlayers,
]);

const profiles = ProfilesSchema.parse([
  {
    playerId: 'big-wr',
    headline: 'Every-down alpha.',
    role: 'Leads the team in targets.',
    fit: 'Pass-heavy offense.',
    risk: 'Nothing is free.',
    asOf: '2026-08-18',
    sources: [{ label: 'Example', url: 'https://example.com/big-wr' }],
  },
]);

const noDraft = DraftSchema.parse({ draftId: null, status: 'pre_draft' });

/** An empty roster, so every position starts equally needy unless we say otherwise. */
const emptyTeam: Team = TeamSchema.parse({
  ...fixtureTeam,
  roster: fixtureTeam.format.rosterSlots.map((s) => ({ slotId: s.id, playerId: null, acquired: '', notes: '' })),
  targets: [],
});

function recommend(overrides: Partial<RecommendInput> = {}) {
  return buildPickRecommendations({
    market,
    trending,
    players,
    draft: noDraft,
    team: emptyTeam,
    profiles,
    ...overrides,
  });
}

/** A team whose only hole is at the given position — every other starting slot is stocked. */
function teamNeedingOnly(pos: 'QB' | 'RB' | 'WR' | 'TE'): Team {
  return TeamSchema.parse({
    ...fixtureTeam,
    roster: fixtureTeam.format.rosterSlots.map((slot) => {
      const entry = FILLER.find((f) => f.kind === slot.kind);
      const fill = entry !== undefined && entry.pos !== pos;
      return {
        slotId: slot.id,
        playerId: fill ? fillerIdFor(slot.id) : null,
        acquired: '',
        notes: '',
      };
    }),
    targets: [],
  });
}

describe('starter requirements', () => {
  it('counts SUPERFLEX toward quarterback and splits FLEX between RB and WR', () => {
    const format = fixtureTeam.format; // 1 QB + 1 SUPERFLEX, 2 RB, 3 WR, 1 TE, 1 FLEX
    expect(requiredStarters('QB', format)).toBe(2);
    expect(requiredStarters('RB', format)).toBe(2.5);
    expect(requiredStarters('WR', format)).toBe(3.5);
    expect(requiredStarters('TE', format)).toBe(1);
  });
});

describe('format weighting', () => {
  const format = fixtureTeam.format;

  it('gives quarterbacks full weight in superflex and much less in 1QB', () => {
    expect(formatWeight('QB', format)).toBe(1);
    expect(formatWeight('QB', { ...format, superflex: false })).toBe(0.35);
  });

  it('lifts receivers more than backs under PPR, because backs catch fewer passes', () => {
    expect(formatWeight('WR', format)).toBeGreaterThan(formatWeight('RB', format));
    expect(formatWeight('WR', { ...format, ppr: 0 })).toBeLessThan(formatWeight('WR', format));
  });

  it('raises tight ends with the TE premium and drops them without it', () => {
    expect(formatWeight('TE', format)).toBeGreaterThan(formatWeight('TE', { ...format, tePremium: 0 }));
  });
});

describe('roster gaps', () => {
  it('ranks the position the roster is weakest at first', () => {
    const result = recommend({ team: teamNeedingOnly('TE') });
    expect(result.needs[0]!.pos).toBe('TE');
    expect(result.needs[0]!.openStarters).toBeGreaterThan(0);
  });

  it('scores a filled room as less needy than an empty one', () => {
    const result = recommend({ team: teamNeedingOnly('RB') });
    const rb = result.needs.find((n) => n.pos === 'RB')!;
    const wr = result.needs.find((n) => n.pos === 'WR')!;
    expect(rb.needWeight).toBeGreaterThan(wr.needWeight);
  });

  it('groups the same players under the hole each one fills, needs first', () => {
    const result = recommend({ team: teamNeedingOnly('TE') });
    expect(result.byNeed[0]!.need.pos).toBe('TE');
    expect(result.byNeed[0]!.players.every((p) => p.pos === 'TE')).toBe(true);
  });
});

describe('recommendation ordering', () => {
  it('normalizes the best available player to 100 rather than clamping the field', () => {
    const result = recommend();
    expect(result.recommendations[0]!.score).toBe(100);
    expect(new Set(result.recommendations.map((r) => r.score)).size).toBeGreaterThan(1);
  });

  it('breaks a tie in market value toward the position the roster needs', () => {
    // Big WR and Big RB carry identical value; only the gap should separate them.
    const wrNeeded = recommend({ team: teamNeedingOnly('WR') });
    const rbNeeded = recommend({ team: teamNeedingOnly('RB') });

    const wrFirst = wrNeeded.recommendations.findIndex((r) => r.name === 'Big WR');
    const rbUnderWrNeed = wrNeeded.recommendations.findIndex((r) => r.name === 'Big RB');
    expect(wrFirst).toBeLessThan(rbUnderWrNeed);

    const rbFirst = rbNeeded.recommendations.findIndex((r) => r.name === 'Big RB');
    const wrUnderRbNeed = rbNeeded.recommendations.findIndex((r) => r.name === 'Big WR');
    expect(rbFirst).toBeLessThan(wrUnderRbNeed);
  });

  it('does not let a roster gap override a wide gap in player quality', () => {
    // TE is the only hole, but the best TE is worth half the best WR. Need is a
    // multiplier, not an override — reaching for need is the mistake this page
    // is supposed to prevent.
    const result = recommend({ team: teamNeedingOnly('TE') });
    const bigTe = result.recommendations.find((r) => r.name === 'Big TE')!;
    const bigWr = result.recommendations.find((r) => r.name === 'Big WR')!;
    expect(bigWr.score).toBeGreaterThan(bigTe.score);
  });

  it('penalizes a player past his positional age peak', () => {
    const result = recommend();
    const oldRb = result.recommendations.find((r) => r.name === 'Old RB')!;
    const ageFactor = oldRb.factors.find((f) => f.id === 'age')!;
    expect(ageFactor.points).toBeLessThan(0);
    expect(ageFactor.detail).toContain('past the RB peak');
  });

  it('ignores positions the league does not start', () => {
    expect(recommend().recommendations.some((r) => r.name === 'Kicker')).toBe(false);
  });

  it('scores every factor so the parts sum to the whole', () => {
    for (const rec of recommend().recommendations) {
      const sum = rec.factors.reduce((total, f) => total + f.points, 0);
      expect(Math.abs(sum - rec.score)).toBeLessThan(0.5);
    }
  });
});

describe('availability', () => {
  it('never recommends a player already drafted in this league', () => {
    const drafted = DraftSchema.parse({
      draftId: 'd1',
      status: 'drafting',
      picks: [
        { pick: 1, round: 1, slot: 1, rosterId: 2, playerId: 'big-wr', playerName: 'Big WR', pos: 'WR' },
      ],
    });
    expect(recommend({ draft: drafted }).recommendations.some((r) => r.name === 'Big WR')).toBe(false);
  });

  it('never recommends a player someone in the league already rosters', () => {
    const owned = PlayersSchema.parse(
      players.map((p) => (p.id === 'big-rb' ? { ...p, rosteredInLeague: true } : p)),
    );
    expect(recommend({ players: owned }).recommendations.some((r) => r.name === 'Big RB')).toBe(false);
  });

  it('never recommends a player already on my own roster', () => {
    const mine = TeamSchema.parse({
      ...emptyTeam,
      roster: emptyTeam.roster.map((entry) =>
        entry.slotId === 'wr-1' ? { ...entry, playerId: 'big-wr' } : entry,
      ),
    });
    expect(recommend({ team: mine }).recommendations.some((r) => r.name === 'Big WR')).toBe(false);
  });

  it('penalizes an injury designation rather than hiding the player', () => {
    const hurt = PlayersSchema.parse(
      players.map((p) => (p.id === 'big-wr' ? { ...p, injuryStatus: 'Out' } : p)),
    );
    const result = recommend({ players: hurt });
    const row = result.recommendations.find((r) => r.name === 'Big WR')!;
    expect(row.factors.find((f) => f.id === 'opportunity')!.points).toBeLessThan(0);
  });
});

describe('the two market sources', () => {
  it('reports where the trade market and the expert consensus disagree', () => {
    const darling = recommend().recommendations.find((r) => r.name === 'Market Darling')!;
    // Value ranks him WR2 available; consensus rank (90) puts him last at WR.
    expect(darling.marketVsConsensus).toBeGreaterThan(0);
    expect(darling.why.join(' ')).toContain('disagree in his favor');
  });

  it('ranks each player at his position among players still available', () => {
    const result = recommend();
    const bigWr = result.recommendations.find((r) => r.name === 'Big WR')!;
    expect(bigWr.ktcPosRank).toBe(1);
    expect(bigWr.ecrPosRank).toBe(1);
  });
});

describe('rationale', () => {
  it('leads with the roster gap for a player who fills the biggest hole', () => {
    const result = recommend({ team: teamNeedingOnly('TE') });
    const te = result.recommendations.find((r) => r.name === 'Big TE')!;
    expect(te.fillsTopNeed).toBe(true);
    expect(te.why[0]).toContain('Closes your biggest hole');
  });

  it('says plainly when a pick is value over need', () => {
    const result = recommend({ team: teamNeedingOnly('TE') });
    const wr = result.recommendations.find((r) => r.name === 'Big WR')!;
    expect(wr.why[0]).toContain('Not a need pick');
  });

  it('attaches a cited scouting profile when one exists, and null when it does not', () => {
    const result = recommend();
    expect(result.recommendations.find((r) => r.name === 'Big WR')!.profile?.headline).toBe(
      'Every-down alpha.',
    );
    expect(result.recommendations.find((r) => r.name === 'Mid WR')!.profile).toBeNull();
  });

  it('publishes the weighting it used so the score can be argued with', () => {
    const { weights } = recommend();
    expect(weights.marketPoints).toBeGreaterThan(weights.consensusPoints);
    expect(weights.byPosition.map((w) => w.pos)).toEqual(['QB', 'RB', 'WR', 'TE']);
    for (const row of weights.byPosition) expect(row.reason.length).toBeGreaterThan(10);
  });
});
