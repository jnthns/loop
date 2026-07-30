import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dashboard, type DashboardProps } from '~/components/Dashboard';
import { rosterAlerts, coverageGaps, facetCoverage, openSlots } from '~/lib/insights/cross-reference';
import type { NewsItem } from '~/lib/schemas/news';
import { fixturePlayers, fixtureTeam } from './fixtures/league';

const players = fixturePlayers;
const team = fixtureTeam;
const NOW = new Date('2026-09-10T12:00:00.000Z');

function item(o: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${o.id}`,
    url: `https://example.com/${o.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T09:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...o,
  };
}

const news = [
  item({ id: 'own', title: 'Chase news', players: ['jamarr-chase'] }),
  item({ id: 'target', title: 'Bowers news', players: ['brock-bowers'] }),
  item({ id: 'plain', title: 'Unrelated news' }),
];

const links: DashboardProps['links'] = {
  team: '/loop/team',
  knowledge: '/loop/knowledge',
  facet: (id) => `/loop/knowledge/${id}`,
};

function mount(overrides: Partial<DashboardProps> = {}) {
  const alerts = rosterAlerts(news, team, players, { now: NOW });
  const alertIds = new Set(alerts.map((a) => a.item.id));
  const props: DashboardProps = {
    alerts,
    digest: news.filter((n) => !alertIds.has(n.id)),
    gaps: coverageGaps(facetCoverage([{ facet: 'trading', updated: NOW }], { now: NOW })),
    openSlots: openSlots(team),
    topTargets: team.targets
      .filter((t) => t.priority === 1)
      .map((target) => ({
        target,
        player: players.find((p) => p.id === target.playerId),
        slotLabel: target.slotId,
      })),
    links,
    newsCount: news.length,
    now: NOW,
    ...overrides,
  };
  return render(<Dashboard {...props} />);
}

describe('Dashboard', () => {
  it('renders every section', () => {
    mount();
    for (const id of [
      'alerts-section',
      'digest-section',
      'market-section',
      'roster-section',
      'coverage-section',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('shows Sleeper market activity with counts', () => {
    mount({
      trending: {
        capturedAt: '2026-09-10T12:00:00.000Z',
        lookbackHours: 24,
        adds: [
          { playerId: 'ashton-jeanty', sleeperId: '10222', name: 'Ashton Jeanty', pos: 'RB', nflTeam: 'LV', count: 2140 },
          { playerId: null, sleeperId: '9999', name: 'Some Rookie', pos: 'WR', nflTeam: 'FA', count: 880 },
        ],
        drops: [
          { playerId: 'jamarr-chase', sleeperId: '6794', name: "Ja'Marr Chase", pos: 'WR', nflTeam: 'CIN', count: 12 },
        ],
      },
      rosteredPlayerIds: ['jamarr-chase'],
    });

    expect(screen.getByText('2,140')).toBeInTheDocument();
    const dropped = within(screen.getByTestId('trending-drops')).getAllByTestId('trending-row');
    expect(dropped[0].dataset.mine).toBe('true');
    const added = within(screen.getByTestId('trending-adds')).getAllByTestId('trending-row');
    expect(added[0].dataset.mine).toBe('false');
  });

  it('does not present market counts as news', () => {
    mount({
      trending: {
        capturedAt: '2026-09-10T12:00:00.000Z',
        lookbackHours: 24,
        adds: [
          { playerId: null, sleeperId: '1', name: 'Someone', pos: 'RB', nflTeam: 'FA', count: 5 },
        ],
        drops: [],
      },
    });
    // Market rows are plain text, never links pretending to be articles.
    expect(within(screen.getByTestId('market-section')).queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText(/Counts, not analysis/)).toBeInTheDocument();
  });

  it('explains an empty market rather than rendering a blank block', () => {
    mount({ trending: undefined });
    expect(screen.getByText(/No market data yet/)).toBeInTheDocument();
  });

  it('surfaces news about rostered players, labelled as such', () => {
    mount();
    const alerts = screen.getAllByTestId('alert');
    expect(alerts[0]).toHaveTextContent('Chase news');
    expect(alerts[0].dataset.relation).toBe('rostered');
    expect(within(alerts[0]).getByText('on your roster')).toBeInTheDocument();
  });

  it('distinguishes target news from roster news', () => {
    mount();
    const target = screen.getAllByTestId('alert').find((a) => a.dataset.relation === 'target')!;
    expect(target).toHaveTextContent('Bowers news');
    expect(within(target).getByText('a target')).toBeInTheDocument();
  });

  it('keeps alerted items out of the general digest', () => {
    mount();
    const digest = screen.getAllByTestId('digest-item');
    expect(digest).toHaveLength(1);
    expect(digest[0]).toHaveTextContent('Unrelated news');
  });

  it('names the matched players on an alert', () => {
    mount();
    expect(screen.getByText("Ja'Marr Chase")).toBeInTheDocument();
  });

  it('lists open roster slots and top targets', () => {
    mount();
    expect(within(screen.getByTestId('open-slots')).getAllByRole('listitem').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('top-targets')).getAllByRole('listitem').length).toBeGreaterThan(0);
  });

  it('nudges about knowledge facets that need writing', () => {
    mount();
    const gaps = screen.getAllByTestId('gap');
    expect(gaps.length).toBeGreaterThan(0);
    expect(gaps[0].dataset.reason).toBe('empty');
    expect(gaps.some((g) => g.textContent?.includes('Trading'))).toBe(false);
  });

  it('links each section to its full page', () => {
    mount();
    expect(screen.getByRole('link', { name: 'My team' })).toHaveAttribute('href', '/loop/team');
    expect(screen.getByRole('link', { name: 'Knowledge base' })).toHaveAttribute(
      'href',
      '/loop/knowledge',
    );
  });

  it('explains an empty pipeline rather than showing a blank panel', () => {
    mount({ alerts: [], digest: [], newsCount: 0 });
    expect(screen.getByText(/nothing to cross-reference/)).toBeInTheDocument();
  });

  it('distinguishes "no news at all" from "no news about you"', () => {
    mount({ alerts: [] });
    expect(screen.getByText(/Nothing in the last 30 days mentions your players/)).toBeInTheDocument();
  });

  it('says so when every facet is covered', () => {
    mount({ gaps: [] });
    expect(screen.getByText('Every facet has recent coverage.')).toBeInTheDocument();
  });

  it('summarizes open slots instead of listing 26 of them before a draft', () => {
    mount({
      rosterEmpty: true,
      draft: {
        draftId: 'd1',
        status: 'pre_draft',
        type: 'snake',
        startTime: null,
        teams: 12,
        rounds: 26,
        myDraftSlot: 7,
        myPicks: [7, 18],
        picks: [],
      },
    });
    expect(screen.queryByTestId('open-slots')).not.toBeInTheDocument();
    const summary = screen.getByTestId('open-slots-summary');
    expect(summary).toHaveTextContent(/the draft has not happened yet/i);
    expect(summary).toHaveTextContent('You pick 7 of 12');
    expect(screen.getByRole('heading', { name: /Draft to-do/ })).toBeInTheDocument();
  });

  it('keeps the per-slot list once the roster has players', () => {
    mount({ rosterEmpty: false });
    expect(screen.getByTestId('open-slots')).toBeInTheDocument();
    expect(screen.queryByTestId('open-slots-summary')).not.toBeInTheDocument();
  });
});
