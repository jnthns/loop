#!/usr/bin/env tsx
/**
 * fetch-news — the only thing in this repo that touches the network.
 *
 *   npm run news:fetch                fetch every enabled feed in data/feeds.json
 *   npm run news:fetch -- --fixtures  parse tests/fixtures/*.xml instead (offline)
 *   npm run news:fetch -- --dry-run   report what would change, write nothing
 *
 * --fixtures implies --dry-run: fixture headlines are invented for tests, and
 * committing them would put fake news in front of a reader. Pass --write to
 * override, which you should essentially never want.
 *
 * It writes data/news.json and nothing else. Builds, tests, and the site never
 * fetch anything: they read the committed snapshot. Individual feed failures are
 * logged and skipped so one dead host cannot lose an entire run.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FeedsSchema, NewsSchema, type Feed, type NewsItem } from '../src/lib/schemas/news.ts';
import { PlayersSchema } from '../src/lib/schemas/players.ts';
import { parseFeed } from '../src/lib/news/normalize.ts';
import { mergeNews } from '../src/lib/news/merge.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const FIXTURES = join(ROOT, 'tests/fixtures');

const args = new Set(process.argv.slice(2));
const useFixtures = args.has('--fixtures');
const dryRun = args.has('--dry-run') || (useFixtures && !args.has('--write'));

const USER_AGENT =
  'dynasty-guide/0.1 (+https://github.com/jnthns/loop; RSS reader for a personal fantasy football site)';
const TIMEOUT_MS = 20_000;

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA, file), 'utf8'));
}

async function fetchFeed(feed: Feed): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/rss+xml, application/xml, */*' },
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`  ! ${feed.id}: HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(`  ! ${feed.id}: ${(error as Error).message}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** In fixture mode, map each feed to tests/fixtures/<id>.xml, else any fixture. */
function readFixture(feed: Feed): string | null {
  const named = join(FIXTURES, `${feed.id}.xml`);
  if (existsSync(named)) return readFileSync(named, 'utf8');
  return null;
}

async function main() {
  const feeds = FeedsSchema.parse(readJson('feeds.json')).filter((f) => f.enabled);
  const players = PlayersSchema.parse(readJson('players.json')).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const existing = NewsSchema.parse(readJson('news.json'));

  console.log(
    `${useFixtures ? 'Parsing fixtures for' : 'Fetching'} ${feeds.length} feed(s); ${existing.length} item(s) on file.`,
  );

  const incoming: NewsItem[] = [];
  let sourcesRead = 0;

  for (const feed of feeds) {
    const xml = useFixtures ? readFixture(feed) : await fetchFeed(feed);
    if (!xml) continue;
    sourcesRead += 1;
    const items = parseFeed(xml, feed, { players });
    console.log(`  · ${feed.id}: ${items.length} item(s)`);
    incoming.push(...items);
  }

  if (useFixtures && sourcesRead === 0) {
    const available = existsSync(FIXTURES) ? readdirSync(FIXTURES).join(', ') : '(none)';
    throw new Error(
      `--fixtures found no tests/fixtures/<feed-id>.xml for any enabled feed. Available: ${available}`,
    );
  }

  const merged = mergeNews(existing, incoming);
  const added = merged.length - existing.length;

  console.log(
    `Read ${sourcesRead}/${feeds.length} source(s), ${incoming.length} item(s) in; ` +
      `${merged.length} retained (${added >= 0 ? '+' : ''}${added}).`,
  );

  if (dryRun) {
    console.log('Dry run — data/news.json not written.');
    return;
  }

  // Validate before writing: a bad write would fail the next build instead.
  NewsSchema.parse(merged);
  writeFileSync(join(DATA, 'news.json'), `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  console.log('Wrote data/news.json');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
