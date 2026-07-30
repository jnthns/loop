import { useCallback, useEffect, useState } from 'react';
import { getTeamBoard } from '../../lib/nfl/board';
import type { TeamBoard } from '../../lib/nfl/types';
import { TeamRow } from './TeamRow';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; board: TeamBoard };

function TeamSection({
  title,
  subtitle,
  accent,
  teams,
}: {
  title: string;
  subtitle: string;
  accent: boolean;
  teams: TeamBoard['winning'];
}) {
  return (
    <section aria-label={title}>
      <div
        className={`flex flex-wrap items-baseline gap-3 border-brutal-heavy border-brutal-black px-4 py-3 ${
          accent ? 'bg-brutal-accent text-brutal-black' : 'bg-brutal-black text-brutal-white'
        }`}
      >
        <h2 className="text-xl font-bold uppercase">{title}</h2>
        <span className="text-xs">{subtitle}</span>
        <span className="ml-auto text-xs font-bold">{teams.length} teams</span>
      </div>
      <div className="border-x-brutal-heavy border-b-brutal-heavy border-brutal-black p-2">
        {teams.map((team, i) => (
          <TeamRow key={team.abbrev} team={team} index={i} />
        ))}
      </div>
    </section>
  );
}

export function TeamsApp() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const board = await getTeamBoard();
      setState({ status: 'ready', board });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load board',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === 'loading') {
    return (
      <div className="border-brutal-heavy border-brutal-black bg-brutal-accent p-8 text-center text-xl font-bold uppercase">
        Loading team board…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="border-brutal-heavy border-brutal-black bg-brutal-white p-8 text-center">
        <p className="mb-4 text-sm font-bold uppercase">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="border-brutal border-brutal-black bg-brutal-black px-4 py-2 text-sm font-bold uppercase text-brutal-accent"
        >
          Retry
        </button>
      </div>
    );
  }

  const { board } = state;
  const activeSources = Object.entries(board.meta.sources)
    .filter(([, ok]) => ok)
    .map(([name]) => name);

  return (
    <div className="flex flex-col gap-8">
      {!board.meta.live && (
        <div className="border-brutal border-brutal-black bg-brutal-accent px-4 py-2 text-xs font-bold uppercase">
          Live data unavailable — showing sample board. Recommendations refresh automatically when ESPN/Sleeper respond.
        </div>
      )}

      <TeamSection
        title="Winning / High-Promise"
        subtitle="Invest: winning records keep scoring volume and game script on your side"
        accent
        teams={board.winning}
      />
      <TeamSection
        title="Losing / Low-Value"
        subtitle="Fade: talent over situation only — losing teams cap weekly floors"
        accent={false}
        teams={board.losing}
      />

      <footer className="text-[10px] uppercase tracking-wide">
        Season {board.meta.season} · Generated {new Date(board.meta.generatedAt).toLocaleString()} ·{' '}
        {board.meta.live
          ? `Sources: ${activeSources.join(', ') || 'none'}`
          : 'Sample data (ESPN/Sleeper unreachable)'}
      </footer>
    </div>
  );
}
