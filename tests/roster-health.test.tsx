import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { diagnoseRosterHealth, gradeFor, windowFromTotal } from '~/lib/team/health';
import { RosterHealthPanel } from '~/components/RosterHealthPanel';
import { fixturePlayers, fixtureTeam } from './fixtures/league';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';

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
});
