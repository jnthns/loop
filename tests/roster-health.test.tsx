import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { diagnoseRosterHealth, gradeFor, windowFromTotal } from '~/lib/team/health';
import {
  buildDraftCoaching,
  rosteredPlayersIncludingDraft,
} from '~/lib/team/draft-coaching';
import { RosterHealthPanel } from '~/components/RosterHealthPanel';
import type { Draft } from '~/lib/schemas/draft';
import { fixturePlayers, fixtureTeam } from './fixtures/league';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';

const midDraft: Draft = {
  draftId: 'd-mid',
  status: 'drafting',
  type: 'snake',
  startTime: '2026-08-15T23:00:00.000Z',
  teams: 12,
  rounds: 30,
  myDraftSlot: 4,
  myPicks: [4, 21, 28, 45, 52],
  reversalRound: 0,
  picks: [
    {
      pick: 4,
      round: 1,
      slot: 4,
      rosterId: 7,
      playerId: 'jayden-daniels',
      playerName: 'Jayden Daniels',
      pos: 'QB',
      nflTeam: 'WAS',
      mine: true,
    },
    {
      pick: 21,
      round: 2,
      slot: 4,
      rosterId: 7,
      playerId: 'caleb-williams',
      playerName: 'Caleb Williams',
      pos: 'QB',
      nflTeam: 'CHI',
      mine: true,
    },
    {
      pick: 28,
      round: 3,
      slot: 4,
      rosterId: 7,
      playerId: 'saquon-barkley',
      playerName: 'Saquon Barkley',
      pos: 'RB',
      nflTeam: 'PHI',
      mine: true,
    },
    {
      pick: 29,
      round: 3,
      slot: 5,
      rosterId: 5,
      playerId: 'brock-bowers',
      playerName: 'Brock Bowers',
      pos: 'TE',
      nflTeam: 'LV',
      mine: false,
    },
    {
      pick: 44,
      round: 4,
      slot: 3,
      rosterId: 3,
      playerId: 'malik-nabers',
      playerName: 'Malik Nabers',
      pos: 'WR',
      nflTeam: 'NYG',
      mine: false,
    },
  ],
};

const emptyRosterTeam: Team = {
  ...fixtureTeam,
  roster: fixtureTeam.roster.map((r) => ({ ...r, playerId: null })),
};

function withRoster(playerIds: Record<string, string | null>, extras: Player[] = []): {
  team: Team;
  players: Player[];
} {
  const team: Team = {
    ...fixtureTeam,
    roster: fixtureTeam.roster.map((row) =>
      playerIds[row.slotId] !== undefined ? { ...row, playerId: playerIds[row.slotId] } : row,
    ),
  };
  return { team, players: [...fixturePlayers, ...extras] };
}

describe('gradeFor / windowFromTotal', () => {
  it('maps the RSJ 2026 bands', () => {
    expect(windowFromTotal(40, 10).window).toBe('contend');
    expect(windowFromTotal(32, 10).window).toBe('contend');
    expect(windowFromTotal(31, 10).window).toBe('pivot');
    expect(windowFromTotal(24, 10).window).toBe('pivot');
    expect(windowFromTotal(23, 10).window).toBe('rebuild');
    expect(windowFromTotal(0, 0).window).toBe('empty');
  });

  it('grades 8+ strong, 5–7 watch, else weak', () => {
    expect(gradeFor(10)).toBe('strong');
    expect(gradeFor(8)).toBe('strong');
    expect(gradeFor(7)).toBe('watch');
    expect(gradeFor(5)).toBe('watch');
    expect(gradeFor(4)).toBe('weak');
  });
});

describe('diagnoseRosterHealth', () => {
  it('flags an empty roster as empty and weak at every positional room', () => {
    const empty = {
      ...fixtureTeam,
      roster: fixtureTeam.roster.map((r) => ({ ...r, playerId: null })),
    };
    const health = diagnoseRosterHealth(empty, fixturePlayers);
    expect(health.window).toBe('empty');
    expect(health.rosteredCount).toBe(0);
    expect(health.facets.find((f) => f.id === 'qb')?.grade).toBe('weak');
    expect(health.priorities.length).toBeGreaterThan(0);
  });

  it('calls out a one-QB superflex room as a structural hole', () => {
    const health = diagnoseRosterHealth(fixtureTeam, fixturePlayers);
    const qb = health.facets.find((f) => f.id === 'qb')!;
    // Jayden is cornerstone; Bo Nix is stored as depth, so only one startable QB.
    expect(qb.score).toBeLessThan(5);
    expect(qb.grade).toBe('weak');
    expect(qb.attention).toMatch(/structural hole/i);
    expect(health.priorities.some((f) => f.id === 'qb')).toBe(true);
  });

  it('scores two young startable RBs as a strength', () => {
    const health = diagnoseRosterHealth(fixtureTeam, fixturePlayers);
    const rb = health.facets.find((f) => f.id === 'rb')!;
    expect(rb.grade).toBe('strong');
    expect(rb.score).toBeGreaterThanOrEqual(8);
  });

  it('drops the RB room when the only startable backs are 27+', () => {
    const { team } = withRoster({
      'rb-1': 'saquon-barkley',
      'rb-2': null,
    });
    const health = diagnoseRosterHealth(team, fixturePlayers);
    const rb = health.facets.find((f) => f.id === 'rb')!;
    expect(rb.grade).not.toBe('strong');
    expect(rb.attention).toMatch(/sell a year early/i);
  });

  it('rewards a TE-premium difference-maker and punishes a blank TE slot', () => {
    const strong = diagnoseRosterHealth(
      withRoster({ 'te-1': 'brock-bowers' }).team,
      fixturePlayers,
    );
    expect(strong.facets.find((f) => f.id === 'te')?.score).toBe(10);

    const emptyTe = diagnoseRosterHealth(withRoster({ 'te-1': null }).team, fixturePlayers);
    expect(emptyTe.facets.find((f) => f.id === 'te')?.grade).toBe('weak');
  });

  it('flags stored injury designations without inventing any', () => {
    const hurt: Player = { ...fixturePlayers[0], injuryStatus: 'Out' };
    const players = fixturePlayers.map((p) => (p.id === hurt.id ? hurt : p));
    const health = diagnoseRosterHealth(fixtureTeam, players);
    const avail = health.facets.find((f) => f.id === 'availability')!;
    expect(avail.grade).not.toBe('strong');
    expect(avail.evidence.some((line) => line.includes('Out'))).toBe(true);
  });

  it('cites the 2026 sources on every facet', () => {
    const health = diagnoseRosterHealth(fixtureTeam, fixturePlayers);
    for (const facet of health.facets) {
      expect(facet.sourceIds.length).toBeGreaterThan(0);
    }
  });

  it('merges my draft picks into the graded roster when slots are still empty', () => {
    const byId = new Map(fixturePlayers.map((p) => [p.id, p]));
    const rostered = rosteredPlayersIncludingDraft(emptyRosterTeam, byId, midDraft);
    expect(rostered.map((p) => p.id).sort()).toEqual(
      ['caleb-williams', 'jayden-daniels', 'saquon-barkley'].sort(),
    );

    const health = diagnoseRosterHealth(emptyRosterTeam, fixturePlayers, midDraft);
    expect(health.rosteredCount).toBe(3);
    expect(health.window).not.toBe('empty');
  });

  it('builds next-pick coaching from weaknesses and available targets', () => {
    const health = diagnoseRosterHealth(emptyRosterTeam, fixturePlayers, midDraft);
    const coaching = buildDraftCoaching(emptyRosterTeam, fixturePlayers, midDraft, {
      ...health,
      draftCoaching: null,
    });

    expect(coaching?.active).toBe(true);
    expect(coaching?.myPicksMade).toBe(3);
    expect(coaching?.nextPickNumber).toBe(45);
    expect(coaching?.positionPriority.length).toBeGreaterThan(0);
    expect(coaching?.headline).toMatch(/Pick 4\.04/);
    expect(coaching?.headline).toMatch(/Prioritize/);

    const names = coaching!.suggestions.map((s) => s.playerName);
    expect(names).toContain('Patrick Mahomes');
    expect(names).not.toContain('Caleb Williams');
    expect(names).not.toContain('Brock Bowers');
  });

  it('appends draft context to positional weakness callouts', () => {
    const health = diagnoseRosterHealth(emptyRosterTeam, fixturePlayers, midDraft);
    const wr = health.priorities.find((f) => f.id === 'wr');
    expect(wr?.attention).toMatch(/Draft read:/);
  });
});

describe('RosterHealthPanel', () => {
  it('renders weak facets in the attention list and cites sources', () => {
    const health = diagnoseRosterHealth(fixtureTeam, fixturePlayers);
    render(<RosterHealthPanel health={health} />);
    const panel = screen.getByTestId('roster-health');
    expect(panel).toBeInTheDocument();
    expect(screen.getByTestId('health-window').dataset.window).not.toBe('empty');
    const weak = within(panel)
      .getAllByTestId('health-facet')
      .filter((el) => el.dataset.grade === 'weak');
    expect(weak.length).toBeGreaterThan(0);
    expect(screen.getByTestId('health-sources').querySelectorAll('a').length).toBeGreaterThan(5);
  });

  it('shows next-pick coaching during an active draft', () => {
    const health = diagnoseRosterHealth(emptyRosterTeam, fixturePlayers, midDraft);
    render(<RosterHealthPanel health={health} />);
    const coaching = screen.getByTestId('draft-coaching');
    expect(coaching).toBeInTheDocument();
    expect(screen.getByTestId('draft-coaching-headline').textContent).toMatch(/Pick 4\.04/);
    expect(within(coaching).getAllByTestId('draft-suggestion').length).toBeGreaterThan(0);
  });
});
