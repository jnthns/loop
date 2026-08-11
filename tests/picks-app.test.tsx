import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PicksApp } from '~/components/PicksApp';
import type { PositionBoards, BoardEntry, BoardPos } from '~/lib/picks/board';
import { BOARD_POSITIONS } from '~/lib/picks/board';

function entry(over: Partial<BoardEntry> & { name: string; pos: BoardPos; rank: number }): BoardEntry {
  return {
    key: `${over.name}-${over.rank}`,
    playerId: null,
    nflTeam: 'ZZZ',
    age: 24,
    ecr: 10,
    posEcr: 1,
    value: 5000,
    adds: null,
    drops: null,
    availability: 'available',
    depthRank: null,
    status: null,
    injuryStatus: null,
    ...over,
  };
}

const data: PositionBoards = {
  boards: BOARD_POSITIONS.map((pos) => ({
    pos,
    board: [
      entry({ name: `${pos} One`, pos, rank: 1 }),
      entry({ name: `${pos} Two`, pos, rank: 2, availability: 'rostered' }),
    ],
    trending: [entry({ name: `${pos} Hot`, pos, rank: 1, adds: 4321 })],
  })),
  marketCapturedAt: '2026-08-10T00:00:00.000Z',
  trendingCapturedAt: '2026-08-11T00:00:00.000Z',
  trendingLookbackHours: 24,
  sources: [{ label: 'DynastyProcess', url: 'https://github.com/dynastyprocess/data', kind: 'dataset' }],
};

const links = { team: '/loop/team', builds: '/loop/builds' };

describe('PicksApp', () => {
  it('renders one list per position', () => {
    render(<PicksApp data={data} links={links} />);
    const lists = screen.getAllByTestId('position-list');
    expect(lists.map((l) => l.dataset.pos)).toEqual([...BOARD_POSITIONS]);
    for (const pos of BOARD_POSITIONS) {
      expect(screen.getByRole('heading', { name: pos })).toBeInTheDocument();
    }
  });

  it('shows the draft board first, in popularity order', () => {
    render(<PicksApp data={data} links={links} />);
    const qb = screen.getAllByTestId('position-list').find((l) => l.dataset.pos === 'QB')!;
    const names = within(qb)
      .getAllByTestId('pick-row')
      .map((row) => row.textContent);
    expect(names[0]).toContain('QB One');
    expect(names[1]).toContain('QB Two');
  });

  it('switches every position to Sleeper add counts at once', async () => {
    const user = userEvent.setup();
    render(<PicksApp data={data} links={links} />);
    await user.click(screen.getByTestId('mode-trending'));
    expect(screen.getByTestId('picks-source-note')).toHaveTextContent('last 24h');
    expect(screen.getAllByText('+4,321')).toHaveLength(BOARD_POSITIONS.length);
  });

  it('marks unavailable players and can hide them', async () => {
    const user = userEvent.setup();
    render(<PicksApp data={data} links={links} />);
    expect(screen.getAllByText('ROSTERED').length).toBe(BOARD_POSITIONS.length);

    await user.click(screen.getByTestId('only-available'));
    expect(screen.queryByText('ROSTERED')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('pick-row')).toHaveLength(BOARD_POSITIONS.length);
  });

  it('filters by name across every position', async () => {
    const user = userEvent.setup();
    render(<PicksApp data={data} links={links} />);
    await user.type(screen.getByTestId('picks-filter'), 'WR One');
    const rows = screen.getAllByTestId('pick-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('WR One');
  });

  it('cites where the numbers came from', () => {
    render(<PicksApp data={data} links={links} />);
    const sources = screen.getByTestId('picks-sources');
    expect(within(sources).getByRole('link', { name: 'DynastyProcess' })).toHaveAttribute(
      'href',
      'https://github.com/dynastyprocess/data',
    );
  });

  it('explains itself when there is no data yet', () => {
    render(
      <PicksApp
        data={{ ...data, boards: BOARD_POSITIONS.map((pos) => ({ pos, board: [], trending: [] })) }}
        links={links}
      />,
    );
    expect(screen.getByText(/No board data yet/)).toBeInTheDocument();
  });
});
