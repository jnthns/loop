import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamApp } from '~/components/TeamApp';
import { DraftPanel } from '~/components/DraftPanel';
import { NO_DRAFT, type Draft } from '~/lib/schemas/draft';
import { loadOverlay } from '~/lib/team/storage';
import { fixturePlayers, fixtureTeam } from './fixtures/league';

/**
 * The live league synced 0/26 filled because the startup has not happened. The
 * page used to render 26 blank rows, which reads as a broken sync rather than an
 * undrafted team. These tests pin the honest behavior.
 */

const emptyTeam = {
  ...fixtureTeam,
  roster: fixtureTeam.roster.map((r) => ({ ...r, playerId: null })),
};

const preDraft: Draft = {
  draftId: 'd1',
  status: 'pre_draft',
  type: 'snake',
  startTime: '2026-08-15T23:00:00.000Z',
  teams: 12,
  rounds: 26,
  myDraftSlot: 7,
  myPicks: [7, 18, 31, 42],
  picks: [],
};

describe('DraftPanel', () => {
  it('shows status, type, size, and your slot', () => {
    render(<DraftPanel draft={preDraft} />);
    const panel = screen.getByTestId('draft-panel');
    expect(panel.dataset.status).toBe('pre_draft');
    expect(within(panel).getByText('snake')).toBeInTheDocument();
    expect(within(panel).getByText('26')).toBeInTheDocument();
    expect(within(panel).getByText('7 of 12')).toBeInTheDocument();
  });

  it('lists your pick numbers by round', () => {
    render(<DraftPanel draft={preDraft} />);
    const picks = within(screen.getByTestId('my-picks')).getAllByRole('listitem');
    expect(picks).toHaveLength(4);
    expect(picks[0]).toHaveTextContent('R1 7');
    expect(picks[1]).toHaveTextContent('R2 18');
  });

  it('explains snake ordering rather than leaving the numbers unexplained', () => {
    render(<DraftPanel draft={preDraft} />);
    expect(screen.getByText(/every other round reverses/)).toBeInTheDocument();
  });

  it('says plainly when Sleeper has no draft yet', () => {
    render(<DraftPanel draft={NO_DRAFT} />);
    expect(screen.getByText(/no draft for this league yet/)).toBeInTheDocument();
    expect(screen.queryByTestId('my-picks')).not.toBeInTheDocument();
  });

  it('reports an unset draft order instead of inventing a slot', () => {
    render(<DraftPanel draft={{ ...preDraft, myDraftSlot: null, myPicks: [] }} />);
    expect(screen.getByText('not set')).toBeInTheDocument();
    expect(screen.queryByTestId('my-picks')).not.toBeInTheDocument();
  });

  it('shows dollars per roster spot for an auction', () => {
    render(
      <DraftPanel
        draft={{ ...preDraft, type: 'auction', myPicks: [] }}
        rosterSize={20}
        auctionTotal={200}
      />,
    );
    expect(screen.getByText('$10')).toBeInTheDocument();
  });

  it('marks which completed picks are yours', () => {
    render(
      <DraftPanel
        draft={{
          ...preDraft,
          status: 'drafting',
          picks: [
            { pick: 1, round: 1, slot: 1, rosterId: 2, playerId: null, playerName: 'Someone Else', pos: 'WR', nflTeam: 'CIN', mine: false },
            { pick: 7, round: 1, slot: 7, rosterId: 1, playerId: 'bijan-robinson', playerName: 'Bijan Robinson', pos: 'RB', nflTeam: 'ATL', mine: true },
          ],
        }}
      />,
    );
    const picks = within(screen.getByTestId('draft-picks')).getAllByTestId('draft-pick');
    expect(picks).toHaveLength(2);
    expect(picks[1].dataset.mine).toBe('true');
    expect(picks[1]).toHaveTextContent('Bijan Robinson');
  });
});

describe('TeamApp before the draft', () => {
  function mount(draft: Draft = preDraft) {
    return render(<TeamApp committed={emptyTeam} players={fixturePlayers} draft={draft} />);
  }

  it('leads with the draft instead of an empty roster table', () => {
    mount();
    expect(screen.getByTestId('draft-panel')).toBeInTheDocument();
    expect(screen.queryAllByTestId('slot-row')).toHaveLength(0);
  });

  it('says the empty roster is expected, not a sync failure', () => {
    mount();
    const notice = screen.getByTestId('empty-roster-notice');
    expect(notice).toHaveTextContent(/not a sync failure/);
    expect(notice).toHaveTextContent(String(emptyTeam.roster.length));
  });

  it('can still show the empty roster on request', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: 'Show empty roster anyway' }));
    expect(screen.getAllByTestId('slot-row')).toHaveLength(emptyTeam.roster.length);
  });

  it('promotes the targets to a draft shortlist', () => {
    mount();
    const shortlist = screen.getByTestId('shortlist');
    expect(within(shortlist).getAllByTestId('shortlist-target').length).toBe(
      emptyTeam.targets.length,
    );
    expect(within(shortlist).getByText(/Superflex punishes/)).toBeInTheDocument();
  });

  it('groups the shortlist by the slot each target fills', () => {
    mount();
    const groups = screen.getAllByTestId('shortlist-group');
    expect(groups.length).toBeGreaterThan(1);
    expect(new Set(groups.map((g) => g.dataset.slot)).size).toBe(groups.length);
  });

  it('marks a shortlist player as drafted straight into their slot', async () => {
    const user = userEvent.setup();
    mount();
    const group = screen.getAllByTestId('shortlist-group').find((g) => g.dataset.slot === 'te-1')!;
    await user.click(within(group).getAllByRole('button', { name: 'Drafted' })[0]);

    const overlay = loadOverlay()!;
    expect(overlay.roster.find((r) => r.slotId === 'te-1')!.playerId).toBe('brock-bowers');
  });

  it('still shows the budget ledgers — the auction cap matters most pre-draft', () => {
    mount();
    expect(screen.getAllByTestId('budget').length).toBe(emptyTeam.budgets.length);
  });

  it('reverts to the normal roster view once players exist', () => {
    render(<TeamApp committed={fixtureTeam} players={fixturePlayers} draft={preDraft} />);
    expect(screen.queryByTestId('empty-roster-notice')).not.toBeInTheDocument();
    expect(screen.queryByTestId('draft-panel')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('slot-row').length).toBe(fixtureTeam.roster.length);
  });

  it('shows the roster normally after a completed draft, even if empty', () => {
    render(
      <TeamApp
        committed={emptyTeam}
        players={fixturePlayers}
        draft={{ ...preDraft, status: 'complete' }}
      />,
    );
    expect(screen.queryByTestId('empty-roster-notice')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('slot-row').length).toBe(emptyTeam.roster.length);
  });
});
