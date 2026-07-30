import type { HealthStatus, PlayerPick, Verdict } from '../../lib/nfl/types';
import type { Tone } from '~/lib/ui/tone';
import { Chip, PosTag } from '~/components/ui/Primitives';

const VERDICT_TONE: Record<Verdict, Tone> = {
  'STRONG PICK': 'green',
  PICK: 'teal',
  HOLD: 'amber',
  AVOID: 'rose',
};

const HEALTH_TONE: Record<HealthStatus, Tone> = {
  ACTIVE: 'green',
  QUESTIONABLE: 'amber',
  DOUBTFUL: 'orange',
  OUT: 'rose',
  IR: 'rose',
  UNKNOWN: 'slate',
};

interface PlayerTileProps {
  player: PlayerPick;
  selected: boolean;
  recommended: boolean;
  onSelect: (id: string) => void;
}

export function PlayerTile({ player, selected, recommended, onSelect }: PlayerTileProps) {
  const verdictTone = VERDICT_TONE[player.verdict];
  const healthTone = HEALTH_TONE[player.health];

  return (
    <button
      type="button"
      onClick={() => onSelect(player.id)}
      aria-pressed={selected}
      data-pos={player.position}
      data-testid="player-tile"
      className={[
        'flex w-40 shrink-0 snap-start flex-col overflow-hidden rounded-[0.5rem] border bg-surface text-left transition-colors',
        selected ? 'border-tone border-2 shadow-lift' : 'border-line hover:border-tone-line',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-1 border-b border-line px-2 py-1.5">
        <PosTag pos={player.position} />
        <Chip tone={healthTone} className="uppercase">
          {player.health}
        </Chip>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="text-sm font-bold leading-tight">{player.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-muted">
          {player.depthOrder === 1 ? 'Starter' : `Depth ${player.depthOrder ?? '-'}`}
          {player.age !== null ? ` · ${player.age}y` : ''}
        </span>
        {player.trendingAdds !== null && player.trendingAdds >= 500 && (
          <span data-tone="orange" className="text-[10px] font-bold text-tone">
            ▲ {player.trendingAdds.toLocaleString()} adds / 48h
          </span>
        )}
      </div>
      <div
        data-tone={verdictTone}
        className="border-t border-tone-line bg-tone-soft px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-tone"
      >
        {player.verdict}
        {recommended ? ' ★' : ''}
      </div>
    </button>
  );
}
