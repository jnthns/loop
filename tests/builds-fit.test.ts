import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '~/lib/builds/archetypes';
import { bandFor, scoreArchetypes } from '~/lib/builds/fit';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Draft } from '~/lib/schemas/draft';
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

const qbRows: MarketPlayerRow[] = Array.from({ length: 6 }, (_, i) =>
  row({
    fpId: `qb-${i}`,
    name: `QB ${i}`,
    pos: 'QB',
    ecrSf: 1 + i * 5,
    valueSf: 9000 - i * 500,
    value1qb: 3000 - i * 100,
  }),
);

const rbRows: MarketPlayerRow[] = Array.from({ length: 6 }, (_, i) =>
  row({
    fpId: `rb-${i}`,
    name: `RB ${i}`,
    pos: 'RB',
    ecrSf: 2 + i * 5,
    valueSf: 7000 - i * 400,
    value1qb: 6800 - i * 400,
  }),
);

const wrRows: MarketPlayerRow[] = Array.from({ length: 8 }, (_, i) =>
  row({
    fpId: `wr-${i}`,
    name: `WR ${i}`,
    pos: 'WR',
    ecrSf: 3 + i * 4,
    valueSf: 8000 - i * 300,
    value1qb: 8500 - i * 300,
  }),
);

const teRows: MarketPlayerRow[] = Array.from({ length: 5 }, (_, i) =>
  row({
    fpId: `te-${i}`,
    name: `TE ${i}`,
    pos: 'TE',
    ecrSf: 10 + i * 6,
    valueSf: 4000 - i * 300,
    value1qb: 3800 - i * 300,
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

const fixtureDraft: Draft = {
  draftId: 'test-draft',
  status: 'pre_draft',
  type: 'snake',
  startTime: null,
  teams: 12,
  rounds: 30,
  myDraftSlot: 4,
  myPicks: [4, 21, 28, 45, 52, 69, 76, 93],
  picks: [],
};

const EMPTY_MARKET: Market = {
  ...fixtureMarket,
  players: [],
};

describe('scoreArchetypes', () => {
  it('ranks superflex-qb-heavy above zero-rb in a superflex format', () => {
    const fits = scoreArchetypes({ format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft });
    const qbHeavy = fits.find((f) => f.id === 'superflex-qb-heavy')!;
    const zeroRb = fits.find((f) => f.id === 'zero-rb')!;
    expect(qbHeavy.score).toBeGreaterThan(zeroRb.score);
  });

  it('flips the superflex bonus to a penalty in a non-superflex format', () => {
    const nonSuperflexFormat = { ...fixtureTeam.format, superflex: false };
    const superflexFits = scoreArchetypes({ format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft });
    const nonSuperflexFits = scoreArchetypes({ format: nonSuperflexFormat, market: fixtureMarket, draft: fixtureDraft });

    const withSf = superflexFits.find((f) => f.id === 'superflex-qb-heavy')!;
    const withoutSf = nonSuperflexFits.find((f) => f.id === 'superflex-qb-heavy')!;
    expect(withoutSf.components.formatFit).toBeLessThan(withSf.components.formatFit);
    expect(withoutSf.score).toBeLessThan(withSf.score);
  });

  it('fires the TE-premium bonus at tePremium >= 0.5 and not at 0', () => {
    const withPremium = { ...fixtureTeam.format, tePremium: 0.5 };
    const withoutPremium = { ...fixtureTeam.format, tePremium: 0 };
    const fitsWith = scoreArchetypes({ format: withPremium, market: fixtureMarket, draft: fixtureDraft });
    const fitsWithout = scoreArchetypes({ format: withoutPremium, market: fixtureMarket, draft: fixtureDraft });

    const teWith = fitsWith.find((f) => f.id === 'te-premium-leverage')!;
    const teWithout = fitsWithout.find((f) => f.id === 'te-premium-leverage')!;
    expect(teWith.components.formatFit).toBeGreaterThan(teWithout.components.formatFit);
  });

  it('keeps every score within 0-100 and every band matching its threshold', () => {
    const fits = scoreArchetypes({ format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft });
    expect(fits.length).toBe(ARCHETYPES.length);
    for (const fit of fits) {
      expect(fit.score).toBeGreaterThanOrEqual(0);
      expect(fit.score).toBeLessThanOrEqual(100);
      // Read the thresholds from the module rather than restating them, so a
      // recalibration cannot leave the test asserting a band that no longer exists.
      expect(fit.band).toBe(bandFor(fit.score));
    }
  });

  it('gives every fit at least three reasons, each with non-empty text and evidence', () => {
    const fits = scoreArchetypes({ format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft });
    for (const fit of fits) {
      expect(fit.reasons.length).toBeGreaterThanOrEqual(3);
      for (const reason of fit.reasons) {
        expect(reason.text.length).toBeGreaterThan(0);
        expect(reason.evidence.length).toBeGreaterThan(0);
      }
    }
  });

  it('is pure: identical inputs produce deep-equal output', () => {
    const input = { format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft };
    const a = scoreArchetypes(input);
    const b = scoreArchetypes(input);
    expect(a).toEqual(b);
  });

  // Regression: ageBias was declared on Archetype but never read by the scorer,
  // so youth-first and win-now — deliberate opposites on the one axis that
  // distinguishes them — scored within a point of each other and both surfaced
  // as the top recommendation at once, which cannot be true.
  it('separates youth-first from win-now on the age axis', () => {
    const fits = scoreArchetypes({ format: fixtureTeam.format, market: fixtureMarket, draft: fixtureDraft });
    const youth = fits.find((f) => f.id === 'youth-first')!;
    const winNow = fits.find((f) => f.id === 'win-now')!;

    expect(youth.components.ageFit).not.toBeCloseTo(winNow.components.ageFit, 3);
    // The two age scores are complements around the midpoint of the range.
    expect(youth.components.ageFit + winNow.components.ageFit).toBeCloseTo(15, 3);
  });

  // Regression: formatFit normalized by the largest position weight, which
  // rewarded breadth — a flat "want everything equally" profile scored the
  // maximum and beat every sharp thesis. Alignment, not breadth, is the question.
  it('rewards a build aimed at what the format starts, not one that wants everything', () => {
    const flat = {
      ...ARCHETYPES[0]!,
      id: 'youth-first' as const,
      posWeight: { QB: 1, RB: 1, WR: 1, TE: 1 },
      needsSuperflex: false,
      needsTePremium: false,
    };
    const wrHeavy = { ...flat, posWeight: { QB: 0.6, RB: 0.7, WR: 1.6, TE: 0.8 } };

    const [flatFit] = scoreArchetypes({
      format: fixtureTeam.format,
      market: fixtureMarket,
      draft: fixtureDraft,
      archetypes: [flat],
    });
    const [wrFit] = scoreArchetypes({
      format: fixtureTeam.format,
      market: fixtureMarket,
      draft: fixtureDraft,
      archetypes: [wrHeavy],
    });

    // The fixture format starts three WRs — more than any other position — so a
    // WR-concentrated build must align better than an undifferentiated one.
    expect(wrFit!.components.formatFit).toBeGreaterThan(flatFit!.components.formatFit);
  });

  it('does not throw on an empty market', () => {
    expect(() => scoreArchetypes({ format: fixtureTeam.format, market: EMPTY_MARKET, draft: fixtureDraft })).not.toThrow();
    const fits = scoreArchetypes({ format: fixtureTeam.format, market: EMPTY_MARKET, draft: fixtureDraft });
    expect(fits.length).toBe(ARCHETYPES.length);
    for (const fit of fits) {
      expect(fit.score).toBeGreaterThanOrEqual(0);
      expect(fit.score).toBeLessThanOrEqual(100);
    }
  });
});
