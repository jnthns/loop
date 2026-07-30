import { cachedFetch } from './cache';
import {
  fetchInjuries,
  fetchNews,
  fetchStandings,
  resolveStandingsSeason,
} from './espn';
import { fetchPlayers, fetchTrending } from './sleeper';
import { mockBoardInputs } from './mock';
import { buildBoard } from './recommend';
import type { TeamBoard } from './types';

const BOARD_TTL_MS = 30 * 60 * 1000;

/**
 * Each upstream source falls back to mock data independently, so a partial
 * outage (e.g. Sleeper down, ESPN up) still yields a usable board.
 */
export async function getTeamBoard(): Promise<TeamBoard> {
  return cachedFetch('nfl-board', BOARD_TTL_MS, async () => {
    const season = resolveStandingsSeason();
    const mock = mockBoardInputs(season);
    const sources = {
      espnStandings: false,
      espnInjuries: false,
      espnNews: false,
      sleeperPlayers: false,
      sleeperTrending: false,
    };

    const [standings, players, trending, injuries, news] = await Promise.allSettled([
      fetchStandings(season),
      fetchPlayers(),
      fetchTrending(),
      fetchInjuries(),
      fetchNews(),
    ]);

    sources.espnStandings =
      standings.status === 'fulfilled' && standings.value.length > 0;
    sources.sleeperPlayers =
      players.status === 'fulfilled' && players.value.length > 0;
    sources.sleeperTrending = trending.status === 'fulfilled';
    sources.espnInjuries = injuries.status === 'fulfilled';
    sources.espnNews = news.status === 'fulfilled';

    const live = Object.values(sources).some(Boolean);

    return buildBoard({
      standings: sources.espnStandings && standings.status === 'fulfilled' ? standings.value : mock.standings,
      players: sources.sleeperPlayers && players.status === 'fulfilled' ? players.value : mock.players,
      trending: trending.status === 'fulfilled' ? trending.value : mock.trending,
      injuries: injuries.status === 'fulfilled' ? injuries.value : mock.injuries,
      news: news.status === 'fulfilled' ? news.value : mock.news,
      season,
      live,
      sources,
    });
  });
}
