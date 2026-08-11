import { useMemo, useState } from 'react';
import type { BoardEntry, BoardPos, PositionBoards } from '~/lib/picks/board';
import { Chip, DepthTag, EmptyState, PosTag, SectionHead, StatusTag } from '~/components/ui/Primitives';
import type { Tone } from '~/lib/ui/tone';

/**
 * The position-picks sheet: one list per position, most popular first.
 *
 * Built for two moments, which is why each position carries two lists:
 *   - **draft day** — your target is gone, you have 90 seconds, and you need
 *     the next name at that position that the room agrees on;
 *   - **waiver Tuesday** — who is everyone else adding at this position.
 *
 * The whole page is one filter set applied to every position at once, so
 * hiding taken players during a draft takes one click, not four.
 */

export type ListMode = 'board' | 'trending';

export interface PicksAppProps {
  data: PositionBoards;
  /** Base-path-aware links, resolved by the Astro page (see `src/lib/url.ts`). */
  links: { team: string; builds: string };
}

const POS_TONE: Record<BoardPos, Tone> = {
  QB: 'rose',
  RB: 'green',
  WR: 'blue',
  TE: 'amber',
};

const AVAILABILITY_LABEL: Record<BoardEntry['availability'], string> = {
  available: 'FREE',
  drafted: 'DRAFTED',
  rostered: 'ROSTERED',
};

const AVAILABILITY_TONE: Record<BoardEntry['availability'], Tone> = {
  available: 'green',
  drafted: 'slate',
  rostered: 'slate',
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function PicksApp({ data, links }: PicksAppProps) {
  const [mode, setMode] = useState<ListMode>('board');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [query, setQuery] = useState('');

  const needle = query.trim().toLowerCase();

  const lists = useMemo(
    () =>
      data.boards.map((board) => {
        const rows = mode === 'board' ? board.board : board.trending;
        const visible = rows.filter((row) => {
          if (onlyAvailable && row.availability !== 'available') return false;
          if (!needle) return true;
          return (
            row.name.toLowerCase().includes(needle) ||
            row.nflTeam.toLowerCase().includes(needle)
          );
        });
        return { pos: board.pos, total: rows.length, rows: visible };
      }),
    [data.boards, mode, onlyAvailable, needle],
  );

  const empty = data.boards.every((b) => b.board.length === 0 && b.trending.length === 0);
  if (empty) {
    return (
      <EmptyState>
        No board data yet. Run <code className="font-mono">npm run sync:market</code> and{' '}
        <code className="font-mono">npm run sync:sleeper</code> to pull consensus ranks and
        trending adds.
      </EmptyState>
    );
  }

  const sourceNote =
    mode === 'board'
      ? `Expert consensus rank, captured ${formatWhen(data.marketCapturedAt)}. Lower is more popular.`
      : `Sleeper adds across every league in the last ${data.trendingLookbackHours}h, captured ${formatWhen(
          data.trendingCapturedAt,
        )}.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3" data-testid="picks-controls">
        <div role="group" aria-label="List" className="flex gap-1">
          {(
            [
              ['board', 'Draft board'],
              ['trending', 'Waiver trending'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              data-testid={`mode-${value}`}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={`chip ${mode === value ? 'chip-tone' : ''}`}
              data-tone={mode === value ? 'violet' : undefined}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-[12.5px]">
          <input
            type="checkbox"
            data-testid="only-available"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Hide players already taken
        </label>

        <label className="ml-auto flex items-center gap-1.5 text-[12.5px]">
          <span className="label">Filter</span>
          <input
            type="search"
            data-testid="picks-filter"
            value={query}
            placeholder="name or NFL team"
            onChange={(e) => setQuery(e.target.value)}
            className="rounded-[0.375rem] border border-line bg-surface px-2 py-1"
          />
        </label>
      </div>

      <p className="text-[12px] text-muted" data-testid="picks-source-note">
        {sourceNote}
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        {lists.map((list) => (
          <section key={list.pos} aria-labelledby={`picks-${list.pos}`} data-testid="position-list" data-pos={list.pos}>
            <SectionHead
              id={`picks-${list.pos}`}
              tone={POS_TONE[list.pos]}
              title={list.pos}
              count={list.rows.length}
              note={
                mode === 'board'
                  ? 'Consensus order — the next name off the board at this position.'
                  : 'Most-added at this position across Sleeper.'
              }
            />
            {list.rows.length === 0 ? (
              <EmptyState>
                {list.total === 0
                  ? 'No rows for this position in the current snapshot.'
                  : 'Every row is filtered out. Clear the filter or show taken players.'}
              </EmptyState>
            ) : (
              <ol className="rows divide-y divide-line">
                {list.rows.map((row) => (
                  <PickRow key={row.key} row={row} mode={mode} />
                ))}
              </ol>
            )}
          </section>
        ))}
      </div>

      <div className="space-y-1 text-[12px] text-muted">
        <p>
          Roster and budgets live on{' '}
          <a href={links.team} className="section-link">
            the team page
          </a>
          ; a full round-by-round sheet lives on{' '}
          <a href={links.builds} className="section-link">
            builds
          </a>
          .
        </p>
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]" data-testid="picks-sources">
          {data.sources.map((source) => (
            <li key={source.url}>
              <a
                href={source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-tone underline decoration-tone-line hover:decoration-tone"
              >
                {source.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PickRow({ row, mode }: { row: BoardEntry; mode: ListMode }) {
  const taken = row.availability !== 'available';
  return (
    <li
      data-testid="pick-row"
      data-pos={row.pos}
      data-availability={row.availability}
      className={`flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-1.5 text-[13px] ${
        taken ? 'opacity-60' : ''
      }`}
    >
      <span className="w-6 shrink-0 text-[11px] text-muted" data-numeric>
        {row.rank}
      </span>
      <PosTag pos={row.pos} />
      <span className={`font-bold ${taken ? 'line-through decoration-line' : ''}`}>{row.name}</span>
      <span className="text-[11px] text-muted">
        {row.nflTeam}
        {row.age !== null ? ` · ${Math.round(row.age)}y` : ''}
      </span>
      <DepthTag rank={row.depthRank ?? undefined} />
      <StatusTag status={row.status} injuryStatus={row.injuryStatus} />
      <span className="ml-auto flex items-center gap-2 text-[11px] text-muted" data-numeric>
        {mode === 'trending' ? (
          <>
            <span title="Sleeper adds in the lookback window">+{row.adds?.toLocaleString() ?? '—'}</span>
            <span title="Expert consensus rank">ecr {row.ecr ?? '—'}</span>
          </>
        ) : (
          <>
            <span title="Expert consensus rank">ecr {row.ecr ?? '—'}</span>
            {row.adds !== null && (
              <span title="Sleeper adds in the lookback window">+{row.adds.toLocaleString()}</span>
            )}
          </>
        )}
        <Chip tone={AVAILABILITY_TONE[row.availability]}>{AVAILABILITY_LABEL[row.availability]}</Chip>
      </span>
    </li>
  );
}

export default PicksApp;
