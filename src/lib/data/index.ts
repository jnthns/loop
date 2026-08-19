/**
 * Typed access to the committed database in `data/`.
 *
 * Everything is parsed at import time, so a malformed data file fails the build
 * with a schema error instead of rendering something wrong. This is the only
 * place raw JSON enters the app.
 */

import feedsRaw from '../../../data/feeds.json';
import newsRaw from '../../../data/news.json';
import playersRaw from '../../../data/players.json';
import teamRaw from '../../../data/team.json';
import insightsRaw from '../../../data/insights.json';
import trendingRaw from '../../../data/trending.json';
import draftRaw from '../../../data/draft.json';
import marketRaw from '../../../data/market.json';
import depthRaw from '../../../data/depth.json';
import sleeperRaw from '../../../data/sleeper.json';
import profilesRaw from '../../../data/profiles.json';

import { FeedsSchema, NewsSchema, type Feed, type NewsItem } from '~/lib/schemas/news';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { TeamSchema, type Team } from '~/lib/schemas/team';
import { InsightsSchema, type Briefing } from '~/lib/schemas/insights';
import { TrendingSchema, type Trending } from '~/lib/schemas/trending';
import { DraftSchema, type Draft } from '~/lib/schemas/draft';
import { MarketSchema, type Market } from '~/lib/schemas/market';
import { DepthSchema, type Depth } from '~/lib/schemas/depth';
import { SleeperConfigSchema, type SleeperConfig } from '~/lib/schemas/sleeper';
import { ProfilesSchema, type Profile } from '~/lib/schemas/profiles';

function parse<T>(label: string, schema: { safeParse: (v: unknown) => any }, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 5)
      .map((i: { path: (string | number)[]; message: string }) => `  ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`data/${label}.json failed validation:\n${detail}`);
  }
  return result.data as T;
}

export const feeds: Feed[] = parse('feeds', FeedsSchema, feedsRaw);
export const news: NewsItem[] = parse('news', NewsSchema, newsRaw);
export const players: Player[] = parse('players', PlayersSchema, playersRaw);
export const team: Team = parse('team', TeamSchema, teamRaw);
export const insights: Briefing[] = parse('insights', InsightsSchema, insightsRaw);
export const trending: Trending = parse('trending', TrendingSchema, trendingRaw);
export const draft: Draft = parse('draft', DraftSchema, draftRaw);
export const market: Market = parse('market', MarketSchema, marketRaw);
export const depth: Depth = parse('depth', DepthSchema, depthRaw);
export const sleeperConfig: SleeperConfig = parse('sleeper', SleeperConfigSchema, sleeperRaw);
export const profiles: Profile[] = parse('profiles', ProfilesSchema, profilesRaw);

/** Newest first — the order every news surface wants. */
export const newsByDate: NewsItem[] = [...news].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

const playerIndex = new Map(players.map((p) => [p.id, p]));

export function getPlayer(id: string | null | undefined): Player | undefined {
  return id ? playerIndex.get(id) : undefined;
}

/** Player display string used wherever space is tight: "Name · POS · TEAM · age". */
export function playerLine(p: Player): string {
  return `${p.name} · ${p.pos} · ${p.nflTeam} · ${p.age}`;
}

/**
 * Player id -> his rank on his NFL team's depth chart (1 = starter).
 *
 * Kept as a lookup rather than folded onto the player rows because the two files
 * refresh independently: a player can be tracked with no chart entry (a rookie
 * yet to be listed), and the absence is meaningful — it should read as "not
 * listed", never as a rank the app quietly invented.
 */
export const depthRankById: Record<string, number> = Object.fromEntries(
  depth.entries.map((e) => [e.id, e.depthRank]),
);
