const ESPN_BASE = 'https://site.api.espn.com/apis';
const FETCH_TIMEOUT_MS = 8000;

export interface EspnTeamStanding {
  abbrev: string;
  displayName: string;
  logo: string | null;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
}

export interface EspnInjury {
  teamAbbrev: string;
  playerName: string;
  status: string;
}

export interface EspnNewsArticle {
  headline: string;
  description: string;
  link: string | null;
  published: string;
}

/** ESPN sometimes uses WSH; the coach map and Sleeper use WAS. */
const TEAM_ALIASES: Record<string, string> = {
  WSH: 'WAS',
};

export function normalizeEspnAbbrev(abbrev: string): string {
  return TEAM_ALIASES[abbrev] ?? abbrev;
}

/**
 * NFL seasons kick off in September. Before that, "current" standings are
 * 0-0 placeholders, so grade teams on the last completed season.
 */
export function resolveStandingsSeason(now = new Date()): number {
  const year = now.getFullYear();
  return now.getMonth() >= 8 ? year : year - 1;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`ESPN request failed: ${res.status} ${url}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface EspnStandingEntry {
  team?: {
    abbreviation?: string;
    displayName?: string;
    logos?: { href?: string }[];
  };
  stats?: { name?: string; value?: number; displayValue?: string }[];
}

interface EspnStandingsResponse {
  children?: { standings?: { entries?: EspnStandingEntry[] } }[];
}

function statValue(
  stats: { name?: string; value?: number; displayValue?: string }[] | undefined,
  name: string,
): number {
  const stat = stats?.find((s) => s.name === name);
  return typeof stat?.value === 'number' ? stat.value : 0;
}

function statDisplay(
  stats: { name?: string; displayValue?: string }[] | undefined,
  name: string,
): string | null {
  const stat = stats?.find((s) => s.name === name);
  return stat?.displayValue ?? null;
}

export async function fetchStandings(
  season: number,
): Promise<EspnTeamStanding[]> {
  const url = `${ESPN_BASE}/v2/sports/football/nfl/standings?season=${season}`;
  const data = (await fetchJson(url)) as EspnStandingsResponse;

  const entries =
    data.children?.flatMap((c) => c.standings?.entries ?? []) ?? [];

  return entries.map((entry) => ({
    abbrev: normalizeEspnAbbrev(entry.team?.abbreviation ?? ''),
    displayName: entry.team?.displayName ?? '',
    logo: entry.team?.logos?.[0]?.href ?? null,
    wins: statValue(entry.stats, 'wins'),
    losses: statValue(entry.stats, 'losses'),
    ties: statValue(entry.stats, 'ties'),
    winPct: statValue(entry.stats, 'winPercent'),
    pointsFor: statValue(entry.stats, 'pointsFor'),
    pointsAgainst: statValue(entry.stats, 'pointsAgainst'),
    streak: statDisplay(entry.stats, 'streak'),
  }));
}

interface EspnInjuriesResponse {
  injuries?: {
    team?: { abbreviation?: string };
    injuries?: {
      athlete?: { displayName?: string };
      status?: string;
    }[];
  }[];
}

export async function fetchInjuries(): Promise<EspnInjury[]> {
  const url = `${ESPN_BASE}/site/v2/sports/football/nfl/injuries`;
  const data = (await fetchJson(url)) as EspnInjuriesResponse;

  return (
    data.injuries?.flatMap((teamBlock) =>
      (teamBlock.injuries ?? []).map((inj) => ({
        teamAbbrev: normalizeEspnAbbrev(teamBlock.team?.abbreviation ?? ''),
        playerName: inj.athlete?.displayName ?? '',
        status: inj.status ?? '',
      })),
    ) ?? []
  );
}

interface EspnNewsResponse {
  articles?: {
    headline?: string;
    description?: string;
    published?: string;
    links?: { web?: { href?: string } };
  }[];
}

export async function fetchNews(limit = 50): Promise<EspnNewsArticle[]> {
  const url = `${ESPN_BASE}/site/v2/sports/football/nfl/news?limit=${limit}`;
  const data = (await fetchJson(url)) as EspnNewsResponse;

  return (data.articles ?? []).map((article) => ({
    headline: article.headline ?? '',
    description: article.description ?? '',
    link: article.links?.web?.href ?? null,
    published: article.published ?? '',
  }));
}
