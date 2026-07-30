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
  return render(<NewsPanel items={items} archiveHref="/loop/news" now={NOW} {...props} />);
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

  it('links to the full archive', () => {
    panel();
    expect(screen.getByRole('link', { name: 'All news' })).toHaveAttribute('href', '/loop/news');
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
});
