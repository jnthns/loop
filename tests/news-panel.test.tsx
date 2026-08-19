import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsPanel } from '~/components/NewsPanel';
import type { NewsItem } from '~/lib/schemas/news';

const NOW = new Date('2026-09-10T12:00:00.000Z');

function item(overrides: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${overrides.id}`,
    url: `https://example.com/${overrides.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T10:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...overrides,
  };
}

const items: NewsItem[] = [
  item({ id: 'a', publishedAt: '2026-09-08T12:00:00.000Z', title: 'Two days ago' }),
  item({ id: 'b', publishedAt: '2026-09-10T09:00:00.000Z', title: 'Three hours ago' }),
  item({
    id: 'c',
    publishedAt: '2026-09-10T11:30:00.000Z',
    title: 'Half an hour ago',
    players: ['bijan-robinson'],
    tags: ['injury', 'ATL'],
  }),
];

function panel(props: Partial<React.ComponentProps<typeof NewsPanel>> = {}) {
  return render(<NewsPanel items={items} now={NOW} {...props} />);
}

describe('NewsPanel', () => {
  it('renders items newest first', () => {
    panel();
    const rendered = screen.getAllByTestId('news-item');
    expect(rendered).toHaveLength(3);
    expect(rendered[0]).toHaveTextContent('Half an hour ago');
    expect(rendered[2]).toHaveTextContent('Two days ago');
  });

  it('shows compact relative times', () => {
    panel();
    expect(screen.getByText('30m')).toBeInTheDocument();
    expect(screen.getByText('3h')).toBeInTheDocument();
    expect(screen.getByText('2d')).toBeInTheDocument();
  });

  it('flags items mentioning a watched player', () => {
    panel({ watchedPlayerIds: ['bijan-robinson'] });
    const flagged = screen
      .getAllByTestId('news-item')
      .filter((el) => el.dataset.relevant === 'true');
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toHaveTextContent('Half an hour ago');
    expect(screen.getByText(/mention your players/)).toBeInTheDocument();
  });

  it('does not flag anything when nothing is watched', () => {
    panel();
    expect(screen.queryByText(/mention your players/)).not.toBeInTheDocument();
  });

  it('respects the limit', () => {
    panel({ limit: 2 });
    expect(screen.getAllByTestId('news-item')).toHaveLength(2);
  });

  it('explains how to populate an empty feed rather than rendering nothing', () => {
    panel({ items: [] });
    expect(screen.queryAllByTestId('news-item')).toHaveLength(0);
    expect(screen.getByText(/news:fetch/)).toBeInTheDocument();
  });

  it('opens and closes as a drawer on small screens', async () => {
    const user = userEvent.setup();
    panel();
    const aside = screen.getByRole('complementary', { name: 'News' });
    expect(aside.dataset.open).toBe('false');

    await user.click(screen.getByRole('button', { name: /^News/ }));
    expect(aside.dataset.open).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Close news panel' }));
    expect(aside.dataset.open).toBe('false');
  });

  it('collapses the desktop rail and persists the preference', async () => {
    const user = userEvent.setup();
    localStorage.clear();
    panel();
    const aside = screen.getByRole('complementary', { name: 'News' });
    expect(aside.dataset.collapsed).toBe('false');

    await user.click(screen.getByRole('button', { name: 'Collapse' }));
    expect(aside.dataset.collapsed).toBe('true');
    expect(localStorage.getItem('dynasty-guide:news-rail')).toBe('collapsed');

    await user.click(screen.getByRole('button', { name: 'Expand news panel' }));
    expect(aside.dataset.collapsed).toBe('false');
    expect(localStorage.getItem('dynasty-guide:news-rail')).toBe('expanded');
  });

  it('filters by source when the filter panel is open', async () => {
    const user = userEvent.setup();
    const mixed = [
      item({ id: 'a', title: 'ESPN story' }),
      item({ id: 'b', title: 'Reddit thread', source: 'r/DynastyFF', sourceId: 'reddit-dynastyff' }),
    ];
    render(<NewsPanel items={mixed} now={NOW} />);
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.selectOptions(screen.getByLabelText('Source'), 'r/DynastyFF');
    expect(screen.getAllByTestId('news-item')).toHaveLength(1);
    expect(screen.getByText('Reddit thread')).toBeInTheDocument();
  });

  it('searches title and summary text', async () => {
    const user = userEvent.setup();
    const searchable = [
      item({ id: 'a', title: 'Quiet day', summary: 'nothing actionable' }),
      item({ id: 'b', title: 'Busy day', summary: 'hamstring tweak' }),
    ];
    render(<NewsPanel items={searchable} now={NOW} />);
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.type(screen.getByLabelText('Search'), 'hamstring');
    expect(screen.getAllByTestId('news-item')).toHaveLength(1);
    expect(screen.getByText('Busy day')).toBeInTheDocument();
  });

  it('sorts oldest first', async () => {
    const user = userEvent.setup();
    const dated = [
      item({ id: 'new', publishedAt: '2026-09-10T12:00:00.000Z', title: 'Newer' }),
      item({ id: 'old', publishedAt: '2026-09-08T10:00:00.000Z', title: 'Older' }),
    ];
    render(<NewsPanel items={dated} now={NOW} limit={10} />);
    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.selectOptions(screen.getByLabelText('Sort'), 'Oldest first');
    const rows = screen.getAllByTestId('news-item');
    expect(rows[0]).toHaveTextContent('Older');
    expect(rows[1]).toHaveTextContent('Newer');
  });

  it('collapses duplicate headlines with no player attached', () => {
    const dupes = [
      item({ id: 'one', title: 'Same headline', publishedAt: '2026-09-10T12:00:00.000Z' }),
      item({ id: 'two', title: 'Same headline.', publishedAt: '2026-09-09T10:00:00.000Z' }),
      item({ id: 'three', title: 'Different story' }),
    ];
    render(<NewsPanel items={dupes} now={NOW} limit={10} />);
    expect(screen.getAllByTestId('news-item')).toHaveLength(2);
  });

  it('shows one story per player by default, whatever the headlines say', () => {
    const syndicated = [
      item({
        id: 'espn',
        title: 'Bijan Robinson dominates',
        players: ['bijan-robinson'],
        publishedAt: '2026-09-10T11:00:00.000Z',
      }),
      item({
        id: 'yahoo',
        title: 'Falcons back runs wild in Atlanta',
        players: ['bijan-robinson'],
        publishedAt: '2026-09-10T10:00:00.000Z',
      }),
      item({ id: 'other', title: 'Someone else entirely', players: ['puka-nacua'] }),
    ];
    render(<NewsPanel items={syndicated} now={NOW} limit={10} />);
    const rows = screen.getAllByTestId('news-item');
    expect(rows).toHaveLength(2);
    // The newest copy is the one kept.
    expect(screen.getByText('Bijan Robinson dominates')).toBeInTheDocument();
    expect(screen.queryByText('Falcons back runs wild in Atlanta')).not.toBeInTheDocument();
  });

  it('gives every source back when the reader unticks it', async () => {
    const user = userEvent.setup();
    const syndicated = [
      item({
        id: 'espn',
        title: 'First take',
        players: ['bijan-robinson'],
        publishedAt: '2026-09-10T11:00:00.000Z',
      }),
      item({
        id: 'yahoo',
        title: 'Second take',
        players: ['bijan-robinson'],
        publishedAt: '2026-09-10T10:00:00.000Z',
      }),
    ];
    render(<NewsPanel items={syndicated} now={NOW} limit={10} />);
    expect(screen.getAllByTestId('news-item')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    await user.click(screen.getByLabelText('One story per player'));
    expect(screen.getAllByTestId('news-item')).toHaveLength(2);
  });
});
