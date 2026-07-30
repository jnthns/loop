const SLEEPER_BASE = 'https://api.sleeper.app/v1';
const FETCH_TIMEOUT_MS = 15000;

export interface SleeperPlayer {
  id: string;
  fullName: string;
  position: string;
  teamAbbrev: string;
  status: string;
  injuryStatus: string | null;
  searchRank: number;
  depthChartOrder: number | null;
  age: number | null;
  yearsExp: number | null;
}

export interface SleeperTrendingEntry {
  playerId: string;
  count: number;
}

/** Sleeper and ESPN abbreviations match except for these legacy codes. */
const TEAM_ALIASES: Record<string, string> = {
  LA: 'LAR',
  WSH: 'WAS',
};

export function normalizeTeamAbbrev(abbrev: string): string {
  return TEAM_ALIASES[abbrev] ?? abbrev;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Sleeper request failed: ${res.status} ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type SleeperPlayersResponse = Record<
  string,
  {
    player_id?: string;
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string | null;
    status?: string;
    injury_status?: string | null;
    search_rank?: number | null;
    depth_chart_order?: number | null;
    age?: number | null;
    years_exp?: number | null;
  }
>;

export async function fetchPlayers(): Promise<SleeperPlayer[]> {
  const data = (await fetchJson(
    `${SLEEPER_BASE}/players/nfl`,
  )) as SleeperPlayersResponse;

  return Object.entries(data)
    .filter(([, p]) => p.team && p.position)
    .map(([id, p]) => ({
      id,
      fullName: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim(),
      position: p.position ?? '',
      teamAbbrev: normalizeTeamAbbrev(p.team ?? ''),
      status: p.status ?? '',
      injuryStatus: p.injury_status ?? null,
      searchRank:
        typeof p.search_rank === 'number' ? p.search_rank : Number.MAX_SAFE_INTEGER,
      depthChartOrder:
        typeof p.depth_chart_order === 'number' ? p.depth_chart_order : null,
      age: typeof p.age === 'number' ? p.age : null,
      yearsExp: typeof p.years_exp === 'number' ? p.years_exp : null,
    }));
}

export async function fetchTrending(
  lookbackHours = 48,
  limit = 100,
): Promise<SleeperTrendingEntry[]> {
  const data = (await fetchJson(
    `${SLEEPER_BASE}/players/nfl/trending/add?lookback_hours=${lookbackHours}&limit=${limit}`,
  )) as { player_id?: string; count?: number }[];

  return (data ?? [])
    .filter((entry) => entry.player_id)
    .map((entry) => ({
      playerId: entry.player_id ?? '',
      count: typeof entry.count === 'number' ? entry.count : 0,
    }));
}
