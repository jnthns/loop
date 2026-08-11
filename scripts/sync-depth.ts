#!/usr/bin/env tsx
/**
 * sync-depth — pull nflverse depth charts into data/depth.json.
 *
 *   npm run sync:depth                 fetch + sync from nflverse
 *   npm run sync:depth -- --fixtures   map committed fixtures instead (offline)
 *   npm run sync:depth -- --dry-run    report what would change, write nothing
 *
 * nflverse publishes depth charts as release assets on GitHub — public, keyless,
 * and updated daily through camp. No secret is introduced.
 *
 * The season CSV is ~38MB because it carries every snapshot since March, so we
 * fetch the gzipped copy (~8MB) and gunzip it in-process with node:zlib. Only
 * the newest snapshot's skill-position rows survive into the committed file.
 *
 * Safety rule: any fetch failure, or a response that fails the write floors
 * below, aborts before writing. A bad CDN day must never blank a good snapshot.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { parsePlayerIds } from '../src/lib/market/dynastyprocess.ts';
import { parseDepthCharts, joinDepthToPlayers } from '../src/lib/depth/nflverse.ts';
import { DepthSchema, type Depth } from '../src/lib/schemas/depth.ts';
import { PlayersSchema, type Player } from '../src/lib/schemas/players.ts';
import { SleeperConfigSchema } from '../src/lib/schemas/sleeper.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const FIXTURES = join(ROOT, 'tests/fixtures/depth');

const args = new Set(process.argv.slice(2));
const useFixtures = args.has('--fixtures');
const dryRun = args.has('--dry-run') || (useFixtures && !args.has('--write'));

const NFLVERSE = 'https://github.com/nflverse/nflverse-data/releases/download/depth_charts';
const DYNASTYPROCESS = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files';

// Write floors — refuse to write if any fails. A truncated asset or an HTML
// error page must be a no-op, not a regression.
const MIN_ENTRIES = 200;
const MIN_TEAMS = 24;

function readData(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA, file), 'utf8'));
}

function writeData(file: string, value: unknown): void {
  writeFileSync(join(DATA, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readFixture(name: string): string {
  const path = join(FIXTURES, name);
  if (!existsSync(path)) throw new Error(`missing fixture: tests/fixtures/depth/${name}`);
  return readFileSync(path, 'utf8');
}

async function fetchText(url: string, gzipped = false): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status} ${res.statusText}`);
  const text = gzipped
    ? gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
    : await res.text();
  if (text.trim().length === 0) throw new Error(`fetch ${url} returned an empty body`);
  return text;
}

async function main() {
  const capturedAt = new Date().toISOString();
  const ourPlayers = PlayersSchema.parse(readData('players.json')) as Player[];
  const config = SleeperConfigSchema.parse(readData('sleeper.json'));
  const season = config.season ?? String(new Date().getUTCFullYear());

  console.log(`${useFixtures ? 'Mapping fixtures for' : 'Syncing'} nflverse depth charts (${season})…`);

  const [depthCsv, playerIdsCsv] = useFixtures
    ? [readFixture('depth_charts.csv'), readFixture('db_playerids.csv')]
    : await Promise.all([
        fetchText(`${NFLVERSE}/depth_charts_${season}.csv.gz`, true),
        fetchText(`${DYNASTYPROCESS}/db_playerids.csv`),
      ]);

  const { snapshotAt, rows } = parseDepthCharts(depthCsv);
  console.log(`  · snapshot ${snapshotAt || '(none)'}: ${rows.length} skill-position row(s)`);

  const playerIds = parsePlayerIds(playerIdsCsv);
  const { entries, unmatched } = joinDepthToPlayers(rows, playerIds, ourPlayers);
  const teams = new Set(entries.map((e) => e.nflTeam)).size;
  console.log(`  · joined ${entries.length} entr(ies) across ${teams} team(s), ${unmatched.length} unmatched`);

  const starters = entries.filter((e) => e.depthRank === 1).length;
  console.log(`  · ${starters} listed as their position's DC1`);

  const depth: Depth = DepthSchema.parse({
    capturedAt,
    snapshotAt,
    season,
    entries,
    unmatched,
  });

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  if (entries.length < MIN_ENTRIES) {
    throw new Error(`write floor failed: only ${entries.length} entries (need >= ${MIN_ENTRIES})`);
  }
  if (teams < MIN_TEAMS) {
    throw new Error(`write floor failed: only ${teams} teams (need >= ${MIN_TEAMS})`);
  }

  writeData('depth.json', depth);
  console.log('Wrote data/depth.json');
}

main().catch((error) => {
  console.error(`\nSync failed — nothing was written.\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
