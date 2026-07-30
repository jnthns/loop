import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applySleeperToTeam,
  defaultTier,
  faabBudget,
  leagueToFormat,
  rosterPositionsToSlots,
  rosterToEntries,
  selectPlayers,
  slugify,
  toPlayer,
  topRankedPlayers,
} from '~/lib/sleeper/map';
import {
  SleeperLeagueSchema,
  SleeperPlayerSchema,
  SleeperRosterSchema,
  type SleeperPlayer,
} from '~/lib/schemas/sleeper';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { TeamSchema } from '~/lib/schemas/team';
import { fixturePlayers, fixtureTeam } from './fixtures/league';

const fixture = (name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/sleeper', name), 'utf8'));

const league = SleeperLeagueSchema.parse(fixture('league.json'));
const rosters = SleeperRosterSchema.array().parse(fixture('rosters.json'));
const myRoster = rosters[0];
const rawPlayers = fixture('players.json') as Record<string, unknown>;
// The "previous team" the sync merges into is the frozen fixture, not the live
// data file — otherwise this test would assert against its own output.
const committedTeam = fixtureTeam;

const sleeperPlayer = (id: string): SleeperPlayer => SleeperPlayerSchema.parse(rawPlayers[id]);

/** The player set the sync would produce for this fixture league. */
const mapped: Player[] = Object.keys(rawPlayers)
  .map((id) => toPlayer(sleeperPlayer(id)))
  .filter((p): p is Player => p !== null);

describe('rosterPositionsToSlots', () => {
  const slots = rosterPositionsToSlots(league.roster_positions);

  it('maps every recognized position, in order', () => {
    expect(slots).toHaveLength(league.roster_positions.length);
    expect(slots[0]).toMatchObject({ kind: 'QB', id: 'qb-1' });
  });

  it('translates SUPER_FLEX to our SUPERFLEX slot kind', () => {
    expect(slots.find((s) => s.kind === 'SUPERFLEX')?.id).toBe('superflex-1');
  });

  it('numbers repeated positions', () => {
    const wrs = slots.filter((s) => s.kind === 'WR');
    expect(wrs.map((s) => s.label)).toEqual(['WR1', 'WR2', 'WR3']);
  });

  it('does not number a position that appears once', () => {
    expect(slots.find((s) => s.kind === 'QB')?.label).toBe('QB');
    expect(slots.find((s) => s.kind === 'TE')?.label).toBe('TE');
  });

  it('spaces bench and taxi labels for readability', () => {
    expect(slots.find((s) => s.id === 'bn-1')?.label).toBe('Bench 1');
    expect(slots.find((s) => s.id === 'taxi-2')?.label).toBe('Taxi 2');
  });

  it('skips position codes it cannot name rather than guessing', () => {
    const slots = rosterPositionsToSlots(['QB', 'WEIRD_NEW_SLOT', 'RB']);
    expect(slots.map((s) => s.kind)).toEqual(['QB', 'RB']);
  });

  it('produces slot ids unique enough for referential integrity', () => {
    const ids = slots.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('leagueToFormat', () => {
  const format = leagueToFormat(league);

  it('reads team count, PPR, and TE premium from the league', () => {
    expect(format.teams).toBe(12);
    expect(format.ppr).toBe(1);
    expect(format.tePremium).toBe(0.5);
  });

  it('infers superflex from the slot list, not a setting', () => {
    expect(format.superflex).toBe(true);
    const singleQb = leagueToFormat({ ...league, roster_positions: ['QB', 'RB', 'BN'] });
    expect(singleQb.superflex).toBe(false);
  });

  it('defaults missing scoring settings to zero rather than guessing', () => {
    const noScoring = leagueToFormat({ ...league, scoring_settings: {} });
    expect(noScoring.ppr).toBe(0);
    expect(noScoring.tePremium).toBe(0);
  });
});

describe('toPlayer', () => {
  it('maps a normal player', () => {
    const p = toPlayer(sleeperPlayer('6813'))!;
    expect(p).toMatchObject({
      id: 'jayden-daniels',
      name: 'Jayden Daniels',
      pos: 'QB',
      nflTeam: 'WAS',
      age: 26,
      sleeperId: '6813',
    });
  });

  it('slugifies names with punctuation consistently', () => {
    expect(slugify("Ja'Marr Chase")).toBe('ja-marr-chase');
    expect(toPlayer(sleeperPlayer('9500'))!.id).toBe('brian-thomas-jr');
  });

  it('treats a player with no NFL team as a free agent', () => {
    expect(toPlayer(sleeperPlayer('9999'))!.nflTeam).toBe('FA');
  });

  it('returns null for a player with no usable position', () => {
    expect(toPlayer(sleeperPlayer('1111'))).toBeNull();
  });

  it('returns null rather than inventing an age', () => {
    expect(toPlayer(sleeperPlayer('2222'))).toBeNull();
  });

  it('allows team defenses through with the documented age sentinel', () => {
    const def = toPlayer(sleeperPlayer('DEN'))!;
    expect(def.pos).toBe('DEF');
    expect(def.age).toBe(30);
  });

  it('preserves hand-written tier, notes, and id from the existing row', () => {
    const prior: Player = {
      id: 'my-own-slug',
      name: 'Jayden Daniels',
      pos: 'QB',
      nflTeam: 'WAS',
      age: 26,
      tier: 'cornerstone',
      notes: 'my own note',
    };
    const p = toPlayer(sleeperPlayer('6813'), prior)!;
    expect(p.id).toBe('my-own-slug');
    expect(p.tier).toBe('cornerstone');
    expect(p.notes).toBe('my own note');
    // …while still refreshing what Sleeper owns.
    expect(p.sleeperId).toBe('6813');
  });
});

describe('defaultTier', () => {
  it('discounts running backs on the age curve', () => {
    expect(defaultTier('RB', 23)).toBe('starter');
    expect(defaultTier('RB', 26)).toBe('win-now');
    expect(defaultTier('RB', 29)).toBe('depth');
  });

  it('ages receivers more gently than backs', () => {
    expect(defaultTier('WR', 26)).toBe('win-now');
    expect(defaultTier('RB', 26)).toBe('win-now');
    expect(defaultTier('WR', 24)).toBe('starter');
  });

  it('never tiers kickers or defenses above depth', () => {
    expect(defaultTier('K', 24)).toBe('depth');
    expect(defaultTier('DEF', 30)).toBe('depth');
  });
});

describe('rosterToEntries', () => {
  const slots = rosterPositionsToSlots(league.roster_positions);
  const index = new Map(mapped.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]));
  const result = rosterToEntries(myRoster, slots, index);

  it('produces exactly one entry per slot', () => {
    expect(result.entries).toHaveLength(slots.length);
    expect(new Set(result.entries.map((e) => e.slotId)).size).toBe(slots.length);
  });

  it('places starters positionally against the starting slots', () => {
    const bySlot = new Map(result.entries.map((e) => [e.slotId, e.playerId]));
    expect(bySlot.get('qb-1')).toBe('jayden-daniels');
    expect(bySlot.get('rb-1')).toBe('bijan-robinson');
    expect(bySlot.get('wr-3')).toBe('nico-collins');
    expect(bySlot.get('flex-1')).toBe('puka-nacua');
  });

  it('treats "0" as an empty starting slot', () => {
    const sflex = result.entries.find((e) => e.slotId === 'superflex-1')!;
    expect(sflex.playerId).toBeNull();
  });

  it('routes reserve to IR and taxi to TAXI', () => {
    const bySlot = new Map(result.entries.map((e) => [e.slotId, e.playerId]));
    expect(bySlot.get('ir-1')).toBe('marvin-harrison-jr');
    expect(bySlot.get('taxi-1')).toBe('ashton-jeanty');
  });

  it('benches whatever is left, without double-placing anyone', () => {
    const bySlot = new Map(result.entries.map((e) => [e.slotId, e.playerId]));
    expect(bySlot.get('bn-1')).toBe('rome-odunze');
    const assigned = result.entries.map((e) => e.playerId).filter(Boolean);
    expect(new Set(assigned).size).toBe(assigned.length);
  });

  it('reports players it could not resolve instead of dropping them quietly', () => {
    const sparse = new Map([['6813', 'jayden-daniels']]);
    const out = rosterToEntries(myRoster, slots, sparse);
    expect(out.unresolved.length).toBeGreaterThan(0);
    expect(out.unresolved).not.toContain('0');
  });

  it('reports bench overflow rather than silently losing players', () => {
    const narrow = rosterPositionsToSlots(['QB', 'BN']);
    const out = rosterToEntries(myRoster, narrow, index);
    expect(out.overflow.length).toBeGreaterThan(0);
  });
});

describe('faabBudget', () => {
  it('reads the ceiling from the league and the spend from the roster', () => {
    const budget = faabBudget(league, myRoster, undefined, '2026');
    expect(budget.kind).toBe('faab');
    expect(budget.total).toBe(100);
    expect(budget.entries.reduce((s, e) => s + e.amount, 0)).toBe(14);
  });

  it('does not double-count spend already itemized by hand', () => {
    const prior = {
      id: 'faab-2026',
      label: 'FAAB — 2026 season',
      kind: 'faab' as const,
      total: 100,
      entries: [{ id: 'hand-1', label: 'Week 1 bid', amount: 10, date: '' }],
    };
    const budget = faabBudget(league, myRoster, prior, '2026');
    expect(budget.entries.reduce((s, e) => s + e.amount, 0)).toBe(14);
    expect(budget.entries.find((e) => e.id === 'hand-1')).toBeDefined();
  });

  it('keeps hand-written entries when Sleeper reports no extra spend', () => {
    const prior = {
      id: 'faab-2026',
      label: 'mine',
      kind: 'faab' as const,
      total: 100,
      entries: [{ id: 'hand-1', label: 'Week 1 bid', amount: 14, date: '' }],
    };
    const budget = faabBudget(league, myRoster, prior, '2026');
    expect(budget.entries).toHaveLength(1);
    expect(budget.entries[0].id).toBe('hand-1');
  });
});

describe('applySleeperToTeam', () => {
  const result = applySleeperToTeam(committedTeam, {
    league,
    roster: myRoster,
    players: mapped,
    season: '2026',
  });

  it('produces a schema-valid team', () => {
    const parsed = TeamSchema.safeParse(result.team);
    expect(parsed.error?.issues ?? []).toEqual([]);
    expect(parsed.success).toBe(true);
  });

  it('takes the league name and format from Sleeper', () => {
    expect(result.team.leagueName).toBe('First Dynasty League');
    expect(result.team.format.superflex).toBe(true);
    expect(result.team.format.tePremium).toBe(0.5);
  });

  it('NEVER deletes a target — rationale and cost are hand-written', () => {
    expect(result.team.targets).toHaveLength(committedTeam.targets.length);
    const rationales = result.team.targets.map((t) => t.rationale);
    for (const original of committedTeam.targets) {
      expect(rationales).toContain(original.rationale);
    }
  });

  it('reports targets that have since been acquired instead of pruning them', () => {
    expect(result.satisfiedTargets).toContain('t-rb2-1');
    expect(result.team.targets.some((t) => t.id === 't-rb2-1')).toBe(true);
  });

  it('leaves the auction budget completely untouched', () => {
    const before = committedTeam.budgets.find((b) => b.kind === 'auction')!;
    const after = result.team.budgets.find((b) => b.kind === 'auction')!;
    expect(after).toEqual(before);
  });

  it('rewrites only the FAAB ledger', () => {
    const faab = result.team.budgets.find((b) => b.kind === 'faab')!;
    expect(faab.total).toBe(100);
    expect(result.team.budgets.filter((b) => b.kind === 'faab')).toHaveLength(1);
  });

  it('keeps per-slot notes when the slot still holds the same player', () => {
    const withNote = {
      ...committedTeam,
      roster: committedTeam.roster.map((r) =>
        r.slotId === 'qb-1' ? { ...r, playerId: 'jayden-daniels', notes: 'keep me' } : r,
      ),
    };
    const out = applySleeperToTeam(withNote, {
      league,
      roster: myRoster,
      players: mapped,
      season: '2026',
    });
    expect(out.team.roster.find((r) => r.slotId === 'qb-1')!.notes).toBe('keep me');
  });

  it('reattaches a target to the SAME SLOT KIND, not just an eligible one', () => {
    // Regression: the live league calls the superflex slot `superflex-1` while
    // the fixture calls it `sflex-1`. Matching on position eligibility alone
    // moved superflex QB targets onto QB1, quietly changing what they meant.
    const out = applySleeperToTeam(committedTeam, {
      league,
      roster: myRoster,
      players: mapped,
      season: '2026',
    });
    const superflexSlot = out.team.format.rosterSlots.find((s) => s.kind === 'SUPERFLEX')!;
    const movedTargets = out.team.targets.filter((t) =>
      committedTeam.targets.some((old) => old.id === t.id && old.slotId === 'sflex-1'),
    );
    expect(movedTargets.length).toBeGreaterThan(0);
    for (const target of movedTargets) {
      expect(target.slotId, `${target.id} should land on the SUPERFLEX slot`).toBe(
        superflexSlot.id,
      );
    }
  });

  it('still falls back to position eligibility when the kind is gone entirely', () => {
    const noSuperflex = {
      ...league,
      roster_positions: ['QB', 'RB', 'WR', 'TE', 'BN', 'BN'],
    };
    const out = applySleeperToTeam(committedTeam, {
      league: noSuperflex,
      roster: myRoster,
      players: mapped,
      season: '2026',
    });
    const slotIds = new Set(out.team.format.rosterSlots.map((s) => s.id));
    for (const target of out.team.targets) {
      expect(slotIds.has(target.slotId), `${target.id} dangling on ${target.slotId}`).toBe(true);
    }
  });

  it('reattaches targets whose slot no longer exists in the new format', () => {
    const stale = {
      ...committedTeam,
      targets: [
        {
          id: 't-stale',
          slotId: 'slot-that-was-removed',
          playerId: 'brock-bowers',
          priority: 1,
          rationale: 'still wanted',
          cost: '',
        },
      ],
    };
    const out = applySleeperToTeam(stale, {
      league,
      roster: myRoster,
      players: mapped,
      season: '2026',
    });
    const slotIds = new Set(out.team.format.rosterSlots.map((s) => s.id));
    expect(slotIds.has(out.team.targets[0].slotId)).toBe(true);
  });

  it('keeps referential integrity: every roster entry points at a real slot', () => {
    const slotIds = new Set(result.team.format.rosterSlots.map((s) => s.id));
    for (const entry of result.team.roster) {
      expect(slotIds.has(entry.slotId)).toBe(true);
    }
  });

  it('does not invent players — every assignment resolves in the player set', () => {
    const ids = new Set(mapped.map((p) => p.id));
    for (const entry of result.team.roster) {
      if (entry.playerId) expect(ids.has(entry.playerId)).toBe(true);
    }
  });
});

describe('the fixture league still parses after the schema change', () => {
  it('validates with the new optional Sleeper fields', () => {
    expect(PlayersSchema.safeParse(fixturePlayers).success).toBe(true);
  });
});

/**
 * Regression coverage for the bug found while answering "are we superflex?":
 * pre-draft, nobody is rostered anywhere in the league, so selectPlayers()
 * used to collapse to whatever was trending on the waiver wire — 8 QBs, mostly
 * bench names, in a format where QB is the defining asset. topRankedPlayers()
 * and the pre-draft branch of selectPlayers() are what fix that.
 */
describe('topRankedPlayers', () => {
  const pool = (overrides: Partial<SleeperPlayer> & { player_id: string }): SleeperPlayer =>
    SleeperPlayerSchema.parse({
      full_name: `Player ${overrides.player_id}`,
      position: 'WR',
      fantasy_positions: ['WR'],
      team: 'BUF',
      age: 25,
      status: 'Active',
      ...overrides,
    });

  it('orders by search_rank ascending, lower is more relevant', () => {
    const players = {
      a: pool({ player_id: 'a', search_rank: 30 }),
      b: pool({ player_id: 'b', search_rank: 5 }),
      c: pool({ player_id: 'c', search_rank: 15 }),
    };
    expect(topRankedPlayers(players, 10)).toEqual(['b', 'c', 'a']);
  });

  it('excludes players Sleeper has not ranked at all', () => {
    const players = {
      ranked: pool({ player_id: 'ranked', search_rank: 1 }),
      unranked: pool({ player_id: 'unranked' }),
    };
    expect(topRankedPlayers(players, 10)).toEqual(['ranked']);
  });

  it('excludes kickers and defenses — not dynasty assets', () => {
    const players = {
      wr: pool({ player_id: 'wr', search_rank: 1 }),
      k: pool({ player_id: 'k', position: 'K', fantasy_positions: ['K'], search_rank: 2 }),
      def: pool({ player_id: 'def', position: 'DEF', fantasy_positions: ['DEF'], search_rank: 3 }),
    };
    expect(topRankedPlayers(players, 10)).toEqual(['wr']);
  });

  it('excludes inactive players even if ranked', () => {
    const players = {
      active: pool({ player_id: 'active', search_rank: 1 }),
      retired: pool({ player_id: 'retired', search_rank: 2, status: 'Inactive' }),
    };
    expect(topRankedPlayers(players, 10)).toEqual(['active']);
  });

  it('respects the limit', () => {
    const players = Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [`p${i}`, pool({ player_id: `p${i}`, search_rank: i })]),
    );
    expect(topRankedPlayers(players, 5)).toHaveLength(5);
  });
});

describe('selectPlayers — pre-draft branch', () => {
  const players: Record<string, SleeperPlayer> = {
    qb1: SleeperPlayerSchema.parse({
      player_id: 'qb1',
      full_name: 'Ranked QB One',
      position: 'QB',
      fantasy_positions: ['QB'],
      team: 'BUF',
      age: 26,
      status: 'Active',
      search_rank: 4,
    }),
    qb2: SleeperPlayerSchema.parse({
      player_id: 'qb2',
      full_name: 'Ranked QB Two',
      position: 'QB',
      fantasy_positions: ['QB'],
      team: 'MIA',
      age: 28,
      status: 'Active',
      search_rank: 20,
    }),
    unranked: SleeperPlayerSchema.parse({
      player_id: 'unranked',
      full_name: 'Unranked Waiver Guy',
      position: 'WR',
      fantasy_positions: ['WR'],
      team: 'NYJ',
      age: 24,
      status: 'Active',
    }),
  };

  it('pulls in ranked players when no roster in the league has anyone', () => {
    const out = selectPlayers({
      players,
      rosters: [{ players: [] }, { players: [] }],
      myRoster: { players: [] },
      trendingAdds: [],
      trendingDrops: [],
      targetPlayerIds: [],
      existing: [],
      preDraftPoolSize: 10,
    });
    const ids = out.map((p) => p.id);
    expect(ids).toContain('ranked-qb-one');
    expect(ids).toContain('ranked-qb-two');
  });

  it('does NOT pull in ranked players once the league has actually drafted', () => {
    const out = selectPlayers({
      players,
      rosters: [{ players: ['qb1'] }, { players: [] }],
      myRoster: { players: ['qb1'] },
      trendingAdds: [],
      trendingDrops: [],
      targetPlayerIds: [],
      existing: [],
      preDraftPoolSize: 10,
    });
    const ids = out.map((p) => p.id);
    expect(ids).toContain('ranked-qb-one'); // on the roster, kept regardless
    expect(ids).not.toContain('ranked-qb-two'); // ranked-only, not pulled post-draft
  });

  it('still includes an unranked player who is on the roster or trending', () => {
    const out = selectPlayers({
      players,
      rosters: [{ players: [] }],
      myRoster: { players: [] },
      trendingAdds: [{ player_id: 'unranked' }],
      trendingDrops: [],
      targetPlayerIds: [],
      existing: [],
      preDraftPoolSize: 10,
    });
    expect(out.map((p) => p.id)).toContain('unranked-waiver-guy');
  });

  it('produces schema-valid, uniquely-identified players', () => {
    const out = selectPlayers({
      players,
      rosters: [{ players: [] }],
      myRoster: { players: [] },
      trendingAdds: [],
      trendingDrops: [],
      targetPlayerIds: [],
      existing: [],
      preDraftPoolSize: 10,
    });
    expect(PlayersSchema.safeParse(out).success).toBe(true);
    expect(new Set(out.map((p) => p.id)).size).toBe(out.length);
  });
});
