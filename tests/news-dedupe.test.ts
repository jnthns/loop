import { describe, expect, it } from 'vitest';
import {
  dedupeByPlayer,
  dedupeByTitle,
  headlineSubject,
  normalizeTitle,
  uniqueStories,
} from '~/lib/news/dedupe';
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

describe('dedupeByPlayer', () => {
  const espn = item({
    id: 'espn',
    title: 'Najee Harris carries the load',
    players: ['najee-harris'],
    publishedAt: '2026-09-10T11:00:00.000Z',
  });
  const yahoo = item({
    id: 'yahoo',
    title: 'Steelers back sees season-high touches',
    source: 'Yahoo',
    sourceId: 'yahoo',
    players: ['najee-harris'],
    publishedAt: '2026-09-10T09:00:00.000Z',
  });

  it('keeps one item per player even when the headlines differ', () => {
    expect(dedupeByPlayer([espn, yahoo]).map((i) => i.id)).toEqual(['espn']);
  });

  it('keeps the newest copy whatever order it is handed', () => {
    expect(dedupeByPlayer([yahoo, espn]).map((i) => i.id)).toEqual(['espn']);
  });

  it('preserves the caller’s ordering of the survivors', () => {
    const other = item({
      id: 'other',
      players: ['breece-hall'],
      publishedAt: '2026-09-10T10:00:00.000Z',
    });
    expect(dedupeByPlayer([other, espn, yahoo]).map((i) => i.id)).toEqual(['other', 'espn']);
  });

  it('lets a story about two players stand in for both', () => {
    const pair = item({
      id: 'pair',
      players: ['najee-harris', 'breece-hall'],
      publishedAt: '2026-09-10T12:00:00.000Z',
    });
    const hall = item({
      id: 'hall',
      players: ['breece-hall'],
      publishedAt: '2026-09-10T08:00:00.000Z',
    });
    expect(dedupeByPlayer([pair, espn, hall]).map((i) => i.id)).toEqual(['pair']);
  });

  it('keeps league-wide items that name nobody, collapsed by headline', () => {
    const a = item({ id: 'a', title: 'Waiver wire week 2' });
    const b = item({
      id: 'b',
      title: 'Waiver wire week 2.',
      publishedAt: '2026-09-09T10:00:00.000Z',
    });
    const c = item({ id: 'c', title: 'Something else' });
    expect(dedupeByPlayer([a, b, c]).map((i) => i.id)).toEqual(['a', 'c']);
  });

  it('can leave untagged headlines alone when asked', () => {
    const a = item({ id: 'a', title: 'Waiver wire week 2' });
    const b = item({
      id: 'b',
      title: 'Waiver wire week 2.',
      publishedAt: '2026-09-09T10:00:00.000Z',
    });
    const kept = dedupeByPlayer([a, b], { collapseUntaggedTitles: false });
    expect(kept.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('uniqueStories is the player rule with headline collapse on top', () => {
    expect(uniqueStories([espn, yahoo]).map((i) => i.id)).toEqual(['espn']);
  });
});

describe('headlineSubject', () => {
  it('finds the person a headline is about', () => {
    expect(headlineSubject('Source: Seahawks to sign former Cowboys CB Trevon Diggs')).toBe(
      'trevon diggs',
    );
    expect(headlineSubject('Seattle Seahawks signing former All-Pro corner Trevon Diggs')).toBe(
      'trevon diggs',
    );
    expect(headlineSubject('BREAKING: Texans WR Jayden Higgins has Torn ACL')).toBe(
      'jayden higgins',
    );
  });

  it('keeps initials attached to the name', () => {
    expect(headlineSubject("A.J. Brown says he hasn't spoken with Jalen Hurts")).toBe('a.j. brown');
  });

  it('refuses headlines that name no person', () => {
    expect(headlineSubject('Fantasy Football Week 1 Start Em Sit Em')).toBeNull();
    expect(headlineSubject('Dynasty Trade Value Chart: August update')).toBeNull();
    expect(headlineSubject('Bills beat Chiefs in overtime thriller')).toBeNull();
  });

  it('collapses an untagged player carried by three outlets', () => {
    const espn = item({
      id: 'espn',
      title: 'Source: Seahawks to sign former Cowboys CB Trevon Diggs',
      publishedAt: '2026-09-10T11:00:00.000Z',
    });
    const cbs = item({
      id: 'cbs',
      title: 'Seahawks signing ex-Cowboys cornerback Trevon Diggs',
      publishedAt: '2026-09-10T10:00:00.000Z',
    });
    const yahoo = item({
      id: 'yahoo',
      title: 'Seattle Seahawks signing former All-Pro corner Trevon Diggs',
      publishedAt: '2026-09-10T09:00:00.000Z',
    });
    const other = item({ id: 'other', title: 'Bills beat Chiefs in overtime thriller' });
    expect(uniqueStories([espn, cbs, yahoo, other]).map((i) => i.id)).toEqual(['espn', 'other']);
  });
});
