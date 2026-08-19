import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PicksApp } from '~/components/PicksApp';
import type { PositionBoards, BoardEntry, BoardPos } from '~/lib/picks/board';
import { BOARD_POSITIONS } from '~/lib/picks/board';
import type {
  PickRecommendations,
  PositionNeed,
  Recommendation,
} from '~/lib/picks/recommend';

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

function need(pos: BoardPos, over: Partial<PositionNeed> = {}): PositionNeed {
  return {
    pos,
    facetScore: 4,
    grade: 'watch',
    requiredStarters: 2,
    rosteredCount: 1,
    openStarters: 1,
    needWeight: 0.5,
    summary: `${pos} summary`,
    attention: `${pos} attention`,
    ...over,
  };
}

function rec(over: Partial<Recommendation> & { name: string; pos: BoardPos; rank: number }): Recommendation {
  return {
    key: `${over.name}-${over.rank}`,
    playerId: over.name.toLowerCase().replace(/\s/g, '-'),
    nflTeam: 'ZZZ',
    age: 24.5,
    score: 90,
    factors: [
      {
        id: 'value',
        label: 'Trade value (DynastyProcess)',
        points: 50,
        max: 60,
        detail: 'Trade value 5,000.',
      },
      { id: 'age', label: 'Age curve', points: -3, max: 6, detail: 'Past the peak.' },
    ],
    why: [`${over.name} rationale line.`],
    profile: null,
    ecr: 12,
    posEcr: 2,
    value: 5000,
    valuePosRank: 1,
    ecrPosRank: 1,
    sleeperRank: 9,
    sleeperPosRank: 4,
    sleeperVsConsensus: -3,
    platforms: [
      {
        id: 'fantasypros' as const,
        label: 'FantasyPros',
        posRank: 1,
        display: 'ECR 12',
        note: 'Superflex expert consensus rank',
        independent: false,
      },
      {
        id: 'dynastyprocess' as const,
        label: 'DynastyProcess',
        posRank: 1,
        display: '5,000',
        note: 'Trade-value model, derived from the FantasyPros consensus',
        independent: false,
      },
      {
        id: 'sleeper' as const,
        label: 'Sleeper',
        posRank: 4,
        display: '#9',
        note: 'Platform search rank',
        independent: true,
      },
    ],
    depthRank: null,
    status: null,
    injuryStatus: null,
    adds: null,
    fillsTopNeed: false,
    ...over,
  };
}

const topPick = rec({
  name: 'Top Pick',
  pos: 'TE',
  rank: 1,
  score: 100,
  fillsTopNeed: true,
  profile: {
    playerId: 'top-pick',
    headline: 'Every-down tight end.',
    role: 'Leads the team in routes run.',
    fit: 'Premium scoring rewards the position.',
    risk: 'Shares an offense with two good receivers.',
    asOf: '2026-08-18',
    sources: [{ label: 'Example Source', url: 'https://example.com/top-pick' }],
  },
});

const secondPick = rec({ name: 'Second Pick', pos: 'WR', rank: 2, score: 80 });

const recs: PickRecommendations = {
  recommendations: [topPick, secondPick],
  byNeed: [
    { need: need('TE', { needWeight: 1, facetScore: 0, grade: 'weak' }), players: [topPick] },
    { need: need('WR'), players: [secondPick] },
    { need: need('RB'), players: [] },
    { need: need('QB', { needWeight: 0.1, facetScore: 9, grade: 'strong' }), players: [] },
  ],
  needs: [
    need('TE', { needWeight: 1, facetScore: 0, grade: 'weak' }),
    need('WR'),
    need('RB'),
    need('QB', { needWeight: 0.1, facetScore: 9, grade: 'strong' }),
  ],
  health: {
    positionTotal: 20,
    window: 'rebuild',
    windowLabel: 'Rebuild',
    windowAdvice: 'Advice',
    facets: [],
    priorities: [],
    rosteredCount: 4,
    draftCoaching: null,
  },
  headline: 'Pick 5.04 (#57) is next. Prioritize TE, then WR.',
  nextPickNumber: 57,
  picksUntilNext: 3,
  marketCapturedAt: '2026-08-10T00:00:00.000Z',
  sources: data.sources,
  platformNotes: [
    {
      id: 'fantasypros',
      label: 'FantasyPros',
      note: 'Expert Consensus Rank.',
      independent: false,
    },
    {
      id: 'dynastyprocess',
      label: 'DynastyProcess',
      note: 'Built from the FantasyPros consensus.',
      independent: false,
    },
    { id: 'sleeper', label: 'Sleeper', note: 'Sleeper own search rank.', independent: true },
  ],
  weights: {
    valuePoints: 45,
    consensusPoints: 20,
    sleeperPoints: 15,
    maxNeedBoost: 0.35,
    formatSwing: 0.15,
    byPosition: BOARD_POSITIONS.map((pos) => ({
      pos,
      weight: 1,
      reason: `${pos} weighting reason for this league.`,
    })),
  },
};

const links = { team: '/loop/team', builds: '/loop/builds' };

function setup() {
  return render(<PicksApp data={data} recs={recs} links={links} />);
}

describe('PicksApp — roster gap header', () => {
  it('leads with the next pick and the draft coach’s read', () => {
    setup();
    const header = screen.getByTestId('need-header');
    expect(within(header).getByTestId('need-headline')).toHaveTextContent('Prioritize TE, then WR');
    expect(header).toHaveTextContent('#57');
    expect(header).toHaveTextContent('3 picks away');
  });

  it('shows every position ordered by need, flagging the biggest gap', () => {
    setup();
    const cells = screen.getAllByTestId('need-cell');
    expect(cells.map((c) => c.dataset.pos)).toEqual(['TE', 'WR', 'RB', 'QB']);
    expect(within(cells[0]!).getByText('BIGGEST GAP')).toBeInTheDocument();
    expect(within(cells[0]!).getByText('0/10')).toBeInTheDocument();
  });
});

describe('PicksApp — recommendations', () => {
  it('opens on the recommended list, best first, with the reasoning visible', () => {
    setup();
    const rows = screen.getAllByTestId('recommendation');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Top Pick');
    expect(rows[0]).toHaveTextContent('TOP NEED');
    expect(within(rows[0]!).getByTestId('recommendation-why')).toHaveTextContent(
      'Top Pick rationale line.',
    );
  });

  it('shows all three platform ranks on the row, flagging the shared upstream', () => {
    setup();
    const strip = within(screen.getAllByTestId('recommendation')[0]!).getByTestId('platform-strip');
    const cells = within(strip).getAllByTestId('platform-cell');
    expect(cells.map((c) => c.dataset.platform)).toEqual([
      'fantasypros',
      'dynastyprocess',
      'sleeper',
    ]);
    expect(cells.map((c) => c.dataset.independent)).toEqual(['false', 'false', 'true']);
    // The two that share an upstream are labeled; the independent one is not.
    expect(within(strip).getAllByText('SAME SOURCE')).toHaveLength(2);
    expect(strip).toHaveTextContent('TE4');
    expect(strip).toHaveTextContent('#9');
  });

  it('reports the cross-platform spread when it is wide enough to matter', () => {
    setup();
    const strip = within(screen.getAllByTestId('recommendation')[0]!).getByTestId('platform-strip');
    expect(within(strip).getByTestId('platform-disagreement')).toHaveTextContent(
      'The analysts are 3 spots higher on him than Sleeper.',
    );
  });

  it('breaks the score into named factors', () => {
    setup();
    const factors = within(screen.getAllByTestId('recommendation')[0]!).getByTestId(
      'recommendation-factors',
    );
    expect(within(factors).getAllByTestId('factor').map((f) => f.dataset.factor)).toEqual([
      'value',
      'age',
    ]);
    expect(factors).toHaveTextContent('+50.0');
    expect(factors).toHaveTextContent('-3.0');
  });

  it('renders a cited scouting profile when the player has one', () => {
    setup();
    const profile = within(screen.getAllByTestId('recommendation')[0]!).getByTestId('profile');
    expect(profile).toHaveTextContent('Every-down tight end.');
    expect(profile).toHaveTextContent('Leads the team in routes run.');
    expect(profile).toHaveTextContent('Shares an offense with two good receivers.');
    expect(within(profile).getByRole('link', { name: 'Example Source' })).toHaveAttribute(
      'href',
      'https://example.com/top-pick',
    );
  });

  it('renders no profile block for a player without one', () => {
    setup();
    expect(
      within(screen.getAllByTestId('recommendation')[1]!).queryByTestId('profile'),
    ).not.toBeInTheDocument();
  });
});

describe('PicksApp — modes', () => {
  it('groups players under the hole they fill, needs first', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('mode-need'));
    const groups = screen.getAllByTestId('need-group');
    expect(groups.map((g) => g.dataset.pos)).toEqual(['TE', 'WR', 'RB', 'QB']);
    expect(groups[0]).toHaveTextContent('need 100/100');
    expect(groups[0]).toHaveTextContent('Top Pick');
    expect(groups[2]).toHaveTextContent('No available RB matches the current filter.');
  });

  it('shows every platform side by side, with the spread and the provenance', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('mode-platforms'));

    const split = screen.getByTestId('platform-split');
    const headers = within(split).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['Player', 'FantasyPros', 'DynastyProcess', 'Sleeper', 'Spread']);

    const rows = within(split).getAllByTestId('platform-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByTestId('platform-spread')).toHaveTextContent('-3');

    // The table states which columns are independent rather than implying three
    // agreeing sources.
    const notes = within(split).getByTestId('platform-notes');
    expect(within(notes).getAllByText('SHARES UPSTREAM')).toHaveLength(2);
    expect(within(notes).getAllByText('INDEPENDENT')).toHaveLength(1);
  });

  it('still offers the consensus board and the waiver list', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(screen.getByTestId('mode-board'));
    const lists = screen.getAllByTestId('position-list');
    expect(lists.map((l) => l.dataset.pos)).toEqual([...BOARD_POSITIONS]);
    expect(screen.getAllByText('ROSTERED')).toHaveLength(BOARD_POSITIONS.length);

    await user.click(screen.getByTestId('mode-trending'));
    expect(screen.getByTestId('picks-source-note')).toHaveTextContent('last 24h');
    expect(screen.getAllByText('+4,321')).toHaveLength(BOARD_POSITIONS.length);
  });

  it('hides taken players on the board, and offers that control only there', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByTestId('only-available')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('mode-board'));
    await user.click(screen.getByTestId('only-available'));
    expect(screen.queryByText('ROSTERED')).not.toBeInTheDocument();
  });
});

describe('PicksApp — filters', () => {
  it('filters recommendations by position', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByTestId('pos-WR'));
    const rows = screen.getAllByTestId('recommendation');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Second Pick');
  });

  it('filters recommendations by name', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByTestId('picks-filter'), 'Top');
    const rows = screen.getAllByTestId('recommendation');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Top Pick');
  });

  it('says so when a filter empties the list', async () => {
    const user = userEvent.setup();
    setup();
    await user.type(screen.getByTestId('picks-filter'), 'nobody');
    expect(screen.getByText(/No available player matches/)).toBeInTheDocument();
  });
});

describe('PicksApp — showing its work', () => {
  it('publishes the weighting behind the scores', () => {
    setup();
    const key = screen.getByTestId('scoring-key');
    expect(key).toHaveTextContent('45 points of DynastyProcess trade value');
    expect(key).toHaveTextContent('20 points of FantasyPros expert consensus rank');
    expect(key).toHaveTextContent('15 points of Sleeper platform rank');
    expect(key).toHaveTextContent('up to +35%');
    expect(key).toHaveTextContent('weighted as one opinion on purpose');
    expect(within(key).getByTestId('format-weights')).toHaveTextContent(
      'QB weighting reason for this league.',
    );
  });

  it('says the score is relative to the field, not an absolute rating', () => {
    setup();
    expect(screen.getByTestId('picks-source-note')).toHaveTextContent(
      'relative to the best player still on the board',
    );
  });

  it('cites where the numbers came from', () => {
    setup();
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
        recs={{ ...recs, recommendations: [], byNeed: [] }}
        links={links}
      />,
    );
    expect(screen.getByText(/No board data yet/)).toBeInTheDocument();
  });
});
