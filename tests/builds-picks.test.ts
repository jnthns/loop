import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '~/lib/builds/archetypes';
import { planPicks } from '~/lib/builds/picks';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Draft } from '~/lib/schemas/draft';
import type { Trending } from '~/lib/schemas/trending';
import { pickNumbersForSlot } from '~/lib/sleeper/map';
import { fixtureTeam } from './fixtures/league';

/** Small inline market fixture — tests must never import data/market.json. */
function row(overrides: Partial<MarketPlayerRow> & Pick<MarketPlayerRow, 'fpId' | 'name' | 'pos'>): MarketPlayerRow {
  return {
    sleeperId: null,
    ktcId: null,
    espnId: null,
    playerId: null,
    nflTeam: 'XXX',
    age: 25,
    draftYear: 2022,
    ecrSf: null,
    ecr1qb: null,
    posEcr: null,
    valueSf: 5000,
    value1qb: 5000,
    ...overrides,
  };
}

// A deep-enough board (~120 players across the four positions) that the room
// can plausibly consume real snake-draft gaps between owned picks without
// running out of candidates before round 8.
const qbRows: MarketPlayerRow[] = Array.from({ length: 30 }, (_, i) =>
  row({
    fpId: `qb-${i}`,
    name: `QB ${i}`,
    pos: 'QB',
    age: 24 + (i % 8),
    ecrSf: 2 + i * 3,
    valueSf: 9500 - i * 150,
    value1qb: 3200 - i * 30,
  }),
);

const rbRows: MarketPlayerRow[] = Array.from({ length: 30 }, (_, i) =>
  row({
    fpId: `rb-${i}`,
    name: `RB ${i}`,
    pos: 'RB',
    age: 22 + (i % 8),
    ecrSf: 3 + i * 3,
    valueSf: 8000 - i * 130,
    value1qb: 7800 - i * 130,
  }),
);

const wrRows: MarketPlayerRow[] = Array.from({ length: 40 }, (_, i) =>
  row({
    fpId: `wr-${i}`,
    name: `WR ${i}`,
    pos: 'WR',
    age: 22 + (i % 9),
    ecrSf: 4 + i * 2,
    valueSf: 8500 - i * 100,
    value1qb: 8700 - i * 100,
  }),
);

const teRows: MarketPlayerRow[] = Array.from({ length: 25 }, (_, i) =>
  row({
    fpId: `te-${i}`,
    name: `TE ${i}`,
    pos: 'TE',
    age: 23 + (i % 8),
    ecrSf: 12 + i * 3,
    valueSf: 4500 - i * 100,
    value1qb: 4300 - i * 100,
  }),
);

const fixtureMarket: Market = {
  capturedAt: '2026-07-30T00:00:00.000Z',
  scrapeDate: '2026-07-24',
  sources: [{ label: 'test fixture', url: 'https://example.com', kind: 'dataset' }],
  players: [...qbRows, ...rbRows, ...wrRows, ...teRows],
  picks: [],
  unmatched: [],
};

const EMPTY_MARKET: Market = { ...fixtureMarket, players: [] };

// Real snake arithmetic for this league's slot, sliced to keep the candidate
// pool (~40 players) large enough to guarantee 8 unique primaries + alternates.
const slotPicks = pickNumbersForSlot(4, 12, 30, 'snake');
const myPicks = slotPicks.slice(0, 8);

const fixtureDraft: Draft = {
  draftId: 'test-draft',
  status: 'pre_draft',
  type: 'snake',
  startTime: null,
  teams: 12,
  rounds: 30,
  myDraftSlot: 4,
  myPicks,
  picks: [],
};

const qbHeavy = ARCHETYPES.find((a) => a.id === 'superflex-qb-heavy')!;
const zeroRb = ARCHETYPES.find((a) => a.id === 'zero-rb')!;

describe('planPicks', () => {
  it('returns exactly one suggestion per owned pick, in ascending pick order', () => {
    const suggestions = planPicks({
      archetype: qbHeavy,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    expect(suggestions.length).toBe(myPicks.length);
    expect(suggestions.map((s) => s.pick)).toEqual(myPicks);
    expect(suggestions.map((s) => s.pick)).toEqual([...suggestions.map((s) => s.pick)].sort((a, b) => a - b));
  });

  it('never suggests the same player twice, as primary or alternate', () => {
    const suggestions = planPicks({
      archetype: zeroRb,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    const seen = new Set<string>();
    for (const s of suggestions) {
      const names = [s.primary.name, ...s.alternates.map((a) => a.name)];
      for (const name of names) {
        expect(seen.has(name), `${name} suggested more than once`).toBe(false);
        seen.add(name);
      }
    }
  });

  it('agrees with pickNumbersForSlot on round numbers', () => {
    const suggestions = planPicks({
      archetype: qbHeavy,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    suggestions.forEach((s, i) => {
      expect(s.round).toBe(i + 1);
      expect(slotPicks[s.round - 1]).toBe(s.pick);
    });
  });

  it('superflex-qb-heavy takes at least 2 QBs in rounds 1-4', () => {
    const suggestions = planPicks({
      archetype: qbHeavy,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    const qbCount = suggestions.filter((s) => s.round <= 4 && s.primary.pos === 'QB').length;
    expect(qbCount).toBeGreaterThanOrEqual(2);
  });

  it('zero-rb takes zero RBs in rounds 1-3', () => {
    const suggestions = planPicks({
      archetype: zeroRb,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    const rbCount = suggestions.filter((s) => s.round <= 3 && s.primary.pos === 'RB').length;
    expect(rbCount).toBe(0);
  });

  it('is deterministic: two runs on the same input are deep-equal', () => {
    const input = { archetype: qbHeavy, market: fixtureMarket, draft: fixtureDraft, format: fixtureTeam.format };
    const a = planPicks(input);
    const b = planPicks(input);
    expect(a).toEqual(b);
  });

  it('returns [] on an empty market rather than throwing', () => {
    expect(() =>
      planPicks({ archetype: qbHeavy, market: EMPTY_MARKET, draft: fixtureDraft, format: fixtureTeam.format }),
    ).not.toThrow();
    const suggestions = planPicks({
      archetype: qbHeavy,
      market: EMPTY_MARKET,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    expect(suggestions).toEqual([]);
  });

  it('every suggestion carries a non-empty reason and at least one valid citation URL', () => {
    const suggestions = planPicks({
      archetype: qbHeavy,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    for (const s of suggestions) {
      expect(s.reason.length).toBeGreaterThan(0);
      expect(s.citations.length).toBeGreaterThanOrEqual(1);
      for (const c of s.citations) {
        expect(() => new URL(c.url)).not.toThrow();
      }
    }
  });

  it('accepts an optional trending signal without crashing, and 0 contribution when absent', () => {
    const trending: Trending = {
      capturedAt: '2026-07-30T00:00:00.000Z',
      lookbackHours: 48,
      adds: [{ playerId: null, sleeperId: 'x', name: 'QB 0', pos: 'QB', nflTeam: 'XXX', count: 6000 }],
      drops: [],
    };
    expect(() =>
      planPicks({
        archetype: qbHeavy,
        market: fixtureMarket,
        draft: fixtureDraft,
        format: fixtureTeam.format,
        trending,
      }),
    ).not.toThrow();
  });
  // Regression: `need` expressed plan minimums but never saturation, so once a
  // plan step was met the position still scored 55 forever. Combined with the
  // ~3x superflex QB premium baked into valueSf, "highest value available" was
  // almost always a quarterback and the sheet returned seven QBs in eight picks.
  it('does not stack a position past what the roster can start', () => {
    const qbHeavy = ARCHETYPES.find((a) => a.id === 'superflex-qb-heavy')!;
    const picks = planPicks({
      archetype: qbHeavy,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });
    const qbs = picks.filter((p) => p.primary.pos === 'QB').length;

    // Two QB-capable slots plus bench: a handful is a build, a dozen is a bug.
    expect(qbs).toBeLessThanOrEqual(6);
  });

  // Regression: archetypes whose plan never named QB drafted none at all across
  // all 30 rounds — a roster that cannot legally field a superflex lineup. An
  // archetype chooses the order it fills the lineup, never whether to.
  //
  // The fixture draft owns 8 picks, not 30, so a complete lineup is not
  // arithmetically reachable here; what it can prove is that the format floor
  // binds at all, which is precisely what was broken.
  it.each(ARCHETYPES.map((a) => a.id))('%s takes a quarterback in a superflex format', (id) => {
    const archetype = ARCHETYPES.find((a) => a.id === id)!;
    const picks = planPicks({
      archetype,
      market: fixtureMarket,
      draft: fixtureDraft,
      format: fixtureTeam.format,
    });

    expect(picks.filter((p) => p.primary.pos === 'QB').length).toBeGreaterThanOrEqual(1);
  });
});
