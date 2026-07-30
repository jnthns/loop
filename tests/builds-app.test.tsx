import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BuildsApp, type BuildEntry } from '~/components/builds/BuildsApp';
import { scoreArchetypes } from '~/lib/builds/fit';
import { planPicks } from '~/lib/builds/picks';
import { ARCHETYPES } from '~/lib/builds/archetypes';
import { MarketSchema, EMPTY_MARKET, type Market } from '~/lib/schemas/market';
import { DraftSchema } from '~/lib/schemas/draft';
import { pickNumbersForSlot } from '~/lib/sleeper/map';
import { fixtureTeam } from './fixtures/league';

// Deliberately NOT data/market.json — the sync rewrites it. Build a small,
// deterministic market snapshot in-line, same as tests/fixtures/league.ts does
// for the team/players data.

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

function makePlayer(i: number, pos: (typeof POSITIONS)[number], overrides: Partial<Market['players'][number]> = {}) {
  return {
    fpId: `fp-${pos}-${i}`,
    sleeperId: null,
    ktcId: null,
    espnId: null,
    playerId: null,
    name: `${pos} Player ${i}`,
    pos,
    nflTeam: 'ZZZ',
    age: 24,
    draftYear: 2022,
    ecrSf: i,
    ecr1qb: i,
    posEcr: i,
    valueSf: Math.max(1, 9000 - i * 60),
    value1qb: Math.max(1, 3000 - i * 20),
    ...overrides,
  };
}

// 360 players is enough board depth to cover a full 12-team, 30-round snake
// draft (overall picks run up to ~357) without the simulated board running dry.
const players: Market['players'] = [];
let n = 1;
for (let i = 0; i < 360; i += 1) {
  const pos = POSITIONS[i % POSITIONS.length]!;
  players.push(makePlayer(n, pos));
  n += 1;
}

const market: Market = MarketSchema.parse({
  ...EMPTY_MARKET,
  capturedAt: '2026-07-30T00:00:00.000Z',
  scrapeDate: '2026-07-29',
  players,
});

const draft = DraftSchema.parse({
  draftId: 'fixture-draft',
  status: 'pre_draft',
  type: 'snake',
  startTime: '2026-08-14T15:00:00.000Z',
  teams: 12,
  rounds: 30,
  myDraftSlot: 4,
  myPicks: pickNumbersForSlot(4, 12, 30, 'snake'),
  picks: [],
});

const links = { team: '/loop/team', knowledge: '/loop/knowledge' };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildEntries(m: Market = market): BuildEntry[] {
  const fits = scoreArchetypes({ format: fixtureTeam.format, market: m, draft });
  return fits.map((fit) => {
    const archetype = ARCHETYPES.find((a) => a.id === fit.id)!;
    const picks = planPicks({ archetype, market: m, draft, format: fixtureTeam.format });
    return {
      fit,
      title: archetype.name,
      tagline: `Tagline for ${archetype.name}`,
      thesis: `Thesis for ${archetype.name}`,
      worksWhen: ['works when A', 'works when B'],
      failsWhen: ['fails when A', 'fails when B'],
      sources: [
        { label: 'FantasyPros dynasty rankings', url: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php' },
        { label: 'DynastyProcess data', url: 'https://github.com/dynastyprocess/data' },
      ],
      articleHref: '/loop/knowledge/roster-construction/superflex-positional-builds',
      picks,
    };
  });
}

function mount(builds = buildEntries(), m = market) {
  return render(<BuildsApp builds={builds} market={m} links={links} />);
}

describe('BuildsApp — build cards', () => {
  it('renders the build cards, best-first', () => {
    const builds = buildEntries();
    mount(builds);
    const cards = screen.getAllByTestId('build-card');
    expect(cards.length).toBe(builds.length);
    const scores = builds.map((b) => b.fit.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('clicking a build changes the displayed pick sheet and updates aria-pressed', async () => {
    const user = userEvent.setup();
    const builds = buildEntries();
    mount(builds);

    const buttons = screen.getAllByTestId('build-select');
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'true');

    const firstHeading = screen.getByRole('heading', {
      name: new RegExp(`Your picks — ${escapeRegExp(builds[0]!.title)}`),
    });
    expect(firstHeading).toBeInTheDocument();

    await user.click(buttons[1]!);

    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false');
    expect(buttons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { name: new RegExp(`Your picks — ${escapeRegExp(builds[1]!.title)}`) }),
    ).toBeInTheDocument();
  });

  it('all 30 picks are reachable, expanding the collapsed groups', async () => {
    const user = userEvent.setup();
    mount();

    expect(within(screen.getByTestId('picks-early')).getAllByTestId('pick-row')).toHaveLength(8);

    await user.click(screen.getByRole('button', { name: /Rounds 9-18/ }));
    expect(within(screen.getByTestId('picks-mid')).getAllByTestId('pick-row')).toHaveLength(10);

    await user.click(screen.getByRole('button', { name: /Rounds 19-30/ }));
    expect(within(screen.getByTestId('picks-late')).getAllByTestId('pick-row')).toHaveLength(12);
  });

  it('every citation anchor has an href and non-empty accessible text', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('button', { name: /Rounds 9-18/ }));
    await user.click(screen.getByRole('button', { name: /Rounds 19-30/ }));

    const anchors = screen.getAllByRole('link');
    expect(anchors.length).toBeGreaterThan(0);
    for (const a of anchors) {
      expect(a).toHaveAttribute('href');
      expect(a.getAttribute('href')).not.toBe('');
      expect(a.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('renders EmptyState when the market has no players', () => {
    const empty = MarketSchema.parse({ ...EMPTY_MARKET });
    mount([], empty);
    expect(screen.getByText(/npm run sync:market/)).toBeInTheDocument();
  });

  it('uses data-tone instead of any hardcoded color class', () => {
    const { container } = mount();
    expect(container.querySelectorAll('[data-tone]').length).toBeGreaterThan(0);
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-(red|blue|green|amber|rose|violet|teal|orange|pink|slate)-\d/);
    expect(html).not.toMatch(/bg-(red|blue|green|amber|rose|violet|teal|orange|pink|slate)-\d/);
  });
});
