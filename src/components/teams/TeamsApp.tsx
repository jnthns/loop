import { useCallback, useEffect, useState } from 'react';
import { getTeamBoard } from '../../lib/nfl/board';
import type { TeamBoard } from '../../lib/nfl/types';
import { SectionHead } from '~/components/ui/Primitives';
import { TeamRow } from './TeamRow';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; board: TeamBoard };

function TeamSection({
  title,
  subtitle,
  tone,
  teams,
}: {
  title: string;
  subtitle: string;
  tone: 'green' | 'rose';
  teams: TeamBoard['winning'];
}) {
  const id = title.toLowerCase().replace(/[^a-z]+/g, '-');
  return (
    <section aria-label={title} data-tone={tone}>
      <SectionHead id={id} title={title} note={subtitle} count={teams.length} tone={tone} />
      <div className="space-y-1">
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
      <div
        data-tone="orange"
        className="rounded-[0.5rem] border border-tone-line bg-tone-soft px-6 py-8 text-center text-sm font-bold uppercase tracking-wide text-tone"
      >
        Loading team board…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div
        data-tone="rose"
        className="rounded-[0.5rem] border border-tone-line bg-tone-soft px-6 py-8 text-center"
      >
        <p className="mb-4 text-sm font-bold uppercase text-tone">{state.message}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-[0.5rem] border border-tone-line bg-surface px-4 py-2 text-sm font-bold uppercase text-tone hover:bg-tone-soft"
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
    <div className="flex flex-col gap-10">
      {!board.meta.live && (
        <div
          data-tone="amber"
          className="rounded-[0.5rem] border border-tone-line bg-tone-soft px-4 py-2 text-xs font-bold uppercase tracking-wide text-tone"
        >
          Live data unavailable — showing sample board. Recommendations refresh automatically when
          ESPN/Sleeper respond.
        </div>
      )}

      <TeamSection
        title="Winning / High-Promise"
        subtitle="Invest: winning records keep scoring volume and game script on your side"
        tone="green"
        teams={board.winning}
      />
      <TeamSection
        title="Losing / Low-Value"
        subtitle="Fade: talent over situation only — losing teams cap weekly floors"
        tone="rose"
        teams={board.losing}
      />

      <footer className="text-[10px] uppercase tracking-wide text-muted">
        Season {board.meta.season} · Generated {new Date(board.meta.generatedAt).toLocaleString()} ·{' '}
        {board.meta.live
          ? `Sources: ${activeSources.join(', ') || 'none'}`
          : 'Sample data (ESPN/Sleeper unreachable)'}
      </footer>
    </div>
  );
}
