import { cachedFetch } from './cache';
import {
  fetchEspnInjuries,
  fetchEspnNews,
  fetchEspnStandings,
  resolveStandingsSeason,
} from './espn';
import { mockBoardInputs } from './mock';
import { buildBoard } from './recommend';
import { fetchSleeperPlayers, fetchSleeperTrendingAdds, loadSleeperPlayerIndex } from './sleeper';
import type { TeamBoard } from './types';

const TTL_MS = 5 * 60 * 1000;

export async function getTeamBoard(): Promise<TeamBoard> {
  const season = resolveStandingsSeason();

  const sources = {
    espnStandings: false,
    espnInjuries: false,
    espnNews: false,
    sleeperPlayers: false,
    sleeperTrending: false,
  };

  let standings = mockBoardInputs(season).standings;
  let players = mockBoardInputs(season).players;
  let trending = mockBoardInputs(season).trending;
  let injuries = mockBoardInputs(season).injuries;
  let news = mockBoardInputs(season).news;
  let live = false;

  try {
    const liveStandings = await cachedFetch(
      `espn-standings-${season}`,
      TTL_MS,
      () => fetchEspnStandings(season),
    );
    if (liveStandings.some((t) => t.wins > 0 || t.losses > 0)) {
      standings = liveStandings;
      sources.espnStandings = true;
      live = true;
    }
  } catch {
    // keep mock standings
  }

  try {
    const liveNews = await cachedFetch('espn-news', TTL_MS, () => fetchEspnNews(50));
    if (liveNews.length > 0) {
      news = liveNews;
      sources.espnNews = true;
      live = true;
    }
  } catch {
    // keep mock news
  }

  try {
    const liveInjuries = await cachedFetch('espn-injuries', TTL_MS, fetchEspnInjuries);
    injuries = liveInjuries;
    if (liveInjuries.length > 0) {
      sources.espnInjuries = true;
      live = true;
    }
  } catch {
    // roster-level health still applied via sleeper injury_status
  }

  try {
    const playerIndex = await loadSleeperPlayerIndex();
    const livePlayers = await cachedFetch('sleeper-players', TTL_MS, fetchSleeperPlayers);
    if (livePlayers.length > 0) {
      players = livePlayers;
      sources.sleeperPlayers = true;
      live = true;
    }

    const liveTrending = await cachedFetch(
      'sleeper-trending',
      TTL_MS,
      () => fetchSleeperTrendingAdds(100, playerIndex),
    );
    if (liveTrending.length > 0) {
      trending = liveTrending;
      sources.sleeperTrending = true;
      live = true;
    }
  } catch {
    // keep mock sleeper data
  }

  return buildBoard({
    standings,
    players,
    trending,
    injuries,
    news,
    season,
    live,
    sources,
  });
}
