import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../../pages/api/nfl/board';
import { buildBoard } from './recommend';
import { mockBoardInputs } from './mock';

vi.mock('./board', () => ({
  getTeamBoard: vi.fn(),
}));

import { getTeamBoard } from './board';

const mockedGetTeamBoard = vi.mocked(getTeamBoard);

describe('GET /api/nfl/board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the team board as JSON', async () => {
    mockedGetTeamBoard.mockResolvedValue(buildBoard(mockBoardInputs(2025)));

    const res = await GET({} as never);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.meta.season).toBe(2025);
    expect(Array.isArray(body.winning)).toBe(true);
    expect(Array.isArray(body.losing)).toBe(true);
    expect(body.winning[0].picks.length).toBeGreaterThan(0);
    expect(body.winning[0].coach.name.length).toBeGreaterThan(0);
  });

  it('returns 500 when the board cannot be built', async () => {
    mockedGetTeamBoard.mockRejectedValue(new Error('upstream down'));

    const res = await GET({} as never);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('upstream down');
  });
});
