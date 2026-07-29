import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dashboard, type DashboardProps } from '~/components/Dashboard';
import { PlayersSchema } from '~/lib/schemas/players';
import { TeamSchema } from '~/lib/schemas/team';
import { rosterAlerts, coverageGaps, facetCoverage, openSlots } from '~/lib/insights/cross-reference';
import type { NewsItem } from '~/lib/schemas/news';
import playersRaw from '../data/players.json';
import teamRaw from '../data/team.json';

const players = PlayersSchema.parse(playersRaw);
const team = TeamSchema.parse(teamRaw);
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
  news: '/loop/news',
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
  it('renders all four sections', () => {
    mount();
    for (const id of ['alerts-section', 'digest-section', 'roster-section', 'coverage-section']) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
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
    expect(screen.getByRole('link', { name: 'Full archive' })).toHaveAttribute('href', '/loop/news');
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
});
