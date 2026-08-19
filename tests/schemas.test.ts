import { describe, expect, it } from 'vitest';
import { FeedsSchema, NewsItemSchema, NewsSchema } from '~/lib/schemas/news';
import { PlayersSchema, PlayerSchema } from '~/lib/schemas/players';
import { TeamSchema, eligiblePositions } from '~/lib/schemas/team';
import { InsightsSchema, hasCitation, type Suggestion } from '~/lib/schemas/insights';
import { DepthSchema } from '~/lib/schemas/depth';
import { ProfilesSchema, ProfileSchema } from '~/lib/schemas/profiles';

import feeds from '../data/feeds.json';
import news from '../data/news.json';
import players from '../data/players.json';
import team from '../data/team.json';
import insights from '../data/insights.json';
import depth from '../data/depth.json';
import profiles from '../data/profiles.json';

/**
 * This file, and this file alone (with tests/insights.test.ts), asserts against
 * the synced data files. It checks **shape and referential integrity**, never
 * specific players — those change every six hours when the Sleeper sync runs.
 * Behavior tests use tests/fixtures/league.ts; tests/data-coupling.test.ts
 * enforces that split.
 */
describe('committed data files', () => {
  it('data/feeds.json is valid', () => {
    expect(FeedsSchema.safeParse(feeds).success).toBe(true);
  });

  it('data/news.json is valid', () => {
    expect(NewsSchema.safeParse(news).success).toBe(true);
  });

  it('data/players.json is valid', () => {
    expect(PlayersSchema.safeParse(players).success).toBe(true);
  });

  it('data/team.json is valid', () => {
    const result = TeamSchema.safeParse(team);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('data/insights.json is valid', () => {
    expect(InsightsSchema.safeParse(insights).success).toBe(true);
  });

  it('data/depth.json is valid', () => {
    const result = DepthSchema.safeParse(depth);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });

  it('data/profiles.json is valid', () => {
    const result = ProfilesSchema.safeParse(profiles);
    expect(result.error?.issues ?? []).toEqual([]);
    expect(result.success).toBe(true);
  });
});

/**
 * Scouting profiles are the one place in the app where prose about a real
 * player is rendered as fact, and the loop can write them unattended. The
 * schema already refuses an uncited profile; these checks cover what a schema
 * cannot see — that the citation points somewhere real, that the player exists,
 * and that the reporting has not quietly rotted into last season.
 */
describe('scouting profiles', () => {
  const parsed = ProfilesSchema.parse(profiles);
  const parsedPlayers = PlayersSchema.parse(players);
  const playerIds = new Set(parsedPlayers.map((p) => p.id));

  /** Matches the 45-day staleness window the knowledge collection already uses. */
  const MAX_AGE_DAYS = 45;

  it('every profile points at a player we actually track', () => {
    for (const profile of parsed) {
      expect(playerIds.has(profile.playerId), `unknown player ${profile.playerId}`).toBe(true);
    }
  });

  it('profiles are unique per player', () => {
    const ids = parsed.map((p) => p.playerId);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('every profile cites at least one usable source', () => {
    for (const profile of parsed) {
      expect(profile.sources.length, `${profile.playerId} cites nothing`).toBeGreaterThan(0);
      for (const source of profile.sources) {
        expect(source.url.startsWith('https://'), `${profile.playerId}: ${source.url}`).toBe(true);
        expect(source.label.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('no profile has gone stale', () => {
    for (const profile of parsed) {
      const asOf = new Date(profile.asOf);
      expect(Number.isNaN(asOf.getTime()), `${profile.playerId} has an unparseable asOf`).toBe(false);
      const ageDays = (Date.now() - asOf.getTime()) / 86_400_000;
      expect(
        ageDays,
        `${profile.playerId} was last checked ${Math.round(ageDays)} days ago — re-verify the reporting or drop the profile`,
      ).toBeLessThan(MAX_AGE_DAYS);
    }
  });

  it('rejects a profile that cites nothing', () => {
    const result = ProfileSchema.safeParse({
      playerId: 'someone',
      headline: 'h',
      role: 'r',
      fit: 'f',
      risk: 'x',
      asOf: '2026-08-18',
      sources: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('referential integrity across data files', () => {
  const parsedTeam = TeamSchema.parse(team);
  const parsedPlayers = PlayersSchema.parse(players);
  const playerIds = new Set(parsedPlayers.map((p) => p.id));
  const slotIds = new Set(parsedTeam.format.rosterSlots.map((s) => s.id));

  it('every roster entry points at a real slot', () => {
    for (const entry of parsedTeam.roster) {
      expect(slotIds.has(entry.slotId), `unknown slot ${entry.slotId}`).toBe(true);
    }
  });

  it('every roster entry points at a real player or an empty slot', () => {
    for (const entry of parsedTeam.roster) {
      if (entry.playerId === null) continue;
      expect(playerIds.has(entry.playerId), `unknown player ${entry.playerId}`).toBe(true);
    }
  });

  it('every slot appears exactly once in the roster', () => {
    const seen = parsedTeam.roster.map((r) => r.slotId);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen.length).toBe(parsedTeam.format.rosterSlots.length);
  });

  it('every target points at a real slot and player', () => {
    for (const target of parsedTeam.targets) {
      expect(slotIds.has(target.slotId), `unknown slot ${target.slotId}`).toBe(true);
      expect(playerIds.has(target.playerId), `unknown player ${target.playerId}`).toBe(true);
    }
  });

  it('every target is eligible for the slot it is listed under', () => {
    const byId = new Map(parsedPlayers.map((p) => [p.id, p]));
    const slotById = new Map(parsedTeam.format.rosterSlots.map((s) => [s.id, s]));
    for (const target of parsedTeam.targets) {
      const player = byId.get(target.playerId)!;
      const slot = slotById.get(target.slotId)!;
      expect(
        eligiblePositions(slot.kind).includes(player.pos),
        `${player.name} (${player.pos}) is not eligible for ${slot.label}`,
      ).toBe(true);
    }
  });

  it('player ids are unique', () => {
    expect(new Set(parsedPlayers.map((p) => p.id)).size).toBe(parsedPlayers.length);
  });
});

describe('schema rejection', () => {
  it('rejects a player with no position', () => {
    expect(PlayerSchema.safeParse({ id: 'x', name: 'X', nflTeam: 'BUF', age: 25 }).success).toBe(
      false,
    );
  });

  it('rejects a news item without a valid URL', () => {
    const bad = {
      id: 'x',
      title: 'X',
      url: 'not-a-url',
      source: 'S',
      sourceId: 's',
      publishedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(NewsItemSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a news item with a non-ISO timestamp', () => {
    const bad = {
      id: 'x',
      title: 'X',
      url: 'https://example.com/x',
      source: 'S',
      sourceId: 's',
      publishedAt: 'last Tuesday',
    };
    expect(NewsItemSchema.safeParse(bad).success).toBe(false);
  });

  it('applies defaults for optional news fields', () => {
    const parsed = NewsItemSchema.parse({
      id: 'x',
      title: 'X',
      url: 'https://example.com/x',
      source: 'S',
      sourceId: 's',
      publishedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(parsed.tags).toEqual([]);
    expect(parsed.players).toEqual([]);
    expect(parsed.summary).toBe('');
  });
});

describe('eligiblePositions', () => {
  it('opens FLEX to RB/WR/TE and SUPERFLEX to QB as well', () => {
    expect(eligiblePositions('FLEX')).toEqual(['RB', 'WR', 'TE']);
    expect(eligiblePositions('SUPERFLEX')).toContain('QB');
  });

  it('keeps dedicated slots to their own position', () => {
    expect(eligiblePositions('TE')).toEqual(['TE']);
  });
});

describe('hasCitation', () => {
  const base: Suggestion = {
    id: 's1',
    kind: 'buy',
    headline: 'h',
    detail: 'd',
    players: [],
    newsRefs: [],
    knowledgeRefs: [],
    confidence: 'low',
  };

  it('rejects a suggestion that cites nothing', () => {
    expect(hasCitation(base)).toBe(false);
  });

  it('accepts a suggestion citing news or knowledge', () => {
    expect(hasCitation({ ...base, newsRefs: ['n1'] })).toBe(true);
    expect(hasCitation({ ...base, knowledgeRefs: ['trading/value'] })).toBe(true);
  });
});
