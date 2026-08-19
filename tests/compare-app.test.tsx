import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CompareApp } from '~/components/compare/CompareApp';
import { buildDossiers, type ComparedPlayer } from '~/lib/compare/compare';
import { DATA_SOURCES } from '~/lib/data/sources';
import { MarketSchema, EMPTY_MARKET, type Market } from '~/lib/schemas/market';
import { NewsSchema } from '~/lib/schemas/news';
import { PlayersSchema, type Player } from '~/lib/schemas/players';
import { ProfilesSchema } from '~/lib/schemas/profiles';
import { TrendingSchema } from '~/lib/schemas/trending';
import { fixtureTeam } from './fixtures/league';

const players: Player[] = PlayersSchema.parse([
  { id: 'alpha', name: 'Alpha Back', pos: 'RB', nflTeam: 'ATL', age: 24, tier: 'cornerstone', notes: '', rank: 40 },
  { id: 'bravo', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', age: 27, tier: 'starter', notes: '', rank: 5, injuryStatus: 'Questionable' },
  { id: 'delta', name: 'Delta Nobody', pos: 'WR', nflTeam: 'DEN', age: 22, tier: 'dart-throw', notes: '' },
]);

const market: Market = MarketSchema.parse({
  ...EMPTY_MARKET,
  capturedAt: '2026-08-18T00:00:00.000Z',
  scrapeDate: '2026-08-17',
  players: [
    { fpId: '1', sleeperId: null, ktcId: null, espnId: null, playerId: 'alpha', name: 'Alpha Back', pos: 'RB', nflTeam: 'ATL', age: 24.2, draftYear: 2024, ecrSf: 4, ecr1qb: 2, posEcr: 1, valueSf: 8000, value1qb: 8800 },
    { fpId: '2', sleeperId: null, ktcId: null, espnId: null, playerId: 'bravo', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', age: 27.4, draftYear: 2021, ecrSf: 12, ecr1qb: 6, posEcr: 5, valueSf: 6000, value1qb: 7000 },
  ],
});

const dossiers: ComparedPlayer[] = buildDossiers({
  players,
  market,
  trending: TrendingSchema.parse({
    capturedAt: '2026-08-18T06:00:00.000Z',
    lookbackHours: 24,
    adds: [{ playerId: 'bravo', sleeperId: '2', name: 'Bravo Wideout', pos: 'WR', nflTeam: 'BUF', count: 900 }],
    drops: [],
  }),
  news: NewsSchema.parse([
    { id: 'n1', title: 'Alpha Back returns to practice', url: 'https://example.com/a1', source: 'ESPN', sourceId: 'espn', publishedAt: '2026-08-17T12:00:00.000Z', summary: '', tags: [], players: ['alpha'], teams: ['ATL'] },
  ]),
  profiles: ProfilesSchema.parse([
    {
      playerId: 'alpha',
      headline: 'Every-down back on a rising offense.',
      role: 'Roughly 18 touches a game.',
      fit: 'Zone scheme that fits his vision.',
      risk: 'A committee could form behind him.',
      asOf: '2026-08-18',
      sources: [{ label: 'ESPN camp report', url: 'https://example.com/profile' }],
    },
  ]),
  depthRankById: { alpha: 1, bravo: 2 },
  team: fixtureTeam,
});

function renderApp(initialIds = ['alpha', 'bravo']) {
  return render(
    <CompareApp
      dossiers={dossiers}
      options={{ superflex: true, lookbackHours: 24 }}
      initialIds={initialIds}
      sources={DATA_SOURCES.filter((s) => ['dynastyprocess', 'sleeper', 'nflverse'].includes(s.id))}
      capturedAt={{
        market: '2026-08-18T00:00:00.000Z',
        trending: '2026-08-18T06:00:00.000Z',
        depth: '2026-08-18T05:00:00.000Z',
      }}
      links={{ team: '/loop/team', picks: '/loop/picks', knowledge: '/loop/knowledge' }}
    />,
  );
}

describe('CompareApp', () => {
  it('opens on the players the page selected, one column each', () => {
    renderApp();
    const columns = screen.getAllByTestId('player-column');
    expect(columns).toHaveLength(2);
    expect(within(columns[0]!).getByText('Alpha Back')).toBeInTheDocument();
    expect(within(columns[1]!).getByText('Bravo Wideout')).toBeInTheDocument();
  });

  it('groups the rows by upstream and flags the family that shares one', () => {
    renderApp();
    expect(screen.getByText('Analyst consensus')).toBeInTheDocument();
    expect(screen.getByText('Sleeper — the independent read')).toBeInTheDocument();
    expect(screen.getByText('Opportunity — nflverse depth charts')).toBeInTheDocument();
    expect(screen.getByText('SHARES AN UPSTREAM')).toBeInTheDocument();
  });

  it('marks the better cell in each row', () => {
    renderApp();
    const ecrRow = screen.getByTestId('compare-table').querySelector('[data-row="ecr"]')!;
    const cells = within(ecrRow as HTMLElement).getAllByTestId('compare-cell');
    expect(cells[0]).toHaveAttribute('data-leader', 'true');
    expect(cells[1]).toHaveAttribute('data-leader', 'false');
  });

  it('names the split when the consensus and Sleeper lead with different players', () => {
    renderApp();
    const headline = screen.getByTestId('compare-headline');
    expect(headline).toHaveAttribute('data-agreement', 'split');
    expect(headline).toHaveTextContent('Alpha Back');
    expect(headline).toHaveTextContent('Bravo Wideout');
  });

  it('adds a searched player and removes a selected one', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.type(screen.getByLabelText('Add a player'), 'delta');
    await user.click(await screen.findByRole('button', { name: /Delta Nobody/ }));
    expect(screen.getAllByTestId('player-column')).toHaveLength(3);

    await user.click(screen.getByRole('button', { name: 'Remove Alpha Back from the comparison' }));
    const columns = screen.getAllByTestId('player-column');
    expect(columns).toHaveLength(2);
    expect(screen.queryByText('Alpha Back')).not.toBeInTheDocument();
  });

  it('shows the cited scouting profile and the tagged news for a player who has them', () => {
    renderApp(['alpha']);
    const dossier = screen.getByTestId('player-dossier');
    expect(within(dossier).getByText('Every-down back on a rising offense.')).toBeInTheDocument();
    expect(within(dossier).getByRole('link', { name: 'ESPN camp report' })).toHaveAttribute(
      'href',
      'https://example.com/profile',
    );
    expect(within(dossier).getByRole('link', { name: /returns to practice/ })).toBeInTheDocument();
  });

  it('says which sources have nothing on a player instead of showing a bare blank', () => {
    renderApp(['delta']);
    expect(screen.getByTestId('player-missing')).toHaveTextContent(
      /dynastyprocess, sleeper, nflverse, rss/,
    );
  });

  it('credits every source behind the numbers, licence included', () => {
    renderApp();
    const credits = screen.getByTestId('compare-sources');
    expect(within(credits).getByText(/nflverse/)).toBeInTheDocument();
    expect(within(credits).getByText('CC-BY-4.0')).toBeInTheDocument();
    expect(within(credits).getByText('ATTRIBUTION REQUIRED')).toBeInTheDocument();
  });

  it('renders an empty state when no player data has been synced', () => {
    render(
      <CompareApp
        dossiers={[]}
        options={{ superflex: true, lookbackHours: 24 }}
        initialIds={[]}
        sources={[]}
        capturedAt={{ market: '', trending: '', depth: '' }}
        links={{ team: '/loop/team', picks: '/loop/picks', knowledge: '/loop/knowledge' }}
      />,
    );
    expect(screen.getByText(/No players to compare yet/)).toBeInTheDocument();
  });
});
