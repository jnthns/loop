import { describe, expect, it } from 'vitest';
import { resolveStandingsSeason } from './espn';
import { normalizeTeamAbbrev } from './sleeper';
import { buildBoard } from './recommend';
import { mockBoardInputs } from './mock';
import { coachForTeam } from './coaches';

describe('resolveStandingsSeason', () => {
  it('uses previous year before September', () => {
    expect(resolveStandingsSeason(new Date(2026, 6, 29))).toBe(2025);
    expect(resolveStandingsSeason(new Date(2026, 7, 31))).toBe(2025);
  });

  it('uses current year from September onward', () => {
    expect(resolveStandingsSeason(new Date(2026, 8, 1))).toBe(2026);
    expect(resolveStandingsSeason(new Date(2026, 11, 25))).toBe(2026);
  });
});

describe('normalizeTeamAbbrev', () => {
  it('maps Rams legacy code', () => {
    expect(normalizeTeamAbbrev('LA')).toBe('LAR');
  });

  it('passes through standard codes', () => {
    expect(normalizeTeamAbbrev('KC')).toBe('KC');
  });
});

describe('coachForTeam', () => {
  it('returns curated profile for known teams', () => {
    expect(coachForTeam('KC').name).toBe('Andy Reid');
  });

  it('falls back gracefully for unknown teams', () => {
    const coach = coachForTeam('XX');
    expect(coach.teamAbbrev).toBe('XX');
    expect(coach.name).toBe('Staff TBD');
  });
});

describe('buildBoard', () => {
  const board = buildBoard(mockBoardInputs(2025));

  it('splits teams into winning and losing groups by record', () => {
    expect(board.winning.map((t) => t.abbrev)).toEqual(['DET', 'KC', 'PHI', 'BUF', 'CIN']);
    expect(board.losing.map((t) => t.abbrev)).toEqual(['DAL', 'LV', 'TEN']);
    for (const team of board.winning) expect(team.winPct).toBeGreaterThanOrEqual(0.5);
    for (const team of board.losing) expect(team.winPct).toBeLessThan(0.5);
  });

  it('sorts each group by win percentage descending', () => {
    const winPcts = board.winning.map((t) => t.winPct);
    expect(winPcts).toEqual([...winPcts].sort((a, b) => b - a));
  });

  it('selects up to 4 offensive players per team, best-ranked per position first', () => {
    const kc = board.winning.find((t) => t.abbrev === 'KC');
    expect(kc).toBeDefined();
    expect(kc!.picks).toHaveLength(4);
    expect(kc!.picks.map((p) => p.position)).toEqual(['QB', 'RB', 'WR', 'TE']);
    expect(kc!.picks[0].name).toBe('Patrick Mahomes');
  });

  it('marks injured players as AVOID and picks a healthy recommendation', () => {
    const ten = board.losing.find((t) => t.abbrev === 'TEN');
    const okonkwo = ten!.picks.find((p) => p.name === 'Chig Okonkwo');
    expect(okonkwo!.health).toBe('OUT');
    expect(okonkwo!.verdict).toBe('AVOID');
    const recommended = ten!.picks.find((p) => p.id === ten!.recommendedId);
    expect(recommended).toBeDefined();
    expect(recommended!.verdict).not.toBe('AVOID');
  });

  it('rewards strong players on winning teams more than losing teams', () => {
    const mahomes = board.winning
      .find((t) => t.abbrev === 'KC')!
      .picks.find((p) => p.name === 'Patrick Mahomes');
    const levis = board.losing.find((t) => t.abbrev === 'TEN')!.picks.find((p) => p.name === 'Will Levis');
    expect(mahomes!.score).toBeGreaterThan(levis!.score);
    expect(['STRONG PICK', 'PICK']).toContain(mahomes!.verdict);
  });

  it('applies Sleeper trending adds to matching players', () => {
    const gibbs = board.winning
      .find((t) => t.abbrev === 'DET')!
      .picks.find((p) => p.name === 'Jahmyr Gibbs');
    expect(gibbs!.trendingAdds).toBe(8200);
  });

  it('attaches matching team news and mentions coach scheme in why-pick copy', () => {
    const det = board.winning.find((t) => t.abbrev === 'DET')!;
    expect(det.news.length).toBeGreaterThan(0);
    expect(det.news[0].headline).toContain('Lions');
    const gibbs = det.picks.find((p) => p.name === 'Jahmyr Gibbs')!;
    expect(gibbs.whyPick).toContain('Dan Campbell');
    expect(gibbs.whyPick).toContain('Aggressive power run');
    expect(gibbs.buildFit.length).toBeGreaterThan(0);
  });

  it('reports meta with season and source flags', () => {
    expect(board.meta.season).toBe(2025);
    expect(board.meta.live).toBe(false);
    expect(board.meta.sources.sleeperPlayers).toBe(false);
  });
});
