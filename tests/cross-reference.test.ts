import { describe, expect, it } from 'vitest';
import {
  coverageGaps,
  facetCoverage,
  openSlots,
  rosterAlerts,
  watchLists,
} from '~/lib/insights/cross-reference';
import type { NewsItem } from '~/lib/schemas/news';
import { fixturePlayers, fixtureTeam } from './fixtures/league';

// Frozen fixture, not the synced data files — see tests/fixtures/league.ts.
const players = fixturePlayers;
const team = fixtureTeam;
const NOW = new Date('2026-09-10T12:00:00.000Z');

function item(o: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${o.id}`,
    url: `https://example.com/${o.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T09:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...o,
  };
}

describe('watchLists', () => {
  it('separates rostered players from targets', () => {
    const { rostered, targeted } = watchLists(team);
    expect(rostered.has('jamarr-chase')).toBe(true);
    expect(targeted.has('brock-bowers')).toBe(true);
    expect(rostered.has('brock-bowers')).toBe(false);
  });

  it('never counts an owned player as a target', () => {
    const owned = 'jamarr-chase';
    const withRedundantTarget = {
      ...team,
      targets: [
        ...team.targets,
        {
          id: 't-redundant',
          slotId: 'wr-1',
          playerId: owned,
          priority: 1,
          rationale: 'already owned',
          cost: '',
        },
      ],
    };
    const { rostered, targeted } = watchLists(withRedundantTarget);
    expect(rostered.has(owned)).toBe(true);
    expect(targeted.has(owned)).toBe(false);
  });

  it('ignores empty slots', () => {
    const { rostered } = watchLists(team);
    expect(rostered.has('')).toBe(false);
    expect([...rostered].every(Boolean)).toBe(true);
  });
});

describe('rosterAlerts', () => {
  const news = [
    item({ id: 'own', players: ['jamarr-chase'] }),
    item({ id: 'target', players: ['brock-bowers'], publishedAt: '2026-09-10T11:00:00.000Z' }),
    item({ id: 'other', players: ['patrick-mahomes'] }),
    item({ id: 'none', players: [] }),
  ];

  it('flags news about rostered players', () => {
    const alerts = rosterAlerts(news, team, players, { now: NOW });
    expect(alerts.map((a) => a.item.id)).toContain('own');
  });

  it('flags news about targets, marked differently', () => {
    const alerts = rosterAlerts(news, team, players, { now: NOW });
    const target = alerts.find((a) => a.item.id === 'target')!;
    expect(target.relation).toBe('target');
  });

  it('ignores news about players in neither list', () => {
    const alerts = rosterAlerts(news, team, players, { now: NOW });
    expect(alerts.map((a) => a.item.id)).not.toContain('none');
    // Mahomes is a target in the seed data, so use a genuinely unrelated player.
    const unrelated = rosterAlerts([item({ id: 'x', players: ['nobody'] })], team, players, {
      now: NOW,
    });
    expect(unrelated).toEqual([]);
  });

  it('ranks rostered players ahead of targets even when the target is newer', () => {
    const alerts = rosterAlerts(news, team, players, { now: NOW });
    expect(alerts[0].relation).toBe('rostered');
  });

  it('names the players that matched', () => {
    const alerts = rosterAlerts(news, team, players, { now: NOW });
    const own = alerts.find((a) => a.item.id === 'own')!;
    expect(own.matches.map((m) => m.player.name)).toEqual(["Ja'Marr Chase"]);
  });

  it('drops stale news — an old story is not an alert', () => {
    const old = [item({ id: 'old', players: ['jamarr-chase'], publishedAt: '2026-01-01T00:00:00.000Z' })];
    expect(rosterAlerts(old, team, players, { now: NOW })).toEqual([]);
  });

  it('ignores player ids that are not in the player file', () => {
    const ghost = [item({ id: 'ghost', players: ['who-is-this'] })];
    expect(rosterAlerts(ghost, team, players, { now: NOW })).toEqual([]);
  });

  it('respects the limit', () => {
    const roster = ['jamarr-chase', 'bijan-robinson', 'devon-achane', 'nico-collins', 'puka-nacua'];
    const many = roster.map((id, i) => item({ id: `n${i}`, players: [id] }));
    expect(rosterAlerts(many, team, players, { now: NOW, limit: 3 })).toHaveLength(3);
  });

  it('raises one alert per player, not one per outlet carrying the story', () => {
    const syndicated = Array.from({ length: 20 }, (_, i) =>
      item({
        id: `n${i}`,
        players: ['jamarr-chase'],
        publishedAt: `2026-09-10T${String(i).padStart(2, '0')}:00:00.000Z`,
      }),
    );
    const alerts = rosterAlerts(syndicated, team, players, { now: NOW });
    expect(alerts).toHaveLength(1);
    // The newest copy is the one that survives.
    expect(alerts[0].item.id).toBe('n19');
  });

  it('keeps a two-player story once, and does not then repeat either player', () => {
    const both = item({
      id: 'both',
      players: ['jamarr-chase', 'bijan-robinson'],
      publishedAt: '2026-09-10T10:00:00.000Z',
    });
    const older = item({
      id: 'older',
      players: ['bijan-robinson'],
      publishedAt: '2026-09-10T08:00:00.000Z',
    });
    const alerts = rosterAlerts([both, older], team, players, { now: NOW });
    expect(alerts.map((a) => a.item.id)).toEqual(['both']);
  });

  it('returns nothing when there is no news', () => {
    expect(rosterAlerts([], team, players, { now: NOW })).toEqual([]);
  });
});

describe('facetCoverage', () => {
  const recent = new Date('2026-09-01T00:00:00.000Z');
  const ancient = new Date('2025-01-01T00:00:00.000Z');

  it('marks a facet with no articles as empty', () => {
    const coverage = facetCoverage([], { now: NOW });
    expect(coverage.every((c) => c.reason === 'empty')).toBe(true);
  });

  it('marks an old facet as stale and a fresh one as covered', () => {
    const coverage = facetCoverage(
      [
        { facet: 'trading', updated: recent },
        { facet: 'rookie-drafts', updated: ancient },
      ],
      { now: NOW },
    );
    expect(coverage.find((c) => c.id === 'trading')!.reason).toBe('covered');
    expect(coverage.find((c) => c.id === 'rookie-drafts')!.reason).toBe('stale');
  });

  it('uses the newest article in a facet, not the oldest', () => {
    const coverage = facetCoverage(
      [
        { facet: 'trading', updated: ancient },
        { facet: 'trading', updated: recent },
      ],
      { now: NOW },
    );
    const trading = coverage.find((c) => c.id === 'trading')!;
    expect(trading.count).toBe(2);
    expect(trading.reason).toBe('covered');
  });

  it('sorts empty facets first, then stalest', () => {
    const coverage = facetCoverage(
      [
        { facet: 'trading', updated: recent },
        { facet: 'rookie-drafts', updated: ancient },
      ],
      { now: NOW },
    );
    expect(coverage[0].reason).toBe('empty');
    expect(coverage.at(-1)!.id).toBe('trading');
  });

  it('coverageGaps keeps only what needs attention', () => {
    const gaps = coverageGaps(facetCoverage([{ facet: 'trading', updated: recent }], { now: NOW }));
    expect(gaps.some((g) => g.id === 'trading')).toBe(false);
    expect(gaps.length).toBeGreaterThan(0);
  });
});

describe('openSlots', () => {
  it('lists unfilled slots with their labels', () => {
    const open = openSlots(team);
    expect(open.length).toBeGreaterThan(0);
    expect(open.every((s) => s.label !== '')).toBe(true);
    expect(open.some((s) => s.slotId === 'taxi-1')).toBe(true);
  });

  it('excludes filled slots', () => {
    expect(openSlots(team).some((s) => s.slotId === 'wr-1')).toBe(false);
  });
});
