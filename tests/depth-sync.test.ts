import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseDepthCharts, joinDepthToPlayers } from '../src/lib/depth/nflverse';
import { parsePlayerIds } from '../src/lib/market/dynastyprocess';
import { DepthSchema } from '../src/lib/schemas/depth';
import type { Player } from '../src/lib/schemas/players';

const FIXTURES = join(process.cwd(), 'tests/fixtures/depth');
const depthCsv = readFileSync(join(FIXTURES, 'depth_charts.csv'), 'utf8');
const idsCsv = readFileSync(join(FIXTURES, 'db_playerids.csv'), 'utf8');

const player = (over: Partial<Player> & Pick<Player, 'id' | 'name' | 'pos'>): Player => ({
  nflTeam: 'CIN',
  age: 25,
  tier: 'starter',
  notes: '',
  ...over,
});

describe('parseDepthCharts', () => {
  it('keeps only the newest snapshot', () => {
    const { snapshotAt, rows } = parseDepthCharts(depthCsv);

    expect(snapshotAt).toBe('2026-08-10T08:23:54Z');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.dt === snapshotAt)).toBe(true);
  });

  it('drops linemen, defense and special teams', () => {
    const { rows } = parseDepthCharts(depthCsv);

    expect(new Set(rows.map((r) => r.pos))).toEqual(new Set(['QB', 'RB', 'WR', 'TE']));
  });

  it('rejects a CSV whose header is not the one we parse', () => {
    expect(() => parseDepthCharts('a,b,c\n1,2,3\n')).toThrow();
  });

  it('reads the starter as depth rank 1', () => {
    const { rows } = parseDepthCharts(depthCsv);
    const burrow = rows.find((r) => r.playerName === 'Joe Burrow');

    expect(burrow).toMatchObject({ team: 'CIN', pos: 'QB', depthRank: 1 });
  });
});

describe('joinDepthToPlayers', () => {
  const { rows } = parseDepthCharts(depthCsv);
  const playerIds = parsePlayerIds(idsCsv);

  it('matches on espn_id -> sleeper_id, not on name', () => {
    // Deliberately wrong name, right Sleeper id: only the id path can match it.
    const ours = [player({ id: 'joe-burrow', name: 'Not His Name', pos: 'QB', sleeperId: '6770' })];

    const { entries } = joinDepthToPlayers(rows, playerIds, ours);

    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ id: 'joe-burrow', depthRank: 1, nflTeam: 'CIN' });
  });

  it('falls back to name matching when no id path exists', () => {
    const ours = [player({ id: 'joe-burrow', name: 'Joe Burrow', pos: 'QB' })];

    const { entries } = joinDepthToPlayers(rows, [], ours);

    expect(entries[0]).toMatchObject({ id: 'joe-burrow', depthRank: 1 });
  });

  it('never guesses when a name is ambiguous within a position', () => {
    const ours = [
      player({ id: 'joe-burrow-a', name: 'Joe Burrow', pos: 'QB' }),
      player({ id: 'joe-burrow-b', name: 'Joe Burrow', pos: 'QB' }),
    ];

    const { entries, unmatched } = joinDepthToPlayers(rows, [], ours);

    expect(entries).toHaveLength(0);
    expect(unmatched.some((u) => u.startsWith('Joe Burrow'))).toBe(true);
  });

  it('ignores chart rows for players we do not track', () => {
    const ours = [player({ id: 'joe-burrow', name: 'Joe Burrow', pos: 'QB' })];

    const { entries, unmatched } = joinDepthToPlayers(rows, playerIds, ours);

    expect(entries).toHaveLength(1);
    expect(unmatched).toEqual([]);
  });

  it('produces entries that satisfy the schema', () => {
    const ours = [
      player({ id: 'joe-burrow', name: 'Joe Burrow', pos: 'QB', sleeperId: '6770' }),
      player({ id: 'chase-brown', name: 'Chase Brown', pos: 'RB' }),
    ];
    const { entries, unmatched } = joinDepthToPlayers(rows, playerIds, ours);

    const parsed = DepthSchema.safeParse({
      capturedAt: new Date().toISOString(),
      snapshotAt: '2026-08-10T08:23:54Z',
      season: '2026',
      entries,
      unmatched,
    });

    expect(parsed.success).toBe(true);
  });
});
