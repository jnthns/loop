import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewsArchive } from '~/components/NewsArchive';
import type { NewsItem } from '~/lib/schemas/news';

function item(o: Partial<NewsItem> & Pick<NewsItem, 'id'>): NewsItem {
  return {
    title: `Story ${o.id}`,
    url: `https://example.com/${o.id}`,
    source: 'ESPN NFL',
    sourceId: 'espn-nfl',
    publishedAt: '2026-09-10T10:00:00.000Z',
    summary: '',
    tags: [],
    players: [],
    teams: [],
    ...o,
  };
}

const items: NewsItem[] = [
  item({ id: 'a', tags: ['injury'], teams: ['ATL'], players: ['bijan-robinson'] }),
  item({ id: 'b', source: 'r/DynastyFF', sourceId: 'reddit-dynastyff', tags: ['trade'] }),
  item({ id: 'c', tags: ['injury'], teams: ['CIN'] }),
];

const count = () => screen.getAllByTestId('archive-item');

describe('NewsArchive', () => {
  it('lists every item by default', () => {
    render(<NewsArchive items={items} />);
    expect(count()).toHaveLength(3);
    expect(screen.getByTestId('result-count')).toHaveTextContent('3 of 3');
  });

  it('filters by source', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} />);
    await user.selectOptions(screen.getByLabelText('Source'), 'r/DynastyFF');
    expect(count()).toHaveLength(1);
    expect(screen.getByText('Story b')).toBeInTheDocument();
  });

  it('filters by tag', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} />);
    await user.selectOptions(screen.getByLabelText('Tag'), 'injury');
    expect(count()).toHaveLength(2);
  });

  it('filters by team', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} />);
    await user.selectOptions(screen.getByLabelText('Team'), 'ATL');
    expect(count()).toHaveLength(1);
  });

  it('narrows to the manager’s own players', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} watchedPlayerIds={['bijan-robinson']} />);
    await user.click(screen.getByLabelText('My players only'));
    expect(count()).toHaveLength(1);
    expect(screen.getByText('your player')).toBeInTheDocument();
  });

  it('combines filters', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} />);
    await user.selectOptions(screen.getByLabelText('Tag'), 'injury');
    await user.selectOptions(screen.getByLabelText('Team'), 'CIN');
    expect(count()).toHaveLength(1);
    expect(screen.getByText('Story c')).toBeInTheDocument();
  });

  it('says so when filters exclude everything, and resets', async () => {
    const user = userEvent.setup();
    render(<NewsArchive items={items} />);
    await user.selectOptions(screen.getByLabelText('Tag'), 'trade');
    await user.selectOptions(screen.getByLabelText('Team'), 'ATL');
    expect(screen.queryAllByTestId('archive-item')).toHaveLength(0);
    expect(screen.getByText(/No items match/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(count()).toHaveLength(3);
  });

  it('distinguishes an empty archive from an over-filtered one', () => {
    render(<NewsArchive items={[]} />);
    expect(screen.getByText(/No news on file yet/)).toBeInTheDocument();
  });

  it('counts occurrences in the filter options', () => {
    render(<NewsArchive items={items} />);
    expect(screen.getByRole('option', { name: 'injury (2)' })).toBeInTheDocument();
  });

  it('searches title and summary text', async () => {
    const user = userEvent.setup();
    const searchable = [
      ...items,
      item({ id: 'd', title: 'Quiet day', summary: 'nothing actionable' }),
    ];
    render(<NewsArchive items={searchable} />);
    await user.type(screen.getByLabelText('Search'), 'actionable');
    expect(count()).toHaveLength(1);
    expect(screen.getByText('Quiet day')).toBeInTheDocument();
  });

  it('sorts oldest first', async () => {
    const user = userEvent.setup();
    const dated = [
      item({ id: 'new', publishedAt: '2026-09-10T12:00:00.000Z' }),
      item({ id: 'old', publishedAt: '2026-09-08T10:00:00.000Z' }),
    ];
    render(<NewsArchive items={dated} />);
    await user.selectOptions(screen.getByLabelText('Sort'), 'Oldest first');
    const rows = count();
    expect(rows[0]).toHaveTextContent('Story old');
    expect(rows[1]).toHaveTextContent('Story new');
  });

  it('hides duplicate titles when toggled', async () => {
    const user = userEvent.setup();
    const dupes = [
      item({ id: 'one', title: 'Same headline', publishedAt: '2026-09-10T12:00:00.000Z' }),
      item({ id: 'two', title: 'Same headline.', publishedAt: '2026-09-09T10:00:00.000Z' }),
      item({ id: 'three', title: 'Different story' }),
    ];
    render(<NewsArchive items={dupes} />);
    expect(count()).toHaveLength(3);
    await user.click(screen.getByLabelText('Hide duplicate titles'));
    expect(count()).toHaveLength(2);
    expect(screen.getByText('Same headline')).toBeInTheDocument();
    expect(screen.queryByText('Same headline.')).not.toBeInTheDocument();
  });
});
