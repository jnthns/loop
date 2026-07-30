import { useState } from 'react';
import type { TeamEntry } from '../../lib/nfl/types';
import { CoachTile } from './CoachTile';
import { PlayerTile } from './PlayerTile';
import { PlayerProfilePanel } from './PlayerProfilePanel';

interface TeamRowProps {
  team: TeamEntry;
  index: number;
}

export function TeamRow({ team, index }: TeamRowProps) {
  const [selectedId, setSelectedId] = useState<string | null>(team.recommendedId);

  const selected = team.picks.find((p) => p.id === selectedId) ?? team.picks[0] ?? null;
  const record = `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}`;
  const diff = team.pointsFor - team.pointsAgainst;
  const groupTone = team.group === 'winning' ? 'green' : 'rose';

  return (
    <section
      aria-label={`${team.displayName} picks`}
      data-tone={groupTone}
      style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}
    >
      <header className="flex flex-wrap items-center gap-2 rounded-t-[0.5rem] border border-b-0 border-line bg-surface-alt px-3 py-2">
        {team.logo && (
          <img
            src={team.logo}
            alt=""
            className="h-6 w-6 rounded-[0.25rem] bg-surface p-0.5"
            loading="lazy"
          />
        )}
        <h3 className="text-sm font-bold">{team.displayName}</h3>
        <span className="text-xs font-bold text-tone" data-numeric>
          {record}
        </span>
        {team.streak && (
          <span className="text-[10px] uppercase text-muted">({team.streak})</span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted" data-numeric>
          PF {team.pointsFor} · PA {team.pointsAgainst} · Diff {diff >= 0 ? '+' : ''}
          {diff}
        </span>
      </header>

      {/* Fixed widths + shrink-0 on tiles; no sticky children so slides never stack. */}
      <div className="flex min-w-0 snap-x snap-mandatory gap-2 overflow-x-auto border border-line bg-bg p-2">
        <CoachTile coach={team.coach} />
        {team.picks.map((player) => (
          <PlayerTile
            key={player.id}
            player={player}
            selected={player.id === selected?.id}
            recommended={player.id === team.recommendedId}
            onSelect={setSelectedId}
          />
        ))}
        {team.picks.length === 0 && (
          <p className="p-3 text-xs text-muted">No offensive picks available for this team.</p>
        )}
      </div>

      {selected && (
        <div className="rounded-b-[0.5rem] border border-t-0 border-line p-2">
          <PlayerProfilePanel
            player={selected}
            teamNews={team.news}
            recommended={selected.id === team.recommendedId}
          />
        </div>
      )}
      <div className="h-4" />
    </section>
  );
}
