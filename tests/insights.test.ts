import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { InsightsSchema, hasCitation } from '~/lib/schemas/insights';
import { NewsSchema } from '~/lib/schemas/news';
import { PlayersSchema } from '~/lib/schemas/players';
import insightsRaw from '../data/insights.json';
import newsRaw from '../data/news.json';
import playersRaw from '../data/players.json';

/**
 * The roster-review loop writes advice unattended. Its whole safety property is
 * that every suggestion points at something a human can open: a news item that
 * exists, or a knowledge article that exists. These tests are that property.
 *
 * They pass vacuously while data/insights.json is empty — which is the point.
 * The guard has to be in place *before* the loop starts writing, not after.
 */

const insights = InsightsSchema.parse(insightsRaw);
const news = NewsSchema.parse(newsRaw);
const players = PlayersSchema.parse(playersRaw);

const CONTENT = join(process.cwd(), 'src/content/knowledge');
const articleSlugs = new Set(
  readdirSync(CONTENT, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => relative(CONTENT, join(e.parentPath ?? CONTENT, e.name)).replace(/\.md$/, '')),
);

const newsIds = new Set(news.map((n) => n.id));
const playerIds = new Set(players.map((p) => p.id));
const suggestions = insights.flatMap((b) => b.suggestions.map((s) => [b.date, s] as const));

describe('data/insights.json', () => {
  it('is schema-valid', () => {
    expect(InsightsSchema.safeParse(insightsRaw).success).toBe(true);
  });

  it('has unique suggestion ids', () => {
    const ids = suggestions.map(([, s]) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every suggestion cites something', () => {
    const uncited = suggestions.filter(([, s]) => !hasCitation(s)).map(([, s]) => s.id);
    expect(uncited).toEqual([]);
  });

  it('every news citation resolves to a real item', () => {
    const dangling = suggestions.flatMap(([, s]) =>
      s.newsRefs.filter((ref) => !newsIds.has(ref)).map((ref) => `${s.id} -> ${ref}`),
    );
    expect(dangling).toEqual([]);
  });

  it('every knowledge citation resolves to a real article', () => {
    const dangling = suggestions.flatMap(([, s]) =>
      s.knowledgeRefs.filter((ref) => !articleSlugs.has(ref)).map((ref) => `${s.id} -> ${ref}`),
    );
    expect(dangling).toEqual([]);
  });

  it('every referenced player exists', () => {
    const unknown = suggestions.flatMap(([, s]) =>
      s.players.filter((id) => !playerIds.has(id)).map((id) => `${s.id} -> ${id}`),
    );
    expect(unknown).toEqual([]);
  });

  it('keeps briefings to a readable size', () => {
    for (const briefing of insights) {
      expect(briefing.suggestions.length).toBeLessThanOrEqual(5);
    }
  });
});

describe('the citation guard is real', () => {
  // Guards the guard: if these assertions could not fail, the ones above would
  // be decorative while data/insights.json is empty.
  it('rejects a suggestion citing nothing', () => {
    expect(
      hasCitation({
        id: 'x',
        kind: 'buy',
        headline: 'h',
        detail: 'd',
        players: [],
        newsRefs: [],
        knowledgeRefs: [],
        confidence: 'low',
      }),
    ).toBe(false);
  });

  it('detects a dangling news reference', () => {
    expect(newsIds.has('definitely-not-a-real-id')).toBe(false);
  });

  it('resolves a knowledge slug that does exist', () => {
    expect(articleSlugs.has('trading/trade-value-frameworks')).toBe(true);
  });
});
