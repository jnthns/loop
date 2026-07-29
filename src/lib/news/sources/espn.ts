import { z } from 'zod';
import { NewsItemSchema, type NewsItem } from '~/lib/schemas/news';
import { canonicalUrl, enrich, isFantasyRelevant, newsId, stripHtml } from '~/lib/news/normalize';

/**
 * ESPN's public JSON news endpoint:
 *   https://site.api.espn.com/apis/site/v2/sports/football/nfl/news
 *
 * Free and keyless, and richer than the RSS feed — it carries per-article
 * categories, which often name the athletes and teams involved directly rather
 * than leaving us to match on prose.
 */

export const ESPN_NEWS_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/news';

const EspnArticleSchema = z.object({
  headline: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  published: z.string().optional(),
  lastModified: z.string().optional(),
  links: z
    .object({
      web: z.object({ href: z.string().optional() }).optional(),
mobile: z.object({ href: z.string().optional() }).optional(),
    })
    .optional(),
  categories: z
    .array(
      z.object({
        type: z.string().optional(),
        description: z.string().optional(),
        athlete: z.object({ displayName: z.string().optional() }).optional(),
        team: z.object({ abbreviation: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});

const EspnResponseSchema = z.object({ articles: z.array(EspnArticleSchema).default([]) });

export interface EspnParseOptions {
  now?: Date;
  players?: { id: string; name: string }[];
}

/**
 * ESPN JSON -> normalized items. Unparseable articles are skipped rather than
 * throwing: one malformed entry must not lose the whole fetch.
 */
export function parseEspnNews(raw: unknown, options: EspnParseOptions = {}): NewsItem[] {
  const now = options.now ?? new Date();
  const parsed = EspnResponseSchema.safeParse(raw);
  if (!parsed.success) return [];

  const items: NewsItem[] = [];

  for (const article of parsed.data.articles) {
    const title = stripHtml(article.headline ?? article.title ?? '');
    const link = article.links?.web?.href ?? article.links?.mobile?.href ?? '';
    if (!title || !link) continue;

    const url = canonicalUrl(link);
    const published = article.published ?? article.lastModified ?? '';
    const parsedDate = new Date(published);

    // ESPN's category list names the athletes and teams an article is about.
    const athleteNames = (article.categories ?? [])
      .map((c) => c.athlete?.displayName)
      .filter((n): n is string => Boolean(n));
    const teamAbbrs = (article.categories ?? [])
      .map((c) => c.team?.abbreviation?.toUpperCase())
      .filter((t): t is string => Boolean(t));

    const candidate = {
      id: newsId(url),
      title,
      url,
      source: 'ESPN',
      sourceId: 'espn-api',
      publishedAt: Number.isNaN(parsedDate.getTime())
        ? now.toISOString()
        : parsedDate.toISOString(),
      summary: stripHtml(article.description ?? '').slice(0, 400),
      tags: ['league-news'],
      players: [],
      teams: [],
    };

    const result = NewsItemSchema.safeParse(candidate);
    if (!result.success) continue;

    // Enrich from the article text as usual, then union in what ESPN told us
    // outright — a named athlete beats a substring match.
    const enriched = enrich(result.data, options.players ?? []);
    const namedPlayers = (options.players ?? [])
      .filter((p) => athleteNames.some((n) => n.toLowerCase() === p.name.toLowerCase()))
      .map((p) => p.id);

    const merged = {
      ...enriched,
      players: [...new Set([...enriched.players, ...namedPlayers])],
      teams: [...new Set([...enriched.teams, ...teamAbbrs])],
      tags: [...new Set([...enriched.tags, ...teamAbbrs])],
    };
    if (isFantasyRelevant(merged)) items.push(merged);
  }

  return items;
}
