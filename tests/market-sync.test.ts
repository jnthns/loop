import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  joinToSleeper,
  parsePlayerIds,
  parseValuesPicks,
  parseValuesPlayers,
  sourceLinks,
} from '~/lib/market/dynastyprocess';
import { assertHeader } from '~/lib/market/csv';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { fixturePlayers } from './fixtures/league';

const FIXTURES = join(process.cwd(), 'tests/fixtures/market');
const valuesPlayersCsv = readFileSync(join(FIXTURES, 'values-players.csv'), 'utf8');
const valuesPicksCsv = readFileSync(join(FIXTURES, 'values-picks.csv'), 'utf8');
const dbPlayerIdsCsv = readFileSync(join(FIXTURES, 'db_playerids.csv'), 'utf8');

/** A small, precisely-controlled roster for join assertions — the broader
 * fixturePlayers list (required by data-coupling rules for `ourPlayers`) has
 * its own sleeper ids that don't line up with the real crosswalk fixture, so
 * this is used alongside it where an exact sleeperId match must be provable. */
const customOurPlayers: Player[] = PlayersSchema.parse([
  {
    id: 'chase-test',
    name: "Ja'Marr Chase",
    pos: 'WR',
    nflTeam: 'CIN',
    age: 26,
    tier: 'cornerstone',
    sleeperId: '7564',
  },
]);

describe('parseValuesPlayers', () => {
  it('throws naming a missing/renamed column', () => {
    const badCsv = 'players,pos,team,age,draft_year,ecr_1qb,ecr_2qb,ecr_pos,value_1qb,value_2qb,scrape_date,fp_id\n';
    expect(() => parseValuesPlayers(badCsv)).toThrow(/missing column.*player/i);
  });

  it('filters out DEF and K rows', () => {
    const rows = parseValuesPlayers(valuesPlayersCsv);
    expect(rows.some((r) => r.pos === 'DEF')).toBe(false);
    expect(rows.some((r) => r.pos === 'K')).toBe(false);
    expect(rows.some((r) => r.name === 'DeMockedKicker')).toBe(false);
    expect(rows.some((r) => r.name === 'Fake City Defense')).toBe(false);
  });

  it('turns blank/NA age and draft_year into null, never 0', () => {
    const rows = parseValuesPlayers(valuesPlayersCsv);
    const love = rows.find((r) => r.name === 'Jeremiyah Love');
    expect(love).toBeTruthy();
    expect(love!.age).toBeNull();
    expect(love!.draftYear).toBeNull();
  });

  it('parses a normal numeric row (Ja’Marr Chase, apostrophe intact)', () => {
    const rows = parseValuesPlayers(valuesPlayersCsv);
    const chase = rows.find((r) => r.name === "Ja'Marr Chase");
    expect(chase).toMatchObject({ fpId: '19788', pos: 'WR', nflTeam: 'CIN', valueSf: 9098 });
    expect(chase!.age).toBeCloseTo(26.4);
  });
});

describe('parseValuesPicks', () => {
  it('throws naming a missing/renamed column', () => {
    const badCsv = 'player,pos,ecr_1qb\n';
    expect(() => parseValuesPicks(badCsv)).toThrow(/missing column/i);
  });

  it('parses a slotted first-round pick label', () => {
    const picks = parseValuesPicks(valuesPicksCsv);
    const p = picks.find((p) => p.label === '2026 Pick 1.04');
    expect(p).toMatchObject({ season: 2026, round: 1, pickInRound: 4 });
  });

  it("parses an unslotted future-round label ('2028 3rd')", () => {
    const picks = parseValuesPicks(valuesPicksCsv);
    const p = picks.find((p) => p.label === '2028 3rd');
    expect(p).toMatchObject({ season: 2028, round: 3, pickInRound: null });
  });

  it("parses a tiered unslotted label ('2027 Early 1st')", () => {
    const picks = parseValuesPicks(valuesPicksCsv);
    const p = picks.find((p) => p.label === '2027 Early 1st');
    expect(p).toMatchObject({ season: 2027, round: 1, pickInRound: null });
  });
});

describe('parsePlayerIds', () => {
  it('throws naming a missing/renamed column', () => {
    expect(() => parsePlayerIds('mfl_id,sportradar_id\n')).toThrow(/missing column/i);
  });

  it('parses NA cells to null', () => {
    const rows = parsePlayerIds(dbPlayerIdsCsv);
    const love = rows.find((r) => r.name === 'Jeremiyah Love');
    expect(love?.fantasyprosId).toBeNull();
    expect(love?.sleeperId).toBe('13287');
  });
});

describe('joinToSleeper', () => {
  const vals = parseValuesPlayers(valuesPlayersCsv);
  const ids = parsePlayerIds(dbPlayerIdsCsv);

  it('joins Ja’Marr Chase by exact fp_id and resolves our slug via sleeperId', () => {
    const { players } = joinToSleeper(vals, ids, customOurPlayers);
    const chase = players.find((p) => p.name === "Ja'Marr Chase");
    expect(chase).toMatchObject({
      sleeperId: '7564',
      ktcId: '1004',
      espnId: '4362628',
      playerId: 'chase-test',
    });
  });

  it('falls through to the name path when fp_id is blank, and resolves the slug via slugify', () => {
    const { players } = joinToSleeper(vals, ids, fixturePlayers);
    const bijan = players.find((p) => p.name === 'Bijan Robinson');
    expect(bijan?.fpId).toBe('23133'); // has an id anyway; verifies id-first still works
    // Marvin Harrison Jr. has a blanked fp_id in the fixture and must fall through.
    const mhj = players.find((p) => p.name === 'Marvin Harrison Jr.');
    expect(mhj?.sleeperId).toBe('11628');
  });

  it('resolves duplicate normalized names via a position+team tiebreak (Marvin Harrison Jr. vs Sr.)', () => {
    const { players, unmatched } = joinToSleeper(vals, ids, fixturePlayers);
    const mhj = players.find((p) => p.name === 'Marvin Harrison Jr.');
    // Crosswalk has both a WR/ARI ("Jr.") and a WR/FA* ("Sr.") entry that
    // normalize to the same name+pos key; team disambiguates to the ARI row.
    expect(mhj?.sleeperId).toBe('11628');
    expect(unmatched.some((u) => u.name === 'Marvin Harrison Jr.')).toBe(false);
  });

  it('a duplicate name that even the team tiebreak cannot resolve lands in unmatched, never guessed', () => {
    const { players, unmatched } = joinToSleeper(vals, ids, fixturePlayers);
    expect(players.some((p) => p.name === 'John Doe')).toBe(false);
    expect(unmatched).toContainEqual({ name: 'John Doe', pos: 'WR', fpId: '' });
  });

  it('a fp_id absent from the crosswalk entirely (no id, no name match) keeps the row with sleeperId: null', () => {
    const { players, unmatched } = joinToSleeper(vals, ids, fixturePlayers);
    const fictional = players.find((p) => p.name === 'Fictional Testback');
    expect(fictional).toBeTruthy();
    expect(fictional?.sleeperId).toBeNull();
    expect(fictional?.ktcId).toBeNull();
    expect(unmatched.some((u) => u.name === 'Fictional Testback')).toBe(false);
  });

  it('DEF and K rows never reach the join at all', () => {
    const { players } = joinToSleeper(vals, ids, fixturePlayers);
    expect(players.some((p) => p.pos === 'DEF' || p.pos === 'K')).toBe(false);
  });

  it('blank age survives the join as null, not 0', () => {
    const { players } = joinToSleeper(vals, ids, fixturePlayers);
    const love = players.find((p) => p.name === 'Jeremiyah Love');
    expect(love?.age).toBeNull();
  });
});

describe('sourceLinks', () => {
  const vals = parseValuesPlayers(valuesPlayersCsv);
  const ids = parsePlayerIds(dbPlayerIdsCsv);
  const { players } = joinToSleeper(vals, ids, customOurPlayers);

  it('emits one link per id actually present, never a fabricated per-player URL', () => {
    const chase = players.find((p) => p.name === "Ja'Marr Chase")!;
    const links = sourceLinks(chase);
    expect(links.length).toBe(4); // sleeperId, ktcId, fpId, espnId all present
    for (const link of links) {
      expect(() => new URL(link.url)).not.toThrow();
    }
  });

  it('gates each link independently when an id is missing', () => {
    const bare = {
      fpId: '90001',
      sleeperId: null,
      ktcId: null,
      espnId: null,
      playerId: null,
      name: 'Fictional Testback',
      pos: 'RB',
      nflTeam: 'FA',
      age: 22,
      draftYear: 2026,
      ecrSf: 310,
      ecr1qb: 300,
      posEcr: 120,
      valueSf: 8,
      value1qb: 10,
    };
    const links = sourceLinks(bare);

    // No Sleeper or ESPN link at all: those ids are absent, and a guessed
    // player path would be a 404 wearing a citation's clothes.
    expect(links.some((l) => l.url.includes('sleeper.com'))).toBe(false);
    expect(links.some((l) => l.url.includes('espn.com'))).toBe(false);

    // KeepTradeCut degrades to its stable index page rather than vanishing, so
    // the reader still has somewhere to check the number.
    const ktc = links.find((l) => l.url.includes('keeptradecut.com'));
    expect(ktc?.url).toBe('https://keeptradecut.com/dynasty-rankings');
    expect(ktc?.label).not.toMatch(/Fictional Testback/);
  });

  it('deep-links per player when the id is present', () => {
    const rich = {
      fpId: '19788',
      sleeperId: '7564',
      ktcId: '1004',
      espnId: '4362628',
      playerId: 'jamarr-chase',
      name: "Ja'Marr Chase",
      pos: 'WR',
      nflTeam: 'CIN',
      age: 26,
      draftYear: 2021,
      ecrSf: 6.1,
      ecr1qb: 1.1,
      posEcr: 1.1,
      valueSf: 9098,
      value1qb: 10232,
    };
    const byHost = (h: string) => sourceLinks(rich).find((l) => l.url.includes(h));

    expect(byHost('sleeper.com')?.url).toBe('https://sleeper.com/players/nfl/7564');
    expect(byHost('keeptradecut.com')?.url).toBe(
      'https://keeptradecut.com/dynasty-rankings/players/1004',
    );
    expect(byHost('espn.com')?.url).toBe('https://www.espn.com/nfl/player/_/id/4362628');

    // FantasyPros drops the apostrophe rather than hyphenating it. If this ever
    // regresses to `ja-marr-chase`, every apostrophe name links to a 404.
    expect(byHost('fantasypros.com')?.url).toBe(
      'https://www.fantasypros.com/nfl/players/jamarr-chase.php',
    );

    // Every link names the player, so a screen reader hears which citation it is.
    for (const link of sourceLinks(rich)) {
      expect(link.label).toMatch(/Ja'Marr Chase/);
    }
  });
});
