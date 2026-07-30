import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TeamsApp } from './TeamsApp';

import { buildBoard } from '../../lib/nfl/recommend';

import { mockBoardInputs } from '../../lib/nfl/mock';



vi.mock('../../lib/nfl/board', () => ({

  getTeamBoard: vi.fn(),

}));



import { getTeamBoard } from '../../lib/nfl/board';



const mockedGetTeamBoard = vi.mocked(getTeamBoard);



describe('TeamsApp', () => {

  beforeEach(() => {

    mockedGetTeamBoard.mockResolvedValue(buildBoard(mockBoardInputs(2025)));

  });



  afterEach(() => {

    vi.clearAllMocks();

  });



  it('loads the board on mount and renders both carousels', async () => {

    render(<TeamsApp />);



    await waitFor(() =>

      expect(screen.getByText('Winning / High-Promise')).toBeInTheDocument(),

    );

    expect(screen.getByText('Losing / Low-Value')).toBeInTheDocument();

    expect(screen.getByText('Kansas City Chiefs')).toBeInTheDocument();

    expect(screen.getByText('Tennessee Titans')).toBeInTheDocument();

    expect(mockedGetTeamBoard).toHaveBeenCalled();

  });



  it('shows the sample-data banner when the board is not live', async () => {

    render(<TeamsApp />);

    await waitFor(() =>

      expect(screen.getByText(/Live data unavailable/)).toBeInTheDocument(),

    );

  });



  it('pins the coach with a collapsible offensive scheme profile', async () => {

    render(<TeamsApp />);

    await waitFor(() => screen.getByText('Kansas City Chiefs'));



    const toggles = screen.getAllByRole('button', { name: /offensive scheme/i });

    const chiefsToggle = toggles.find((btn) =>
      btn.parentElement?.textContent?.includes('Andy Reid'),
    );

    expect(chiefsToggle).toBeDefined();

    expect(screen.queryByText(/modern West Coast template/)).not.toBeInTheDocument();



    fireEvent.click(chiefsToggle!);

    expect(screen.getByText(/modern West Coast template/)).toBeInTheDocument();



    fireEvent.click(screen.getByRole('button', { name: /hide scheme/i }));

    expect(screen.queryByText(/modern West Coast template/)).not.toBeInTheDocument();

  });



  it('defaults each team profile to the recommended player and switches on tile click', async () => {

    render(<TeamsApp />);

    await waitFor(() => screen.getByText('Kansas City Chiefs'));



    await waitFor(() =>

      expect(screen.getAllByText('Why the pick').length).toBeGreaterThan(0),

    );



    const worthyTiles = screen.getAllByRole('button', { name: /Xavier Worthy/ });

    fireEvent.click(worthyTiles[0]);



    await waitFor(() => {

      const headers = screen.getAllByText(/Xavier Worthy · WR/);

      expect(headers.length).toBeGreaterThan(0);

    });

  });



  it('shows an error state with retry when the board cannot be loaded', async () => {

    mockedGetTeamBoard.mockRejectedValue(new Error('upstream down'));

    render(<TeamsApp />);



    await waitFor(() =>

      expect(screen.getByText(/upstream down/)).toBeInTheDocument(),

    );

    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

  });

});


