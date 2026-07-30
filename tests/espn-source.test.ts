import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEspnNews } from '~/lib/news/sources/espn';
import { NewsSchema } from '~/lib/schemas/news';
import { mergeNews } from '~/lib/news/merge';
import { parseFeed } from '~/lib/news/normalize';
import { fixturePlayerNames } from './fixtures/league';

const players = fixturePlayerNames;
const raw = JSON.parse(
  readFileSync(join(process.cwd(), 'tests/fixtures/espn-api.json'), 'utf8'),
);
const items = parseEspnNews(raw, { players });

describe('parseEspnNews', () => {
  it('parses usable articles and drops the linkless one', () => {
    expect(items).toHaveLength(3);
  });

  it('produces schema-valid items', () => {
    expect(NewsSchema.safeParse(items).success).toBe(true);
  });

  it('canonicalizes links, stripping ESPN tracking params', () => {
    expect(items[0].url).toBe('https://example.com/espn/chase-restructure');
  });

  it('strips HTML from descriptions', () => {
    expect(items[0].summary).toBe('Cincinnati reworked the contract ahead of the deadline.');
  });

  it('normalizes timestamps to ISO', () => {
    expect(items[0].publishedAt).toBe('2026-09-10T08:00:00.000Z');
  });

  it('uses the named athlete, not just a prose match', () => {
    expect(items[0].players).toContain('jamarr-chase');
    // The Bowers headline says only "Bowers", so the category is doing the work.
    expect(items[1].players).toContain('brock-bowers');
  });

  it('uppercases team abbreviations from categories', () => {
    expect(items[0].teams).toContain('CIN');
  });

  it('still applies keyword tagging', () => {
    expect(items[0].tags).toContain('contract');
    expect(items[2].tags).toContain('injury');
  });

  it('returns nothing for junk rather than throwing', () => {
    expect(parseEspnNews({ nope: true })).toEqual([]);
    expect(parseEspnNews(null)).toEqual([]);
    expect(parseEspnNews('not json at all')).toEqual([]);
  });

  it('tolerates an empty article list', () => {
    expect(parseEspnNews({ articles: [] })).toEqual([]);
  });
});

describe('ESPN items merge with RSS items', () => {
  const rss = parseFeed(
    readFileSync(join(process.cwd(), 'tests/fixtures/espn-nfl.xml'), 'utf8'),
    {
      id: 'espn-nfl',
      name: 'ESPN NFL',
      url: 'https://www.espn.com/espn/rss/nfl/news',
      category: 'league-news',
      enabled: true,
    },
    { players },
  );

  it('dedupes across the two ESPN surfaces by canonical URL', () => {
    const merged = mergeNews(rss, items, { now: new Date('2026-09-11T00:00:00.000Z') });
    expect(new Set(merged.map((i) => i.id)).size).toBe(merged.length);
  });

  it('is idempotent when the same ESPN payload arrives twice', () => {
    const once = mergeNews([], items, { now: new Date('2026-09-11T00:00:00.000Z') });
    const twice = mergeNews(once, items, { now: new Date('2026-09-11T00:00:00.000Z') });
    expect(twice).toHaveLength(once.length);
  });
});
