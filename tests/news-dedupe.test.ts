import { describe, expect, it } from 'vitest';
import { dedupeByTitle, normalizeTitle } from '~/lib/news/dedupe';
import type { NewsItem } from '~/lib/schemas/news';

function item(o: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${o.id}`,
    url: `https://example.com/${o.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T10:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...o,
  };
}

describe('normalizeTitle', () => {
  it('lowercases and collapses whitespace', () => {
    expect(normalizeTitle('  The   Gabe   Jacas  ')).toBe('the gabe jacas');
  });

  it('strips trailing punctuation', () => {
    expect(normalizeTitle('Chase ruled out!!!')).toBe('chase ruled out');
  });
});

describe('dedupeByTitle', () => {
  it('keeps the newest item when titles match', () => {
    const items = [
      item({
        id: 'older',
        title: 'The Gabe Jacas injury waiver is unusual',
        publishedAt: '2026-09-09T10:00:00.000Z',
        source: 'Pro Football Talk',
      }),
      item({
        id: 'newer',
        title: 'The Gabe Jacas injury waiver is unusual.',
        publishedAt: '2026-09-10T10:00:00.000Z',
        source: 'Yahoo Sports NFL',
      }),
    ];
    const out = dedupeByTitle(items);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('newer');
  });

  it('preserves distinct titles', () => {
    const items = [
      item({ id: 'a', title: 'Alpha story' }),
      item({ id: 'b', title: 'Beta story' }),
    ];
    expect(dedupeByTitle(items)).toHaveLength(2);
  });

  it('keeps the first item when strategy is first', () => {
    const items = [
      item({
        id: 'first',
        title: 'Same headline',
        publishedAt: '2026-09-09T10:00:00.000Z',
      }),
      item({
        id: 'second',
        title: 'Same headline',
        publishedAt: '2026-09-10T10:00:00.000Z',
      }),
    ];
    const out = dedupeByTitle(items, { strategy: 'first' });
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('first');
  });
});
