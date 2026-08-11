import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guards the check itself.
 *
 * `data/team.json`, `data/players.json`, `data/news.json`, and
 * `data/trending.json` are rewritten by the Sleeper sync and the news fetch
 * every six hours. A test that asserts against their *contents* turns an
 * ordinary roster move into a red build — a check that moves, which destroys the
 * ability to compare progress between passes. This actually happened: CI run
 * 30433592381 went red the first time the real league synced.
 *
 * So: behavior tests use `tests/fixtures/league.ts`. Only the files whose job is
 * validating the committed data may import it, and they assert shape and
 * referential integrity, never specific players.
 */

const TESTS = join(process.cwd(), 'tests');

/** The only files allowed to read the synced data files. */
const ALLOWED = new Set(['schemas.test.ts', 'insights.test.ts', 'data-coupling.test.ts']);

const SYNCED = ['team.json', 'players.json', 'news.json', 'trending.json', 'market.json', 'depth.json'];

const testFiles = readdirSync(TESTS).filter((f) => /\.test\.tsx?$/.test(f));

describe('tests are not coupled to synced data', () => {
  it('finds test files to check', () => {
    expect(testFiles.length).toBeGreaterThan(5);
  });

  it.each(testFiles)('%s does not import a synced data file', (file) => {
    if (ALLOWED.has(file)) return;
    const source = readFileSync(join(TESTS, file), 'utf8');
    const offenders = SYNCED.filter((data) =>
      new RegExp(`from\\s+['"][^'"]*data/${data.replace('.', '\\.')}['"]`).test(source),
    );
    expect(
      offenders,
      `${file} imports data/${offenders.join(', data/')} — use tests/fixtures/league.ts instead`,
    ).toEqual([]);
  });

  it('the fixture exists and is schema-valid', async () => {
    const { fixtureTeam, fixturePlayers } = await import('./fixtures/league');
    expect(fixtureTeam.roster.length).toBeGreaterThan(10);
    expect(fixturePlayers.length).toBeGreaterThan(10);
  });

  it('the fixture covers slot kinds the real league may not have', async () => {
    const { fixtureTeam } = await import('./fixtures/league');
    const kinds = new Set(fixtureTeam.format.rosterSlots.map((s) => s.kind));
    // The live league has no taxi or IR slots; these paths still need coverage.
    for (const kind of ['TAXI', 'IR', 'SUPERFLEX', 'FLEX']) {
      expect(kinds.has(kind as never), `fixture is missing a ${kind} slot`).toBe(true);
    }
  });
});
