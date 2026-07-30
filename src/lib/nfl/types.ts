export type OffensivePosition = 'QB' | 'RB' | 'WR' | 'TE';

export type HealthStatus =
  | 'ACTIVE'
  | 'QUESTIONABLE'
  | 'DOUBTFUL'
  | 'OUT'
  | 'IR'
  | 'UNKNOWN';

export type Verdict = 'STRONG PICK' | 'PICK' | 'HOLD' | 'AVOID';

export interface CoachProfile {
  teamAbbrev: string;
  name: string;
  title: string;
  styleTag: string;
  offense: string;
}

export interface PlayerPick {
  id: string;
  name: string;
  position: OffensivePosition;
  teamAbbrev: string;
  depthOrder: number | null;
  age: number | null;
  yearsExp: number | null;
  health: HealthStatus;
  trendingAdds: number | null;
  score: number;
  verdict: Verdict;
  whyPick: string;
  buildFit: string;
}

export interface TeamNewsItem {
  headline: string;
  link: string | null;
}

export interface TeamEntry {
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
  group: 'winning' | 'losing';
  coach: CoachProfile;
  picks: PlayerPick[];
  recommendedId: string | null;
  news: TeamNewsItem[];
}

export interface BoardMeta {
  generatedAt: string;
  season: number;
  live: boolean;
  sources: {
    espnStandings: boolean;
    espnInjuries: boolean;
    espnNews: boolean;
    sleeperPlayers: boolean;
    sleeperTrending: boolean;
  };
}

export interface TeamBoard {
  meta: BoardMeta;
  winning: TeamEntry[];
  losing: TeamEntry[];
}
