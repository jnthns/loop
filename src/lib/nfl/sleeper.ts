const SLEEPER = 'https://api.sleeper.app/v1';
const CACHE_KEY = 'loop_sleeper_players_compact';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface SleeperPlayer {
  id: string;
  fullName: string;
  position: string;
  teamAbbrev: string;
  status: string;
  injuryStatus: string | null;
  searchRank: number;
  depthChartOrder: number;
  age: number | null;
  yearsExp: number | null;
}

export interface SleeperTrendingEntry {
  playerId: string;
  count: number;
  fullName?: string | null;
  team?: string | null;
  position?: string | null;
}

interface CompactPlayer {
  full_name: string;
  team: string | null;
  position: string | null;
  depth_chart_position: number | null;
  years_exp: number | null;
  age: number | null;
  search_rank: number | null;
  status: string | null;
  injury_status: string | null;
}

const TEAM_ALIASES: Record<string, string> = {
  LA: 'LAR',
  WSH: 'WAS',
};

export function normalizeTeamAbbrev(raw: string | null | undefined): string {
  if (!raw) return '';
  const upper = raw.toUpperCase();
  return TEAM_ALIASES[upper] ?? upper;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Sleeper ${response.status}: ${url}`);
  }
  return response.json() as Promise<T>;
}

function readCache(): Record<string, CompactPlayer> | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: Record<string, CompactPlayer> };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(data: Record<string, CompactPlayer>): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Quota or private mode
  }
}

export async function loadSleeperPlayerIndex(): Promise<Record<string, CompactPlayer>> {
  const cached = readCache();
  if (cached) return cached;

  const all = await fetchJson<
    Record<
      string,
      {
        full_name?: string;
        team?: string | null;
        position?: string | null;
        depth_chart_position?: number | null;
        years_exp?: number | null;
        age?: number | null;
        search_rank?: number | null;
        status?: string | null;
        injury_status?: string | null;
        active?: boolean;
      }
    >
  >(`${SLEEPER}/players/nfl`);

  const compact: Record<string, CompactPlayer> = {};
  for (const [id, player] of Object.entries(all)) {
    if (!player.active || !player.full_name) continue;
    compact[id] = {
      full_name: player.full_name,
      team: player.team ?? null,
      position: player.position ?? null,
      depth_chart_position: player.depth_chart_position ?? null,
      years_exp: player.years_exp ?? null,
      age: player.age ?? null,
      search_rank: player.search_rank ?? null,
      status: player.status ?? null,
      injury_status: player.injury_status ?? null,
    };
  }

  writeCache(compact);
  return compact;
}

export async function fetchSleeperPlayers(): Promise<SleeperPlayer[]> {
  const index = await loadSleeperPlayerIndex();
  const players: SleeperPlayer[] = [];

  for (const [id, p] of Object.entries(index)) {
    if (!p.position || !['QB', 'RB', 'WR', 'TE'].includes(p.position)) continue;
    const teamAbbrev = normalizeTeamAbbrev(p.team);
    if (!teamAbbrev) continue;

    players.push({
      id,
      fullName: p.full_name,
      position: p.position,
      teamAbbrev,
      status: p.status ?? 'Active',
      injuryStatus: p.injury_status,
      searchRank: p.search_rank ?? 9999,
      depthChartOrder: p.depth_chart_position ?? 99,
      age: p.age,
      yearsExp: p.years_exp,
    });
  }

  return players;
}

export async function fetchSleeperTrendingAdds(
  limit = 100,
  playerIndex?: Record<string, CompactPlayer>,
): Promise<SleeperTrendingEntry[]> {
  const trending = await fetchJson<{ player_id: string; count: number }[]>(
    `${SLEEPER}/players/nfl/trending/add?lookback_hours=48&limit=${limit}`,
  );

  return trending.map((row) => {
    const meta = playerIndex?.[row.player_id];
    return {
      playerId: row.player_id,
      count: row.count,
      fullName: meta?.full_name ?? null,
      team: meta?.team ?? null,
      position: meta?.position ?? null,
    };
  });
}

export function trendingCountForPlayer(
  name: string,
  teamAbbrev: string,
  trending: SleeperTrendingEntry[],
): number | null {
  const normalized = name.toLowerCase().replace(/\./g, '').trim();
  const match = trending.find(
    (t) =>
      t.fullName &&
      normalizeTeamAbbrev(t.team) === normalizeTeamAbbrev(teamAbbrev) &&
      t.fullName.toLowerCase().replace(/\./g, '').trim() === normalized,
  );
  return match?.count ?? null;
}

export function sleeperDepthForPlayer(
  name: string,
  teamAbbrev: string,
  playerIndex: Record<string, CompactPlayer>,
): number | null {
  const normalized = name.toLowerCase().replace(/\./g, '').trim();
  for (const player of Object.values(playerIndex)) {
    if (
      normalizeTeamAbbrev(player.team) === normalizeTeamAbbrev(teamAbbrev) &&
      player.full_name.toLowerCase().replace(/\./g, '').trim() === normalized
    ) {
      return player.depth_chart_position ?? null;
    }
  }
  return null;
}
