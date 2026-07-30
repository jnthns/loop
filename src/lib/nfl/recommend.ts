import type { EspnInjury, EspnNewsArticle, EspnTeamStanding } from './espn';
import type { SleeperPlayer, SleeperTrendingEntry } from './sleeper';
import { coachForTeam } from './coaches';
import type {
  HealthStatus,
  OffensivePosition,
  PlayerPick,
  TeamBoard,
  TeamEntry,
  TeamNewsItem,
  Verdict,
} from './types';

const OFFENSIVE_POSITIONS: OffensivePosition[] = ['QB', 'RB', 'WR', 'TE'];
const PICKS_PER_TEAM = 4;
const WIN_PCT_THRESHOLD = 0.5;
const MAX_SEARCH_RANK = 2000;

/** Positions each coach archetype leans on hardest — drives scheme fit. */
const SCHEME_FAVORITES: Record<string, OffensivePosition[]> = {
  'Wide-zone YAC machine': ['RB', 'WR', 'TE'],
  'Speed motion scheme': ['WR', 'RB'],
  'Creative schemed YAC': ['WR', 'RB', 'TE'],
  'West Coast spread RPO': ['QB', 'TE', 'WR'],
  'Heavy run / dual-threat QB': ['QB', 'RB'],
  'QB-centric spread': ['QB', 'WR'],
  'Pass-first spread': ['QB', 'WR'],
  'Pass-happy McVay tree': ['QB', 'WR'],
  'Play-action shot scheme': ['QB', 'WR'],
  'Precision timing pass': ['QB', 'RB', 'TE'],
  'Aggressive power run': ['RB', 'WR'],
  'Power run / play-action': ['RB', 'WR'],
  'RPO spread option': ['QB', 'RB'],
  'RPO tush-push machine': ['QB', 'RB', 'WR'],
  'Wide-zone play-action': ['RB', 'TE'],
  'Kubiak-tree play-action': ['RB', 'WR'],
  'Dual-threat vertical': ['QB', 'WR'],
  'Vertical play-action': ['RB', 'WR'],
  'Vertical boundary pass': ['WR', 'TE'],
  'Bengals-tree spread': ['QB', 'WR'],
  'McVay-tree spacing': ['WR', 'RB'],
  'Spread timing offense': ['RB', 'WR'],
  'Balanced rebuild': ['QB', 'RB'],
  'QB-friendly rhythm pass': ['QB', 'WR'],
  'Balanced West Coast': ['QB', 'WR', 'RB'],
  'Wide-zone illusion': ['RB', 'WR'],
  'Play-action deep shots': ['QB', 'WR'],
  'Establish-the-run': ['RB', 'WR'],
  'Physical complementary': ['RB', 'TE'],
  'Run game identity': ['RB', 'QB'],
  'Adaptive spread': ['QB', 'WR', 'RB'],
  'Veteran-led balance': ['WR', 'RB', 'TE'],
  'Unknown scheme': [],
};

const INJURY_STATUS_MAP: Record<string, HealthStatus> = {
  questionable: 'QUESTIONABLE',
  doubtful: 'DOUBTFUL',
  out: 'OUT',
  ir: 'IR',
  'injured reserve': 'IR',
  pup: 'IR',
  'physically unable to perform': 'IR',
  suspended: 'OUT',
};

function mapInjuryStatus(raw: string | null | undefined): HealthStatus {
  if (!raw) return 'ACTIVE';
  const mapped = INJURY_STATUS_MAP[raw.trim().toLowerCase()];
  return mapped ?? 'UNKNOWN';
}

function rankPoints(searchRank: number): number {
  if (searchRank <= 12) return 40;
  if (searchRank <= 36) return 32;
  if (searchRank <= 72) return 24;
  if (searchRank <= 150) return 16;
  if (searchRank <= 300) return 8;
  return 2;
}

function healthPoints(health: HealthStatus): number {
  switch (health) {
    case 'ACTIVE':
      return 20;
    case 'QUESTIONABLE':
      return 8;
    case 'DOUBTFUL':
      return 2;
    case 'OUT':
    case 'IR':
      return -30;
    case 'UNKNOWN':
      return 10;
  }
}

function trendingPoints(adds: number | null): number {
  if (adds === null) return 0;
  if (adds >= 5000) return 15;
  if (adds >= 2000) return 10;
  if (adds >= 500) return 5;
  return 0;
}

function teamContextPoints(team: EspnTeamStanding): number {
  const recordPoints = Math.round((team.winPct - 0.5) * 30);
  const margin = team.pointsFor - team.pointsAgainst;
  const marginPoints = Math.max(-8, Math.min(8, Math.round(margin / 40)));
  return recordPoints + marginPoints;
}

function verdictForScore(score: number, health: HealthStatus): Verdict {
  if (health === 'OUT' || health === 'IR') return 'AVOID';
  if (score >= 75) return 'STRONG PICK';
  if (score >= 55) return 'PICK';
  if (score >= 35) return 'HOLD';
  return 'AVOID';
}

function depthLabel(player: SleeperPlayer): string {
  if (player.depthChartOrder === 1) return 'locked-in starter';
  if (player.depthChartOrder === 2) return 'next-man-up';
  return 'depth option';
}

function buildWhyPick(
  player: SleeperPlayer,
  team: EspnTeamStanding,
  health: HealthStatus,
  trending: number | null,
  coachName: string,
  styleTag: string,
): string {
  const parts: string[] = [];

  parts.push(
    `${player.fullName} is the ${depthLabel(player)} ${player.position} in ${coachName}'s "${styleTag}" offense.`,
  );

  if (team.winPct >= 0.6) {
    parts.push(
      `On a ${team.wins}-win offense, game script keeps the scoring volume flowing.`, 
    );
  } else if (team.winPct >= WIN_PCT_THRESHOLD) {
    parts.push('A winning record means neutral-to-positive game script most weeks.');
  } else {
    parts.push(
      'A losing record drags weekly floor — chasing points caps the ceiling, so this is a value bet on talent over situation.',
    );
  }

  if (health === 'ACTIVE') {
    parts.push('Fully healthy per the latest injury reports.');
  } else if (health === 'QUESTIONABLE') {
    parts.push('Currently listed questionable — monitor practice reports before investing.');
  } else if (health === 'DOUBTFUL') {
    parts.push('Currently doubtful — wait for a clean bill of health.');
  } else if (health === 'OUT' || health === 'IR') {
    parts.push('Currently unavailable — stash only if your format rewards patience.');
  }

  if (trending !== null && trending >= 500) {
    parts.push(
      `${trending.toLocaleString()} fantasy managers added him in the last 48h on Sleeper — the market is moving.`,
    );
  }

  return parts.join(' ');
}

function buildFitFor(position: OffensivePosition, team: EspnTeamStanding): string {
  const winning = team.winPct >= WIN_PCT_THRESHOLD;
  switch (position) {
    case 'QB':
      return winning
        ? 'Fits any build as the anchor; stack with his top pass-catcher for ceiling weeks.'
        : 'Best as a superflex/2QB anchor where volume survives bad game script.';
    case 'RB':
      return winning
        ? 'Fits balanced and run-heavy builds; positive script protects weekly floor.'
        : 'Needs receiving work to pay off here — fits PPR builds that can absorb light boxes.';
    case 'WR':
      return winning
        ? 'Fits target-share builds; pairs with shootout stacks against weak secondaries.'
        : 'Fits best-ball and volume-based PPR builds where targets matter more than TDs.';
    case 'TE':
      return winning
        ? 'Fits builds that punt RB2/WR3 depth for a positional edge at a thin position.'
        : 'Fits streaming-plus builds: red-zone role keeps him viable even on a bad offense.';
  }
}

function teamMentionedIn(article: EspnNewsArticle, team: EspnTeamStanding): boolean {
  const text = `${article.headline} ${article.description}`.toLowerCase();
  const name = team.displayName.toLowerCase();
  const city = name.split(' ').slice(0, -1).join(' ');
  const mascot = name.split(' ').pop() ?? '';
  return (city.length > 2 && text.includes(city)) || (mascot.length > 2 && text.includes(mascot));
}

const POSITIVE_NEWS = /signs|extension|cleared|returns|activated|promoted|breakout|named starter/i;
const NEGATIVE_NEWS = /injur|suspended|arrested|holdout|placed on|ruled out|surgery/i;

function newsSentiment(items: TeamNewsItem[]): number {
  let score = 0;
  for (const item of items) {
    if (POSITIVE_NEWS.test(item.headline)) score += 3;
    if (NEGATIVE_NEWS.test(item.headline)) score -= 3;
  }
  return Math.max(-6, Math.min(6, score));
}

export interface BoardInputs {
  standings: EspnTeamStanding[];
  players: SleeperPlayer[];
  trending: SleeperTrendingEntry[];
  injuries: EspnInjury[];
  news: EspnNewsArticle[];
  season: number;
  live: boolean;
  sources: TeamBoard['meta']['sources'];
}

export function buildBoard(inputs: BoardInputs): TeamBoard {
  const trendingByPlayer = new Map(inputs.trending.map((t) => [t.playerId, t.count]));
  const injuryKey = new Map(
    inputs.injuries.map((i) => [`${i.teamAbbrev}|${i.playerName.toLowerCase()}`, i.status]),
  );

  const teams: TeamEntry[] = inputs.standings
    .filter((team) => team.abbrev.length > 0)
    .map((team) => {
      const coach = coachForTeam(team.abbrev);
      const roster = inputs.players
        .filter(
          (p) =>
            p.teamAbbrev === team.abbrev &&
            OFFENSIVE_POSITIONS.includes(p.position as OffensivePosition) &&
            p.status.toLowerCase() === 'active' &&
            p.searchRank < MAX_SEARCH_RANK,
        )
        .sort((a, b) => a.searchRank - b.searchRank);

      const selected: SleeperPlayer[] = [];
      for (const pos of OFFENSIVE_POSITIONS) {
        const best = roster.find((p) => p.position === pos && !selected.includes(p));
        if (best) selected.push(best);
        if (selected.length >= PICKS_PER_TEAM) break;
      }
      for (const candidate of roster) {
        if (selected.length >= PICKS_PER_TEAM) break;
        if (!selected.includes(candidate)) selected.push(candidate);
      }

      const teamNews: TeamNewsItem[] = inputs.news
        .filter((a) => teamMentionedIn(a, team))
        .slice(0, 3)
        .map((a) => ({ headline: a.headline, link: a.link }));

      const context = teamContextPoints(team);
      const sentiment = newsSentiment(teamNews);
      const favorites = SCHEME_FAVORITES[coach.styleTag] ?? [];

      const picks: PlayerPick[] = selected.map((p) => {
        const espnStatus = injuryKey.get(`${team.abbrev}|${p.fullName.toLowerCase()}`);
        const health = mapInjuryStatus(espnStatus ?? p.injuryStatus);
        const trending = trendingByPlayer.get(p.id) ?? null;
        const schemeBonus = favorites.includes(p.position as OffensivePosition) ? 10 : 0;

        const score = Math.max(
          0,
          Math.min(
            100,
            rankPoints(p.searchRank) +
              context +
              healthPoints(health) +
              trendingPoints(trending) +
              schemeBonus +
              sentiment,
          ),
        );

        const position = p.position as OffensivePosition;
        return {
          id: p.id,
          name: p.fullName,
          position,
          teamAbbrev: team.abbrev,
          depthOrder: p.depthChartOrder,
          age: p.age,
          yearsExp: p.yearsExp,
          health,
          trendingAdds: trending,
          score,
          verdict: verdictForScore(score, health),
          whyPick: buildWhyPick(p, team, health, trending, coach.name, coach.styleTag),
          buildFit: buildFitFor(position, team),
        };
      });

      const ranked = [...picks].sort((a, b) => b.score - a.score);
      const recommended = ranked.find((p) => p.verdict !== 'AVOID') ?? ranked[0] ?? null;

      return {
        abbrev: team.abbrev,
        displayName: team.displayName,
        logo: team.logo,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        winPct: team.winPct,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
        streak: team.streak,
        group: team.winPct >= WIN_PCT_THRESHOLD ? ('winning' as const) : ('losing' as const),
        coach,
        picks,
        recommendedId: recommended?.id ?? null,
        news: teamNews,
      };
    });

  const byRecord = (a: TeamEntry, b: TeamEntry) => b.winPct - a.winPct || b.pointsFor - a.pointsFor;

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      season: inputs.season,
      live: inputs.live,
      sources: inputs.sources,
    },
    winning: teams.filter((t) => t.group === 'winning').sort(byRecord),
    losing: teams.filter((t) => t.group === 'losing').sort(byRecord),
  };
}
