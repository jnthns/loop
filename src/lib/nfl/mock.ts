import type { EspnNewsArticle, EspnTeamStanding } from './espn';
import type { SleeperPlayer, SleeperTrendingEntry } from './sleeper';
import type { BoardInputs } from './recommend';

export const MOCK_STANDINGS: EspnTeamStanding[] = [
  { abbrev: 'KC', displayName: 'Kansas City Chiefs', logo: null, wins: 15, losses: 2, ties: 0, winPct: 0.882, pointsFor: 385, pointsAgainst: 251, streak: 'W4' },
  { abbrev: 'DET', displayName: 'Detroit Lions', logo: null, wins: 15, losses: 2, ties: 0, winPct: 0.882, pointsFor: 564, pointsAgainst: 342, streak: 'W3' },
  { abbrev: 'PHI', displayName: 'Philadelphia Eagles', logo: null, wins: 14, losses: 3, ties: 0, winPct: 0.824, pointsFor: 463, pointsAgainst: 303, streak: 'W2' },
  { abbrev: 'BUF', displayName: 'Buffalo Bills', logo: null, wins: 13, losses: 4, ties: 0, winPct: 0.765, pointsFor: 525, pointsAgainst: 368, streak: 'L1' },
  { abbrev: 'CIN', displayName: 'Cincinnati Bengals', logo: null, wins: 9, losses: 8, ties: 0, winPct: 0.529, pointsFor: 472, pointsAgainst: 434, streak: 'W5' },
  { abbrev: 'DAL', displayName: 'Dallas Cowboys', logo: null, wins: 7, losses: 10, ties: 0, winPct: 0.412, pointsFor: 350, pointsAgainst: 452, streak: 'L2' },
  { abbrev: 'LV', displayName: 'Las Vegas Raiders', logo: null, wins: 4, losses: 13, ties: 0, winPct: 0.235, pointsFor: 309, pointsAgainst: 434, streak: 'L10' },
  { abbrev: 'TEN', displayName: 'Tennessee Titans', logo: null, wins: 3, losses: 14, ties: 0, winPct: 0.176, pointsFor: 311, pointsAgainst: 460, streak: 'L6' },
];

let mockSeq = 0;
function mockPlayer(
  name: string,
  position: string,
  teamAbbrev: string,
  searchRank: number,
  depthChartOrder: number,
  injuryStatus: string | null = null,
): SleeperPlayer {
  mockSeq += 1;
  return {
    id: `mock-${mockSeq}`,
    fullName: name,
    position,
    teamAbbrev,
    status: 'Active',
    injuryStatus,
    searchRank,
    depthChartOrder,
    age: 26,
    yearsExp: 4,
  };
}

export const MOCK_PLAYERS: SleeperPlayer[] = [
  mockPlayer('Patrick Mahomes', 'QB', 'KC', 2, 1),
  mockPlayer('Isiah Pacheco', 'RB', 'KC', 60, 1),
  mockPlayer('Xavier Worthy', 'WR', 'KC', 40, 1),
  mockPlayer('Travis Kelce', 'TE', 'KC', 30, 1),
  mockPlayer('Jared Goff', 'QB', 'DET', 18, 1),
  mockPlayer('Jahmyr Gibbs', 'RB', 'DET', 8, 1),
  mockPlayer('Amon-Ra St. Brown', 'WR', 'DET', 6, 1),
  mockPlayer('Sam LaPorta', 'TE', 'DET', 45, 1),
  mockPlayer('Jalen Hurts', 'QB', 'PHI', 7, 1),
  mockPlayer('Saquon Barkley', 'RB', 'PHI', 3, 1),
  mockPlayer('A.J. Brown', 'WR', 'PHI', 12, 1),
  mockPlayer('Dallas Goedert', 'TE', 'PHI', 120, 1, 'Questionable'),
  mockPlayer('Josh Allen', 'QB', 'BUF', 1, 1),
  mockPlayer('James Cook', 'RB', 'BUF', 25, 1),
  mockPlayer('Keon Coleman', 'WR', 'BUF', 70, 1),
  mockPlayer('Dalton Kincaid', 'TE', 'BUF', 80, 1),
  mockPlayer('Joe Burrow', 'QB', 'CIN', 5, 1),
  mockPlayer("Chase Brown", 'RB', 'CIN', 55, 1),
  mockPlayer('Ja\u2019Marr Chase', 'WR', 'CIN', 4, 1),
  mockPlayer('Tee Higgins', 'WR', 'CIN', 22, 2),
  mockPlayer('Dak Prescott', 'QB', 'DAL', 50, 1),
  mockPlayer('Javonte Williams', 'RB', 'DAL', 150, 1),
  mockPlayer('CeeDee Lamb', 'WR', 'DAL', 9, 1),
  mockPlayer('Jake Ferguson', 'TE', 'DAL', 110, 1),
  mockPlayer('Aidan O\u2019Connell', 'QB', 'LV', 500, 1),
  mockPlayer('Ashton Jeanty', 'RB', 'LV', 20, 1),
  mockPlayer('Jakobi Meyers', 'WR', 'LV', 90, 1),
  mockPlayer('Brock Bowers', 'TE', 'LV', 15, 1),
  mockPlayer('Will Levis', 'QB', 'TEN', 600, 1),
  mockPlayer('Tony Pollard', 'RB', 'TEN', 130, 1),
  mockPlayer('Calvin Ridley', 'WR', 'TEN', 65, 1),
  mockPlayer('Chig Okonkwo', 'TE', 'TEN', 300, 1, 'Out'),
];

export const MOCK_TRENDING: SleeperTrendingEntry[] = [
  { playerId: 'mock-6', count: 8200 },
  { playerId: 'mock-15', count: 3400 },
  { playerId: 'mock-30', count: 6100 },
];

export const MOCK_NEWS: EspnNewsArticle[] = [
  {
    headline: 'Lions RB cleared for camp, expected to share backfield work',
    description: 'Detroit Lions backfield news ahead of training camp.',
    link: null,
    published: '2026-07-28T00:00:00Z',
  },
  {
    headline: 'Chiefs receiver turns heads in offseason program',
    description: 'Kansas City Chiefs wideout drawing rave reviews.',
    link: null,
    published: '2026-07-27T00:00:00Z',
  },
  {
    headline: 'Raiders name starting QB for training camp opener',
    description: 'Las Vegas Raiders set their depth chart.',
    link: null,
    published: '2026-07-26T00:00:00Z',
  },
];

export function mockBoardInputs(season: number): BoardInputs {
  return {
    standings: MOCK_STANDINGS,
    players: MOCK_PLAYERS,
    trending: MOCK_TRENDING,
    injuries: [],
    news: MOCK_NEWS,
    season,
    live: false,
    sources: {
      espnStandings: false,
      espnInjuries: false,
      espnNews: false,
      sleeperPlayers: false,
      sleeperTrending: false,
    },
  };
}
