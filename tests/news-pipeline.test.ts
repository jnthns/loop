import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { canonicalUrl, isFantasyRelevant, newsId, parseFeed, stripHtml } from '~/lib/news/normalize';
import { mergeNews } from '~/lib/news/merge';
import { NewsSchema, type Feed } from '~/lib/schemas/news';
import { fixturePlayerNames } from './fixtures/league';

// Frozen fixture, not data/players.json — the sync rewrites that file.
const players = fixturePlayerNames;

const fixture = (name: string) =>
  readFileSync(join(process.cwd(), 'tests/fixtures', name), 'utf8');

const rssFeed: Feed = {
  id: 'espn-nfl',
  name: 'ESPN NFL',
  url: 'https://www.espn.com/espn/rss/nfl/news',
  category: 'league-news',
  enabled: true,
};

const atomFeed: Feed = {
  id: 'reddit-dynastyff',
  name: 'r/DynastyFF',
  url: 'https://www.reddit.com/r/DynastyFF/.rss',
  category: 'dynasty',
  enabled: true,
};

describe('canonicalUrl', () => {
  it('drops tracking params and fragments', () => {
    expect(canonicalUrl('https://ex.com/a?utm_source=rss&utm_medium=feed#top')).toBe(
      'https://ex.com/a',
    );
  });

  it('normalizes the trailing slash', () => {
    expect(canonicalUrl('https://ex.com/a/')).toBe(canonicalUrl('https://ex.com/a'));
  });

  it('keeps meaningful query params', () => {
    expect(canonicalUrl('https://ex.com/a?id=7')).toBe('https://ex.com/a?id=7');
  });

  it('passes through anything unparseable', () => {
    expect(canonicalUrl('not a url')).toBe('not a url');
  });
});

describe('newsId', () => {
  it('is stable for the same canonical URL', () => {
    expect(newsId('https://ex.com/a?utm_source=x')).toBe(newsId('https://ex.com/a/'));
  });

  it('differs across stories', () => {
    expect(newsId('https://ex.com/a')).not.toBe(newsId('https://ex.com/b'));
  });
});

describe('stripHtml', () => {
  it('removes markup and decodes common entities', () => {
    expect(stripHtml('<p>Hello &amp; welcome</p>')).toBe('Hello & welcome');
  });
});

describe('parseFeed — RSS', () => {
  const items = parseFeed(fixture('espn-nfl.xml'), rssFeed, { players });

  it('parses every usable entry and drops the untitled one', () => {
    expect(items).toHaveLength(3);
  });

  it('produces schema-valid items', () => {
    expect(NewsSchema.safeParse(items).success).toBe(true);
  });

  it('canonicalizes links', () => {
    expect(items[0].url).toBe('https://example.com/nfl/story/robinson-injury');
  });

  it('strips HTML out of summaries', () => {
    expect(items[0].summary).not.toContain('<');
    expect(items[0].summary).toContain('hamstring');
  });

  it('normalizes publication dates to ISO', () => {
    expect(items[0].publishedAt).toBe('2026-09-09T14:30:00.000Z');
  });

  it('tags the source category', () => {
    expect(items[0].tags).toContain('league-news');
  });

  it('detects rostered players by name', () => {
    expect(items[0].players).toContain('bijan-robinson');
    expect(items[1].players).toContain('jamarr-chase');
    expect(items[2].players).toEqual([]);
  });

  it('detects NFL teams', () => {
    expect(items[0].teams).toContain('ATL');
    expect(items[1].teams).toContain('CIN');
    expect(items[2].teams).toContain('LV');
  });

  it('applies keyword tags', () => {
    expect(items[0].tags).toContain('injury');
    expect(items[1].tags).toContain('contract');
    expect(items[2].tags).toContain('trade');
  });
});

describe('parseFeed — Atom', () => {
  const items = parseFeed(fixture('reddit-dynastyff.xml'), atomFeed, { players });

  it('parses Atom entries that report actionable news', () => {
    expect(items).toHaveLength(1);
    expect(items[0].title).toContain('Bijan Robinson');
    expect(NewsSchema.safeParse(items).success).toBe(true);
  });

  it('drops dynasty discussion threads with no roster or health signal', () => {
    expect(items.some((i) => i.title.includes('sell Saquon'))).toBe(false);
    expect(items.some((i) => i.title.includes('draft pick value'))).toBe(false);
  });

  it('reads the alternate link href', () => {
    expect(items[0].url).toBe('https://example.com/nfl/story/robinson-injury');
  });

  it('prefers published over updated', () => {
    expect(items[0].publishedAt).toBe('2026-09-09T15:00:00.000Z');
  });

  it('reads content when there is no summary', () => {
    expect(items[0].summary).toContain('Cross-posted');
  });
});

describe('parseFeed — resilience', () => {
  it('returns nothing for junk input rather than throwing', () => {
    expect(parseFeed('this is not xml at all', rssFeed)).toEqual([]);
    expect(parseFeed('', rssFeed)).toEqual([]);
  });

  it('returns nothing for a well-formed but unknown document shape', () => {
    expect(parseFeed('<other><thing>x</thing></other>', rssFeed)).toEqual([]);
  });
});

describe('mergeNews', () => {
  const rss = parseFeed(fixture('espn-nfl.xml'), rssFeed, { players });
  const atom = parseFeed(fixture('reddit-dynastyff.xml'), atomFeed, { players });
  const now = new Date('2026-09-11T00:00:00.000Z');

  it('is idempotent — merging the same fetch twice adds nothing', () => {
    const once = mergeNews([], rss, { now });
    const twice = mergeNews(once, rss, { now });
    expect(twice).toHaveLength(once.length);
    expect(new Set(twice.map((i) => i.id)).size).toBe(twice.length);
  });

  it('collapses the same story arriving from two different feeds', () => {
    const merged = mergeNews(rss, atom, { now });
    // 3 actionable RSS + 1 actionable Atom (injury cross-post), deduped.
    expect(merged).toHaveLength(3);
    expect(new Set(merged.map((i) => i.id)).size).toBe(merged.length);
  });

  it('sorts newest first', () => {
    const merged = mergeNews(rss, atom, { now });
    const dates = merged.map((i) => i.publishedAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('keeps the first-seen publication time when a story is refetched', () => {
    const merged = mergeNews(rss, atom, { now });
    const shared = merged.find((i) => i.url === 'https://example.com/nfl/story/robinson-injury')!;
    expect(shared.publishedAt).toBe('2026-09-09T14:30:00.000Z');
  });

  it('unions enrichment rather than overwriting it', () => {
    const [first] = rss;
    const handTagged = { ...first, tags: [...first.tags, 'hand-added'] };
    const merged = mergeNews([handTagged], rss, { now });
    expect(merged.find((i) => i.id === first.id)!.tags).toContain('hand-added');
  });

  it('enforces the retention cap', () => {
    const merged = mergeNews([], [...rss, ...atom], { now, limit: 2 });
    expect(merged).toHaveLength(2);
  });

  it('drops items past the age cutoff', () => {
    const merged = mergeNews([], rss, { now, maxAgeDays: 1 });
    expect(merged.length).toBeLessThan(rss.length);
  });

  it('prunes fluff already on file when merging', () => {
    const fluff = {
      id: 'fluff123',
      title: "Ben Johnson: Caleb Williams has it all, there's nothing he can't do",
      url: 'https://example.com/fluff',
      source: 'ESPN',
      sourceId: 'espn-api',
      publishedAt: '2026-09-10T12:00:00.000Z',
      summary: 'Praise without roster or health signal.',
      tags: ['league-news'],
      players: ['caleb-williams'],
      teams: ['CHI'],
    };
    const merged = mergeNews([fluff], rss, { now });
    expect(merged.some((i) => i.id === 'fluff123')).toBe(false);
  });
});

describe('isFantasyRelevant', () => {
  const base = {
    id: 'x',
    url: 'https://example.com/x',
    source: 'ESPN',
    sourceId: 'espn-api',
    publishedAt: '2026-09-10T12:00:00.000Z',
    summary: '',
    players: [],
    teams: [],
  };

  it('keeps injury and availability reports', () => {
    expect(
      isFantasyRelevant({
        ...base,
        title: "Ravens' Madubuike (neck) practices for 1st time in 10 months",
        tags: ['league-news', 'availability'],
      }),
    ).toBe(true);
    expect(
      isFantasyRelevant({
        ...base,
        title: 'Bijan Robinson not participating in Falcons practice, seeks new contract',
        tags: ['league-news', 'contract', 'availability'],
      }),
    ).toBe(true);
  });

  it('keeps coach usage and roster-move signals', () => {
    expect(
      isFantasyRelevant({
        ...base,
        title: 'HC Reid on rookie WR Cyrus Allen working with the first-team offense',
        tags: ['dynasty', 'rookie', 'usage'],
      }),
    ).toBe(true);
    expect(
      isFantasyRelevant({
        ...base,
        title: 'Texans sign WR DJ Turner',
        tags: ['league-news', 'roster-move'],
      }),
    ).toBe(true);
  });

  it('drops praise and human-interest fluff', () => {
    expect(
      isFantasyRelevant({
        ...base,
        title: "Ben Johnson: Caleb Williams has it all, there's nothing he can't do",
        tags: ['league-news'],
        players: ['caleb-williams'],
      }),
    ).toBe(false);
    expect(
      isFantasyRelevant({
        ...base,
        title: 'Saquon Barkley wants to be remembered for more than backward hurdle',
        tags: ['league-news'],
        players: ['saquon-barkley'],
      }),
    ).toBe(false);
  });
});
