import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamApp } from '~/components/TeamApp';
import { PlayersSchema } from '~/lib/schemas/players';
import { TeamSchema } from '~/lib/schemas/team';
import { STORAGE_KEY, loadOverlay, serializeTeam } from '~/lib/team/storage';
import playersRaw from '../data/players.json';
import teamRaw from '../data/team.json';

const players = PlayersSchema.parse(playersRaw);
const committed = TeamSchema.parse(teamRaw);

function mount() {
  return render(<TeamApp committed={committed} players={players} />);
}

const rows = () => screen.getAllByTestId('slot-row');

describe('TeamApp — roster', () => {
  it('renders one row per configured slot', () => {
    mount();
    expect(rows()).toHaveLength(committed.format.rosterSlots.length);
  });

  it('groups starters, bench, taxi, and IR separately', () => {
    mount();
    for (const heading of ['Starters', 'Bench', 'Taxi', 'Injured reserve']) {
      expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    }
  });

  it('shows the assigned player and their dynasty metadata', () => {
    mount();
    const row = rows().find((r) => r.dataset.slot === 'wr-1')!;
    expect(within(row).getByLabelText('WR1 player')).toHaveValue('jamarr-chase');
    expect(within(row).getByText('26')).toBeInTheDocument();
    expect(within(row).getByText('cornerstone')).toBeInTheDocument();
  });

  it('offers only position-eligible players for a dedicated slot', () => {
    mount();
    const row = rows().find((r) => r.dataset.slot === 'te-1')!;
    const options = within(row)
      .getAllByRole('option')
      .map((o) => o.textContent ?? '');
    expect(options.some((o) => o.includes('(TE)'))).toBe(true);
    expect(options.some((o) => o.includes('(WR)'))).toBe(false);
  });

  it('opens SUPERFLEX to quarterbacks', () => {
    mount();
    const row = rows().find((r) => r.dataset.slot === 'sflex-1')!;
    const options = within(row)
      .getAllByRole('option')
      .map((o) => o.textContent ?? '');
    expect(options.some((o) => o.includes('(QB)'))).toBe(true);
    expect(options.some((o) => o.includes('(RB)'))).toBe(true);
  });

  it('assigns a player to a slot and persists the change', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'bn-3')!;
    await user.selectOptions(within(row).getByLabelText('Bench 3 player'), 'ashton-jeanty');

    expect(within(row).getByLabelText('Bench 3 player')).toHaveValue('ashton-jeanty');
    const overlay = loadOverlay()!;
    expect(overlay.roster.find((r) => r.slotId === 'bn-3')!.playerId).toBe('ashton-jeanty');
  });

  it('can empty a slot', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'te-1')!;
    await user.selectOptions(within(row).getByLabelText('TE player'), '');
    expect(loadOverlay()!.roster.find((r) => r.slotId === 'te-1')!.playerId).toBeNull();
  });
});

describe('TeamApp — alternatives', () => {
  it('shows how many alternatives a slot has', () => {
    mount();
    const row = rows().find((r) => r.dataset.slot === 'sflex-1')!;
    expect(within(row).getByRole('button', { name: '3 alts' })).toBeInTheDocument();
  });

  it('lists them in priority order with rationale and cost, under their own slot', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'sflex-1')!;
    await user.click(within(row).getByRole('button', { name: '3 alts' }));

    const panel = screen.getByTestId('targets-row');
    expect(panel.dataset.slot).toBe('sflex-1');
    const targets = within(panel).getAllByTestId('target');
    expect(targets).toHaveLength(3);
    expect(targets[0]).toHaveTextContent('1. Caleb Williams');
    expect(targets[0]).toHaveTextContent(/Superflex punishes/);
    expect(targets[0]).toHaveTextContent('Likely cost');
  });

  it('promotes an alternative straight into the slot', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'te-1')!;
    await user.click(within(row).getByRole('button', { name: '2 alts' }));
    // Two alternatives are listed; promoting the top one is the common action.
    await user.click(screen.getAllByRole('button', { name: 'Move into TE' })[0]);

    expect(loadOverlay()!.roster.find((r) => r.slotId === 'te-1')!.playerId).toBe('brock-bowers');
  });

  it('marks slots with no alternatives rather than showing an empty control', () => {
    mount();
    const row = rows().find((r) => r.dataset.slot === 'k-1')!;
    expect(within(row).queryByRole('button', { name: /alt/ })).not.toBeInTheDocument();
  });
});

describe('TeamApp — budgets', () => {
  const ledger = (id: string) =>
    screen.getAllByTestId('budget').find((b) => b.dataset.budget === id)!;

  it('renders every ledger with its computed remaining', () => {
    mount();
    expect(screen.getAllByTestId('budget')).toHaveLength(committed.budgets.length);
    // 200 total, 62 + 48 + 41 + 24 allocated.
    expect(within(ledger('startup-auction')).getByTestId('allocated')).toHaveTextContent('$175');
    expect(within(ledger('startup-auction')).getByTestId('remaining')).toHaveTextContent('$25');
  });

  it('recomputes when an entry changes', async () => {
    const user = userEvent.setup();
    mount();
    const el = ledger('startup-auction');
    const amount = within(el).getByLabelText("Ja'Marr Chase amount");
    await user.clear(amount);
    await user.type(amount, '70');
    expect(within(el).getByTestId('remaining')).toHaveTextContent('$17');
  });

  it('recomputes when the ceiling changes', async () => {
    const user = userEvent.setup();
    mount();
    const el = ledger('faab-2026');
    const total = within(el).getByLabelText('FAAB — 2026 season total');
    await user.clear(total);
    await user.type(total, '150');
    expect(within(el).getByTestId('remaining')).toHaveTextContent('$150');
  });

  it('flags an overspent ledger instead of hiding it', async () => {
    const user = userEvent.setup();
    mount();
    const el = ledger('startup-auction');
    const amount = within(el).getByLabelText("Ja'Marr Chase amount");
    await user.clear(amount);
    await user.type(amount, '150');
    // 150 + 48 + 41 + 24 allocated against a 200 ceiling.
    expect(within(el).getByText(/Over the ceiling by \$63/)).toBeInTheDocument();
  });

  it('adds and removes entries', async () => {
    const user = userEvent.setup();
    mount();
    const el = ledger('faab-2026');
    const before = within(el).getAllByTestId('budget-entry').length;

    await user.click(within(el).getByRole('button', { name: 'Add entry' }));
    expect(within(el).getAllByTestId('budget-entry')).toHaveLength(before + 1);

    await user.click(within(el).getByRole('button', { name: 'Remove New entry' }));
    expect(within(el).getAllByTestId('budget-entry')).toHaveLength(before);
  });

  it('shows what is left per unfilled roster spot', () => {
    mount();
    expect(within(ledger('startup-auction')).getByText(/per open slot/)).toBeInTheDocument();
  });
});

describe('TeamApp — overlay', () => {
  it('starts from the committed file and says so', () => {
    mount();
    expect(screen.getByText(/Showing the committed/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard local edits' })).toBeDisabled();
  });

  it('warns that local edits are invisible to the loop', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'bn-4')!;
    await user.selectOptions(within(row).getByLabelText('Bench 4 player'), 'malik-nabers');
    expect(screen.getByText(/the loop still reads the committed/i)).toBeInTheDocument();
  });

  it('discards local edits back to the committed baseline', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'bn-4')!;
    await user.selectOptions(within(row).getByLabelText('Bench 4 player'), 'malik-nabers');
    await user.click(screen.getByRole('button', { name: 'Discard local edits' }));

    expect(loadOverlay()).toBeNull();
    expect(within(row).getByLabelText('Bench 4 player')).toHaveValue('');
  });

  it('round-trips through storage as schema-valid JSON', async () => {
    const user = userEvent.setup();
    mount();
    const row = rows().find((r) => r.dataset.slot === 'bn-5')!;
    await user.selectOptions(within(row).getByLabelText('Bench 5 player'), 'trey-mcbride');

    const stored = TeamSchema.safeParse(JSON.parse(localStorage.getItem(STORAGE_KEY)!));
    expect(stored.success).toBe(true);
    expect(TeamSchema.safeParse(JSON.parse(serializeTeam(stored.data!))).success).toBe(true);
  });

  it('ignores a stored overlay that no longer matches the schema', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ leagueName: 'broken' }));
    mount();
    expect(loadOverlay()).toBeNull();
    expect(screen.getByText(/Showing the committed/)).toBeInTheDocument();
  });

  it('ignores unparseable stored data', () => {
    localStorage.setItem(STORAGE_KEY, '{{{not json');
    mount();
    expect(screen.getByText(/Showing the committed/)).toBeInTheDocument();
  });
});
