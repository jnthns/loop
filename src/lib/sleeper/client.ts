import {
  SleeperDraftPickSchema,
  SleeperDraftSchema,
  SleeperLeagueSchema,
  SleeperLeagueUserSchema,
  SleeperRosterSchema,
  SleeperStateSchema,
  SleeperTrendingSchema,
  SleeperUserSchema,
  type SleeperDraft,
  type SleeperDraftPick,
  type SleeperLeague,
  type SleeperLeagueUser,
  type SleeperPlayer,
  type SleeperRoster,
  type SleeperTrending,
} from '~/lib/schemas/sleeper';
import { SleeperPlayerSchema } from '~/lib/schemas/sleeper';

/**
 * Sleeper read API — public, keyless, documented at https://docs.sleeper.com.
 *
 * No authentication means no secret to manage, which is why this integration
 * needs nothing in `.env`. Sleeper asks callers to stay under ~1000 requests per
 * minute; a full sync makes roughly ten.
 */

const BASE = 'https://api.sleeper.app/v1';
const TIMEOUT_MS = 30_000;
const USER_AGENT =
  'dynasty-guide/0.1 (+https://github.com/jnthns/loop; personal fantasy football dashboard)';

export class SleeperError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'SleeperError';
  }
}

async function get<T>(path: string, parse: (raw: unknown) => T): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new SleeperError(`GET ${path} -> HTTP ${res.status}`, res.status);
    }
    const body = await res.json();
    if (body === null) throw new SleeperError(`GET ${path} -> null (not found)`, 404);
    return parse(body);
  } catch (error) {
    if (error instanceof SleeperError) throw error;
    throw new SleeperError(`GET ${path} -> ${(error as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}

export function getState() {
  return get('/state/nfl', (raw) => SleeperStateSchema.parse(raw));
}

export function getUser(username: string) {
  return get(`/user/${encodeURIComponent(username)}`, (raw) => SleeperUserSchema.parse(raw));
}

export function getLeaguesForUser(userId: string, season: string): Promise<SleeperLeague[]> {
  return get(`/user/${userId}/leagues/nfl/${season}`, (raw) =>
    // Leagues in the list carry the same shape we need from a single league.
    SleeperLeagueSchema.array().parse(raw),
  );
}

export function getLeague(leagueId: string): Promise<SleeperLeague> {
  return get(`/league/${leagueId}`, (raw) => SleeperLeagueSchema.parse(raw));
}

export function getRosters(leagueId: string): Promise<SleeperRoster[]> {
  return get(`/league/${leagueId}/rosters`, (raw) => SleeperRosterSchema.array().parse(raw));
}

/**
 * The full NFL player dump — roughly 5MB. Sleeper explicitly asks that this be
 * called at most once per day, which the sync enforces via `lastPlayerSync`.
 */
export function getAllPlayers(): Promise<Record<string, SleeperPlayer>> {
  return get('/players/nfl', (raw) => {
    const out: Record<string, SleeperPlayer> = {};
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const parsed = SleeperPlayerSchema.safeParse(value);
      if (parsed.success) out[id] = parsed.data;
    }
    return out;
  });
}

/** League members — the only place Sleeper carries a team name. */
export function getLeagueUsers(leagueId: string): Promise<SleeperLeagueUser[]> {
  return get(`/league/${leagueId}/users`, (raw) => SleeperLeagueUserSchema.array().parse(raw));
}

/** Drafts for a league, newest first. A league may have none. */
export function getDrafts(leagueId: string): Promise<SleeperDraft[]> {
  return get(`/league/${leagueId}/drafts`, (raw) => SleeperDraftSchema.array().parse(raw));
}

/** Picks made so far. Empty before a draft starts. */
export function getDraftPicks(draftId: string): Promise<SleeperDraftPick[]> {
  return get(`/draft/${draftId}/picks`, (raw) => SleeperDraftPickSchema.array().parse(raw));
}

/** League-wide adds or drops in the last N hours — market signal, not news. */
export function getTrending(
  type: 'add' | 'drop',
  lookbackHours = 24,
  limit = 25,
): Promise<SleeperTrending> {
  return get(
    `/players/nfl/trending/${type}?lookback_hours=${lookbackHours}&limit=${limit}`,
    (raw) => SleeperTrendingSchema.parse(raw),
  );
}
