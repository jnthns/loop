import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamApp } from '~/components/TeamApp';
import { DraftPanel } from '~/components/DraftPanel';
import {
  getTargetAvailability,
  getDraftProgress,
  getMyDraftedPicks,
} from '~/lib/team/availability';
import type { Draft } from '~/lib/schemas/draft';
import { fixturePlayers, fixtureTeam } from './fixtures/league';

const activeDraft: Draft = {
  draftId: 'd-active',
  status: 'paused',
  type: 'snake',
  startTime: '2026-08-15T23:00:00.000Z',
  teams: 12,
  rounds: 26,
  myDraftSlot: 4,
  myPicks: [4, 21, 28, 45],
  reversalRound: 0,
  picks: [
    {
      pick: 1,
      round: 1,
      slot: 1,
      rosterId: 3,
      playerId: 'josh-allen',
      playerName: 'Josh Allen',
      pos: 'QB',
      nflTeam: 'BUF',
      mine: false,
    },
    {
      pick: 2,
      round: 1,
      slot: 2,
      rosterId: 10,
      playerId: 'jahmyr-gibbs',
      playerName: 'Jahmyr Gibbs',
      pos: 'RB',
      nflTeam: 'DET',
      mine: false,
    },
    {
      pick: 3,
      round: 1,
      slot: 3,
      rosterId: 2,
      playerId: 'bijan-robinson',
      playerName: 'Bijan Robinson',
      pos: 'RB',
      nflTeam: 'ATL',
      mine: false,
    },
    {
      pick: 4,
      round: 1,
      slot: 4,
      rosterId: 7,
      playerId: 'drake-maye',
      playerName: 'Drake Maye',
      pos: 'QB',
      nflTeam: 'NE',
      mine: true,
    },
    {
      pick: 9,
      round: 1,
      slot: 9,
      rosterId: 1,
      playerId: 'brock-bowers',
      playerName: 'Brock Bowers',
      pos: 'TE',
      nflTeam: 'LV',
      mine: false,
    },
    {
      pick: 15,
      round: 2,
      slot: 3,
      rosterId: 6,
      playerId: 'ashton-jeanty',
      playerName: 'Ashton Jeanty',
      pos: 'RB',
      nflTeam: 'LV',
      mine: false,
    },
    {
      pick: 16,
      round: 2,
      slot: 4,
      rosterId: 1,
      playerId: 'caleb-williams',
      playerName: 'Caleb Williams',
      pos: 'QB',
      nflTeam: 'CHI',
      mine: false,
    },
  ],
};

const teamWithDrakeMaye = {
  ...fixtureTeam,
  roster: [
    { slotId: 'qb-1', playerId: 'drake-maye', acquired: 'Startup 1.04', notes: '' },
    ...fixtureTeam.roster.slice(1).map((r) => ({ ...r, playerId: null })),
  ],
};

describe('getTargetAvailability', () => {
  it('marks a player on your roster as drafted_by_me', () => {
    const avail = getTargetAvailability('drake-maye', undefined, teamWithDrakeMaye, activeDraft);
    expect(avail.status).toBe('drafted_by_me');
    expect(avail.isDraftedByMe).toBe(true);
    expect(avail.isAvailable).toBe(false);
  });

  it('marks a player drafted by another team in activeDraft as taken', () => {
    const caleb = fixturePlayers.find((p) => p.id === 'caleb-williams');
    const avail = getTargetAvailability('caleb-williams', caleb, teamWithDrakeMaye, activeDraft);
    expect(avail.status).toBe('taken');
    expect(avail.isTaken).toBe(true);
    expect(avail.label).toContain('Pick 2.04');
  });

  it('marks a player still on the board as available', () => {
    const mahomes = fixturePlayers.find((p) => p.id === 'patrick-mahomes');
    const avail = getTargetAvailability('patrick-mahomes', mahomes, teamWithDrakeMaye, activeDraft);
    expect(avail.status).toBe('available');
    expect(avail.isAvailable).toBe(true);
  });
});

describe('getDraftProgress & getMyDraftedPicks', () => {
  it('counts completed picks and calculates distance to next pick', () => {
    const stats = getDraftProgress(activeDraft);
    expect(stats.totalPicksMade).toBe(7);
    expect(stats.myPicksMade).toBe(1);
    expect(stats.nextPickNumber).toBe(21);
    expect(stats.picksUntilNextTurn).toBe(14); // 21 - 7
    // Thirteen other managers pick before this one is up.
    expect(stats.picksAhead).toBe(13);
  });

  it('returns my drafted picks', () => {
    const myPicks = getMyDraftedPicks(activeDraft);
    expect(myPicks).toHaveLength(1);
    expect(myPicks[0].playerName).toBe('Drake Maye');
  });
});

describe('DraftPanel during draft with my drafted team', () => {
  it('renders Your drafted players section', () => {
    render(<DraftPanel draft={activeDraft} />);
    const section = screen.getByTestId('my-drafted-team');
    expect(section).toBeInTheDocument();
    expect(within(section).getByText('Drake Maye')).toBeInTheDocument();
    expect(within(section).getByText('1.04')).toBeInTheDocument();
  });

  it('filters picks by All, Yours, and Recent', async () => {
    const user = userEvent.setup();
    render(<DraftPanel draft={activeDraft} />);

    // Default 'all' shows all 7 picks
    expect(screen.getAllByTestId('draft-pick')).toHaveLength(7);

    // Filter by 'Yours'
    await user.click(screen.getByRole('button', { name: /Yours/ }));
    const myPicks = screen.getAllByTestId('draft-pick');
    expect(myPicks).toHaveLength(1);
    expect(myPicks[0]).toHaveTextContent('Drake Maye');
  });
});

describe('TeamApp slot alternatives stay available-aware', () => {
  function mount() {
    return render(
      <TeamApp committed={teamWithDrakeMaye} players={fixturePlayers} draft={activeDraft} />,
    );
  }

  it('renders the roster-health panel instead of a pick schedule or shortlist', () => {
    mount();
    expect(screen.getByTestId('roster-health')).toBeInTheDocument();
    expect(screen.getByTestId('draft-coaching')).toBeInTheDocument();
    expect(screen.queryByTestId('draft-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('shortlist')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('slot-row').length).toBeGreaterThan(0);
  });

  it('shows availability in expanded slot alternatives', async () => {
    const user = userEvent.setup();
    mount();

    const sflexRow = screen
      .getAllByTestId('slot-row')
      .find((r) => r.dataset.slot === 'sflex-1')!;
    await user.click(within(sflexRow).getByRole('button', { name: /alt/ }));

    const panel = screen.getByTestId('targets-row');
    const alternatives = within(panel).getAllByTestId('target');

    const calebAlt = alternatives.find((a) => a.textContent?.includes('Caleb Williams'))!;
    expect(calebAlt.dataset.availability).toBe('taken');
    expect(within(calebAlt).getByText('Off the board')).toBeInTheDocument();

    const mahomesAlt = alternatives.find((a) => a.textContent?.includes('Patrick Mahomes'))!;
    expect(mahomesAlt.dataset.availability).toBe('available');
    expect(within(mahomesAlt).getByRole('button', { name: /Move into/ })).toBeInTheDocument();
  });
});
