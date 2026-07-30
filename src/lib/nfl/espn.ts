const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

export const OFFENSE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE', 'FB']);

/** ESPN uses WSH; our coach map uses WAS. */
export const ESPN_TO_COACH_ABBREV: Record<string, string> = {
  WSH: 'WAS',
};

export function coachAbbrevFromEspn(abbrev: string): string {
  return ESPN_TO_COACH_ABBREV[abbrev] ?? abbrev;
}

export interface EspnTeamMeta {
  id: string;
  abbrev: string;
  coachAbbrev: string;
  displayName: string;
  logo: string | null;
}

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
  description?: string;
  link: string | null;
  published?: string;
  teamAbbrevs?: string[];
}

export interface EspnRecord {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: string | null;
}

export interface EspnAthlete {
  id: string;
  name: string;
  position: string;
  age: number | null;
  yearsExp: number | null;
  healthAbbrev: string | null;
  injuryDetail: string | null;
  depthOrder: number;
  headshot: string | null;
}

/** Reference season for standings when the current NFL year has not started. */
export function resolveStandingsSeason(now = new Date()): number {
  const year = now.getUTCFullYear();
  // Regular season kicks off in September (UTC month index 8).
  return now.getUTCMonth() < 8 ? year - 1 : year;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ESPN ${response.status}: ${url}`);
  }
  return response.json() as Promise<T>;
}

function pickLogo(logos: { href: string; rel?: string[] }[] | undefined): string | null {
  if (!logos?.length) return null;
  const scoreboard = logos.find((l) => l.rel?.includes('scoreboard'));
  return scoreboard?.href ?? logos[0].href;
}

function parseRecordStats(stats: { name: string; value: number }[]): EspnRecord {
  const get = (name: string) => stats.find((s) => s.name === name)?.value ?? 0;
  const wins = get('wins');
  const losses = get('losses');
  const ties = get('ties');
  const winPct = get('winPercent');
  const streakVal = get('streak');
  let streak: string | null = null;
  if (streakVal !== 0) {
    const n = Math.abs(streakVal);
    streak = streakVal > 0 ? `W${n}` : `L${n}`;
  }

  return {
    wins,
    losses,
    ties,
    winPct,
    pointsFor: get('pointsFor'),
    pointsAgainst: get('pointsAgainst'),
    streak,
  };
}

export async function fetchEspnTeams(): Promise<EspnTeamMeta[]> {
  const data = await fetchJson<{
    sports: {
      leagues: {
        teams: {
          team: {
            id: string;
            abbreviation: string;
            displayName: string;
            logos?: { href: string; rel?: string[] }[];
          };
        }[];
      }[];
    }[];
  }>(`${ESPN_SITE}/teams?limit=32`);

  const teams = data.sports[0]?.leagues[0]?.teams ?? [];
  return teams.map(({ team }) => ({
    id: team.id,
    abbrev: team.abbreviation,
    coachAbbrev: coachAbbrevFromEspn(team.abbreviation),
    displayName: team.displayName,
    logo: pickLogo(team.logos),
  }));
}

export async function fetchEspnTeamRecord(
  teamId: string,
  season: number,
): Promise<EspnRecord> {
  const data = await fetchJson<{
    items: {
      type: string;
      stats: { name: string; value: number }[];
    }[];
  }>(`${ESPN_CORE}/seasons/${season}/types/2/teams/${teamId}/record?limit=200`);

  const overall = data.items.find((item) => item.type === 'total');
  if (!overall) {
    return {
      wins: 0,
      losses: 0,
      ties: 0,
      winPct: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: null,
    };
  }

  return parseRecordStats(overall.stats);
}

export async function fetchEspnStandings(season: number): Promise<EspnTeamStanding[]> {
  const teams = await fetchEspnTeams();
  const standings: EspnTeamStanding[] = [];

  for (const team of teams) {
    try {
      const record = await fetchEspnTeamRecord(team.id, season);
      standings.push({
        abbrev: team.coachAbbrev,
        displayName: team.displayName,
        logo: team.logo,
        wins: record.wins,
        losses: record.losses,
        ties: record.ties,
        winPct: record.winPct,
        pointsFor: record.pointsFor,
        pointsAgainst: record.pointsAgainst,
        streak: record.streak,
      });
    } catch {
      standings.push({
        abbrev: team.coachAbbrev,
        displayName: team.displayName,
        logo: team.logo,
        wins: 0,
        losses: 0,
        ties: 0,
        winPct: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        streak: null,
      });
    }
  }

  return standings;
}

function mapHealth(
  statusAbbrev: string | undefined,
  injuries: { status?: string; details?: { type?: string } }[],
): { healthAbbrev: string | null; injuryDetail: string | null } {
  const injuryStatus = injuries[0]?.status;
  const detail = injuries[0]?.details?.type ?? null;

  const raw = injuryStatus ?? statusAbbrev ?? null;
  if (!raw) return { healthAbbrev: null, injuryDetail: detail };

  const upper = raw.toUpperCase();
  if (upper.includes('OUT') || upper === 'O') return { healthAbbrev: 'OUT', injuryDetail: detail };
  if (upper.includes('DOUBT')) return { healthAbbrev: 'DOUBTFUL', injuryDetail: detail };
  if (upper.includes('QUEST') || upper === 'Q') return { healthAbbrev: 'QUESTIONABLE', injuryDetail: detail };
  if (upper.includes('IR')) return { healthAbbrev: 'IR', injuryDetail: detail };
  if (upper.includes('ACTIVE') || upper === 'A') return { healthAbbrev: 'ACTIVE', injuryDetail: detail };

  return { healthAbbrev: raw, injuryDetail: detail };
}

export async function fetchEspnRoster(teamId: string): Promise<EspnAthlete[]> {
  const data = await fetchJson<{
    athletes: {
      position: string;
      items: {
        id: string;
        displayName: string;
        position?: { abbreviation?: string };
        age?: number;
        experience?: { years?: number };
        status?: { abbreviation?: string };
        injuries?: { status?: string; details?: { type?: string } }[];
        headshot?: { href?: string };
      }[];
    }[];
  }>(`${ESPN_SITE}/teams/${teamId}/roster`);

  const offenseGroup = data.athletes.find((group) => group.position === 'offense');
  const offenseItems = offenseGroup?.items ?? [];

  const byPosition: Record<string, number> = {};
  const athletes: EspnAthlete[] = [];

  for (const item of offenseItems) {
    const pos = item.position?.abbreviation ?? '';
    if (!OFFENSE_POSITIONS.has(pos)) continue;

    const order = (byPosition[pos] ?? 0) + 1;
    byPosition[pos] = order;

    const { healthAbbrev, injuryDetail } = mapHealth(
      item.status?.abbreviation,
      item.injuries ?? [],
    );

    athletes.push({
      id: item.id,
      name: item.displayName,
      position: pos === 'FB' ? 'RB' : pos,
      age: item.age ?? null,
      yearsExp: item.experience?.years ?? null,
      healthAbbrev,
      injuryDetail,
      depthOrder: order,
      headshot: item.headshot?.href ?? null,
    });
  }

  return athletes;
}

export async function fetchEspnInjuries(): Promise<EspnInjury[]> {
  try {
    const data = await fetchJson<{
      injuries?: {
        displayName?: string;
        team?: { abbreviation?: string };
        injuries?: {
          athlete?: {
            displayName?: string;
            team?: { abbreviation?: string };
          };
          status?: string;
        }[];
      }[];
    }>(`${ESPN_SITE}/injuries`);

    const out: EspnInjury[] = [];
    for (const group of data.injuries ?? []) {
      const groupAbbrev = group.team?.abbreviation ?? '';
      for (const row of group.injuries ?? []) {
        if (!row.athlete?.displayName || !row.status) continue;
        const abbrev =
          row.athlete.team?.abbreviation ?? groupAbbrev;
        out.push({
          teamAbbrev: coachAbbrevFromEspn(abbrev),
          playerName: row.athlete.displayName,
          status: row.status,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchEspnNews(limit = 50): Promise<EspnNewsArticle[]> {
  const data = await fetchJson<{
    articles: {
      headline: string;
      description?: string;
      published?: string;
      links?: { web?: { href?: string } };
      categories?: {
        type?: string;
        team?: { abbreviation?: string };
      }[];
    }[];
  }>(`${ESPN_SITE}/news?limit=${limit}`);

  return (data.articles ?? []).map((article) => ({
    headline: article.headline,
    description: article.description,
    link: article.links?.web?.href ?? null,
    published: article.published,
    teamAbbrevs: (article.categories ?? [])
      .filter((c) => c.type === 'team' && c.team?.abbreviation)
      .map((c) => c.team!.abbreviation!),
  }));
}
