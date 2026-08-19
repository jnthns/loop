#!/usr/bin/env tsx
/**
 * sync-market — pull DynastyProcess's dynasty values into data/market.json.
 *
 *   npm run sync:market                 fetch + sync from DynastyProcess
 *   npm run sync:market -- --fixtures   map committed fixtures instead (offline)
 *   npm run sync:market -- --dry-run    report what would change, write nothing
 *
 * DynastyProcess's raw CSVs on GitHub are public and keyless, so this
 * introduces no secret.
 *
 * Safety rule: any fetch failure, or a response that fails the write floors
 * below, aborts before writing. A bad network day (or a CDN serving a
 * truncated file or an HTML error page) must never blank a good snapshot.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseValuesPlayers, parseValuesPicks, parsePlayerIds, joinToSleeper } from '../src/lib/market/dynastyprocess.ts';
import { MarketSchema, type Market, type Source } from '../src/lib/schemas/market.ts';
import { PlayersSchema, type Player } from '../src/lib/schemas/players.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const FIXTURES = join(ROOT, 'tests/fixtures/market');

const args = new Set(process.argv.slice(2));
const useFixtures = args.has('--fixtures');
const dryRun = args.has('--dry-run') || (useFixtures && !args.has('--write'));

const BASE = 'https://raw.githubusercontent.com/dynastyprocess/data/master/files';

// Write floors — refuse to write if any fails. A CDN serving a truncated file
// or an HTML error page must be a no-op, not a regression.
const MIN_PLAYERS = 400;
const MIN_PICKS = 40;
const MIN_MATCH_RATE = 0.6;

/**
 * What this snapshot is actually built from.
 *
 * Only the first entry is fetched: three public CSVs from DynastyProcess's
 * GitHub repo. The second is the upstream those CSVs are derived from —
 * DynastyProcess computes both `ecr_*` and `value_*` from FantasyPros
 * consensus, which is why the two must never be cited as independent
 * agreement.
 *
 * KeepTradeCut is deliberately *not* listed. Nothing here reads KTC: no
 * request is ever made to keeptradecut.com, and `values-players.csv` has no
 * KTC column. The `ktc_id` in `db_playerids.csv` is an id crosswalk we use to
 * build deep links to KTC player pages, which is linking, not sourcing. Listing
 * it as a data source claimed provenance we do not have.
 */
const SOURCES: Source[] = [
  { label: 'DynastyProcess dynasty values', url: 'https://github.com/dynastyprocess/data', kind: 'dataset' },
  {
    label: 'FantasyPros dynasty rankings (upstream of the DynastyProcess ECR and value columns)',
    url: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php',
    kind: 'rankings',
  },
];

function readData(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA, file), 'utf8'));
}

function writeData(file: string, value: unknown): void {
  writeFileSync(join(DATA, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readFixture(name: string): string {
  const path = join(FIXTURES, name);
  if (!existsSync(path)) throw new Error(`missing fixture: tests/fixtures/market/${name}`);
  return readFileSync(path, 'utf8');
}

async function fetchCsv(name: string): Promise<string> {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`fetch ${name} failed: ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (text.trim().length === 0) throw new Error(`fetch ${name} returned an empty body`);
  return text;
}

interface CsvBundle {
  valuesPlayersCsv: string;
  valuesPicksCsv: string;
  playerIdsCsv: string;
}

async function fixtureCsvs(): Promise<CsvBundle> {
  return {
    valuesPlayersCsv: readFixture('values-players.csv'),
    valuesPicksCsv: readFixture('values-picks.csv'),
    playerIdsCsv: readFixture('db_playerids.csv'),
  };
}

async function liveCsvs(): Promise<CsvBundle> {
  const [valuesPlayersCsv, valuesPicksCsv, playerIdsCsv] = await Promise.all([
    fetchCsv('values-players.csv'),
    fetchCsv('values-picks.csv'),
    fetchCsv('db_playerids.csv'),
  ]);
  return { valuesPlayersCsv, valuesPicksCsv, playerIdsCsv };
}

async function main() {
  const capturedAt = new Date().toISOString();
  const ourPlayers = PlayersSchema.parse(readData('players.json'));

  console.log(`${useFixtures ? 'Mapping fixtures for' : 'Syncing'} DynastyProcess market data…`);

  const { valuesPlayersCsv, valuesPicksCsv, playerIdsCsv } = useFixtures
    ? await fixtureCsvs()
    : await liveCsvs();
  console.log('  · fetched values-players.csv, values-picks.csv, db_playerids.csv');

  const valuesPlayers = parseValuesPlayers(valuesPlayersCsv);
  const picks = parseValuesPicks(valuesPicksCsv);
  const playerIds = parsePlayerIds(playerIdsCsv);
  console.log(`  · parsed ${valuesPlayers.length} player row(s), ${picks.length} pick row(s)`);

  const { players, unmatched } = joinToSleeper(valuesPlayers, playerIds, ourPlayers as Player[]);
  const matchRate = players.length > 0 ? (players.length - unmatched.length) / players.length : 0;
  console.log(
    `  · join: ${players.length - unmatched.length}/${players.length} matched ` +
      `(${(matchRate * 100).toFixed(1)}%), ${unmatched.length} unmatched`,
  );

  const scrapeDate = valuesPlayers[0]?.scrapeDate ?? '';

  const market: Market = MarketSchema.parse({
    capturedAt,
    scrapeDate,
    sources: SOURCES,
    players,
    picks,
    unmatched,
  });

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  if (players.length < MIN_PLAYERS) {
    throw new Error(`write floor failed: only ${players.length} players (need >= ${MIN_PLAYERS})`);
  }
  if (picks.length < MIN_PICKS) {
    throw new Error(`write floor failed: only ${picks.length} picks (need >= ${MIN_PICKS})`);
  }
  if (matchRate < MIN_MATCH_RATE) {
    throw new Error(
      `write floor failed: match rate ${(matchRate * 100).toFixed(1)}% (need >= ${MIN_MATCH_RATE * 100}%)`,
    );
  }

  writeData('market.json', market);
  console.log('Wrote data/market.json');
}

main().catch((error) => {
  console.error(`\nSync failed — nothing was written.\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
