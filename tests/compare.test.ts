import { describe, expect, it } from 'vitest';
import {
  buildDossiers,
  compare,
  MAX_COMPARE,
  type CompareOptions,
  type DossierInput,
} from '~/lib/compare/compare';
import { MarketSchema, EMPTY_MARKET, type Market } from '~/lib/schemas/market';
import { NewsSchema } from '~/lib/schemas/news';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { ProfilesSchema } from '~/lib/schemas/profiles';
import { TrendingSchema } from '~/lib/schemas/trending';
import { fixtureTeam } from './fixtures/league';

/**
 * Inline fixtures throughout — the committed snapshots in `data/` are rewritten
 * by the syncs every six hours, so a test coupled to them turns a waiver claim
 * into a red build.
 */

const players: Player[] = PlayersSchema.parse([
  // Analysts' favourite: best ECR, worst Sleeper rank.
  { id: 'alpha', name: 'Alpha Back', pos: 'RB', nflTeam: 'ATL', age: 24, tier: 'cornerstone', notes: '', rank: 40, status: 'Active' },
  // Sleeper's favourite: worse ECR than Alpha, best search rank of the set.
  { id: 'bravo', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', age: 27, tier: 'starter', notes: '', rank: 5, injuryStatus: 'Questionable' },
  // Joined to the market by name only — no `playerId` on the market row.
  { id: 'charlie', name: 'Charlie Tight', pos: 'TE', nflTeam: 'CHI', age: 23, tier: 'starter', notes: '', rank: 90 },
  // Known to nobody but the player file: every source cell should be blank.
  { id: 'delta', name: 'Delta Nobody', pos: 'WR', nflTeam: 'DEN', age: 22, tier: 'dart-throw', notes: '' },
  { id: 'echo', name: 'Echo Fifth', pos: 'RB', nflTeam: 'LV', age: 25, tier: 'depth', notes: '', rank: 120 },
]);

const market: Market = MarketSchema.parse({
  ...EMPTY_MARKET,
  capturedAt: '2026-08-18T00:00:00.000Z',
  scrapeDate: '2026-08-17',
  players: [
    { fpId: '1', sleeperId: null, ktcId: null, espnId: null, playerId: 'alpha', name: 'Alpha Back', pos: 'RB', nflTeam: 'ATL', age: 24.2, draftYear: 2024, ecrSf: 4, ecr1qb: 2, posEcr: 1, valueSf: 8000, value1qb: 8800 },
    { fpId: '2', sleeperId: null, ktcId: null, espnId: null, playerId: 'bravo', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', age: 27.4, draftYear: 2021, ecrSf: 12, ecr1qb: 6, posEcr: 5, valueSf: 6000, value1qb: 7000 },
    // No playerId: this row can only be reached by the name+position fallback.
    { fpId: '3', sleeperId: null, ktcId: null, espnId: null, playerId: null, name: 'Charlie Tight', pos: 'TE', nflTeam: 'CHI', age: 23.1, draftYear: 2025, ecrSf: 30, ecr1qb: 20, posEcr: 3, valueSf: 4000, value1qb: 4000 },
    { fpId: '4', sleeperId: null, ktcId: null, espnId: null, playerId: 'echo', name: 'Echo Fifth', pos: 'RB', nflTeam: 'LV', age: 25.0, draftYear: 2023, ecrSf: 60, ecr1qb: 40, posEcr: 12, valueSf: 2000, value1qb: 2100 },
  ],
});

const trending = TrendingSchema.parse({
  capturedAt: '2026-08-18T06:00:00.000Z',
  lookbackHours: 24,
  adds: [{ playerId: 'bravo', sleeperId: '2', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', count: 900 }],
  drops: [{ playerId: 'alpha', sleeperId: '1', name: 'Alpha Back', pos: 'RB', nflTeam: 'ATL', count: 30 }],
});

const news = NewsSchema.parse([
  { id: 'n1', title: 'Alpha Back returns to practice', url: 'https://example.com/a1', source: 'ESPN', sourceId: 'espn', publishedAt: '2026-08-17T12:00:00.000Z', summary: '', tags: [], players: ['alpha'], teams: ['ATL'] },
  { id: 'n2', title: 'Alpha Back limited again', url: 'https://example.com/a2', source: 'PFT', sourceId: 'pft', publishedAt: '2026-08-18T12:00:00.000Z', summary: '', tags: [], players: ['alpha'], teams: ['ATL'] },
  { id: 'n3', title: 'Bravo Wideout tweaks a hamstring', url: 'https://example.com/b1', source: 'CBS', sourceId: 'cbs', publishedAt: '2026-08-16T12:00:00.000Z', summary: '', tags: [], players: ['bravo'], teams: ['BUF'] },
]);

const profiles = ProfilesSchema.parse([
  {
    playerId: 'alpha',
    headline: 'Every-down back on a rising offense.',
    role: 'Roughly 18 touches a game.',
    fit: 'Zone scheme that fits his vision.',
    risk: 'A committee could form behind him.',
    asOf: '2026-08-18',
    sources: [{ label: 'ESPN camp report', url: 'https://example.com/profile' }],
  },
]);

const input: DossierInput = {
  players,
  market,
  trending,
  news,
  profiles,
  depthRankById: { alpha: 1, bravo: 2 },
  team: fixtureTeam,
};

const options: CompareOptions = { superflex: true, lookbackHours: 24 };

const dossiers = buildDossiers(input);
const byId = (id: string) => dossiers.find((d) => d.id === id)!;

describe('buildDossiers', () => {
  it('joins every upstream onto a player', () => {
    const alpha = byId('alpha');
    expect(alpha.ecr).toBe(4);
    expect(alpha.posEcr).toBe(1);
    expect(alpha.value).toBe(8000);
    expect(alpha.age).toBe(24.2); // the market's decimal age wins over the player file's integer
    expect(alpha.sleeperRank).toBe(40);
    expect(alpha.depthRank).toBe(1);
    expect(alpha.drops).toBe(30);
    expect(alpha.profile?.headline).toBe('Every-down back on a rising offense.');
    expect(alpha.news.map((n) => n.id)).toEqual(['n2', 'n1']); // newest first
  });

  it('falls back to a name+position join when the market row has no player id', () => {
    expect(byId('charlie').ecr).toBe(30);
    expect(byId('charlie').missing).not.toContain('dynastyprocess');
  });

  it('reads the 1QB columns when the league is not superflex', () => {
    const oneQb = buildDossiers({
      ...input,
      team: { ...fixtureTeam, format: { ...fixtureTeam.format, superflex: false } },
    });
    const alpha = oneQb.find((d) => d.id === 'alpha')!;
    expect(alpha.ecr).toBe(2);
    expect(alpha.value).toBe(8800);
  });

  it('names the sources that have nothing on a player rather than leaving a blank', () => {
    const delta = byId('delta');
    expect(delta.ecr).toBeNull();
    expect(delta.sleeperRank).toBeNull();
    expect(delta.depthRank).toBeNull();
    expect(delta.missing).toEqual(['dynastyprocess', 'sleeper', 'nflverse', 'rss']);
  });

  it('marks the manager’s own roster and targets', () => {
    const owned = buildDossiers({
      ...input,
      players: PlayersSchema.parse([
        { id: 'jayden-daniels', name: 'Jayden Daniels', pos: 'QB', nflTeam: 'WAS', age: 26, tier: 'cornerstone', notes: '' },
        { id: 'caleb-williams', name: 'Caleb Williams', pos: 'QB', nflTeam: 'CHI', age: 25, tier: 'starter', notes: '' },
      ]),
    });
    expect(owned.find((d) => d.id === 'jayden-daniels')!.onMyRoster).toBe(true);
    expect(owned.find((d) => d.id === 'caleb-williams')!.isTarget).toBe(true);
  });
});

describe('compare', () => {
  it('marks the best cell in each row, in the direction that row runs', () => {
    const { rows } = compare(dossiers, ['alpha', 'bravo'], options);
    const ecr = rows.find((r) => r.id === 'ecr')!;
    expect(ecr.cells.map((c) => c.leader)).toEqual([true, false]); // lower ECR wins
    const value = rows.find((r) => r.id === 'value')!;
    expect(value.cells.map((c) => c.leader)).toEqual([true, false]); // higher value wins
    const sleeper = rows.find((r) => r.id === 'sleeperRank')!;
    expect(sleeper.cells.map((c) => c.leader)).toEqual([false, true]);
  });

  it('never marks a leader on a descriptive row, or on a row only one player has', () => {
    const { rows } = compare(dossiers, ['alpha', 'delta'], options);
    expect(rows.find((r) => r.id === 'sfPremium')!.cells.every((c) => !c.leader)).toBe(true);
    // Only Alpha has an ECR here, so "best of one" is not a finding.
    expect(rows.find((r) => r.id === 'ecr')!.cells.every((c) => !c.leader)).toBe(true);
  });

  it('renders a missing number as an em dash rather than a zero', () => {
    const { rows } = compare(dossiers, ['delta'], options);
    expect(rows.find((r) => r.id === 'ecr')!.cells[0]).toMatchObject({ value: null, display: '—' });
    // Adds are absent for anyone outside Sleeper's top movers — not zero adds.
    expect(rows.find((r) => r.id === 'adds')!.cells[0]!.display).toBe('—');
  });

  it('calls out the split when the consensus and Sleeper disagree', () => {
    const result = compare(dossiers, ['alpha', 'bravo'], options);
    expect(result.consensusLeader).toBe('alpha');
    expect(result.attentionLeader).toBe('bravo');
    expect(result.agreement).toBe('split');
    expect(result.headline).toContain('Alpha Back');
    expect(result.headline).toContain('Bravo Wideout');
  });

  it('says so when the two independent reads agree', () => {
    const result = compare(dossiers, ['bravo', 'echo'], options);
    expect(result.agreement).toBe('agree');
    expect(result.headline).toContain('both lead with Bravo Wideout');
  });

  it('refuses a verdict when a player is missing from one of the two reads', () => {
    const result = compare(dossiers, ['alpha', 'delta'], options);
    expect(result.agreement).toBe('unknown');
    expect(result.headline).toContain('no clean cross-source verdict');
  });

  it('places each player within the set on both independent reads', () => {
    const [alpha, bravo] = compare(dossiers, ['alpha', 'bravo'], options).players;
    expect(alpha!.consensusRank).toBe(1);
    expect(alpha!.attentionRank).toBe(2);
    expect(alpha!.attentionGap).toBe(-1); // analysts ahead of attention
    expect(bravo!.attentionGap).toBe(1);
  });

  it('caps the comparison and ignores ids it does not know', () => {
    const ids = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'nobody'];
    expect(compare(dossiers, ids, options).players).toHaveLength(MAX_COMPARE);
    expect(compare(dossiers, ['nobody'], options).players).toHaveLength(0);
  });

  it('does not mutate the shared dossiers when placing players', () => {
    compare(dossiers, ['alpha', 'bravo'], options);
    expect(byId('alpha').consensusRank).toBeNull();
  });
});
