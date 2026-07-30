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

  return (
    <section aria-label={`${team.displayName} picks`} style={{ animationDelay: `${Math.min(index * 60, 600)}ms` }}>
      <header className="flex flex-wrap items-center gap-2 border-brutal border-brutal-black bg-brutal-black px-3 py-2 text-brutal-white">
        {team.logo && (
          <img src={team.logo} alt="" className="h-6 w-6 bg-brutal-white p-0.5" loading="lazy" />
        )}
        <h3 className="text-sm font-bold">{team.displayName}</h3>
        <span className="text-xs font-bold text-brutal-accent">{record}</span>
        {team.streak && <span className="text-[10px] uppercase">({team.streak})</span>}
        <span className="ml-auto text-[10px] uppercase tracking-wide">
          PF {team.pointsFor} · PA {team.pointsAgainst} · Diff {diff >= 0 ? '+' : ''}{diff}
        </span>
      </header>

      <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto border-x-brutal border-brutal-black bg-brutal-white p-2">
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
          <p className="p-3 text-xs">No offensive picks available for this team.</p>
        )}
      </div>

      {selected && (
        <PlayerProfilePanel
          player={selected}
          teamNews={team.news}
          recommended={selected.id === team.recommendedId}
        />
      )}
      <div className="h-4" />
    </section>
  );
}
