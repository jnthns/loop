import type { PlayerPick } from '../../lib/nfl/types';

const VERDICT_CLASS: Record<PlayerPick['verdict'], string> = {
  'STRONG PICK': 'bg-brutal-black text-brutal-accent',
  PICK: 'bg-brutal-accent text-brutal-black',
  HOLD: 'bg-brutal-white text-brutal-black',
  AVOID: 'bg-brutal-white text-brutal-black opacity-60',
};

const HEALTH_CLASS: Record<PlayerPick['health'], string> = {
  ACTIVE: 'bg-brutal-accent text-brutal-black',
  QUESTIONABLE: 'bg-brutal-black text-brutal-white',
  DOUBTFUL: 'bg-brutal-black text-brutal-white',
  OUT: 'bg-brutal-black text-brutal-white',
  IR: 'bg-brutal-black text-brutal-white',
  UNKNOWN: 'bg-brutal-white text-brutal-black',
};

interface PlayerTileProps {
  player: PlayerPick;
  selected: boolean;
  recommended: boolean;
  onSelect: (id: string) => void;
}

export function PlayerTile({ player, selected, recommended, onSelect }: PlayerTileProps) {
  const outline = selected
    ? 'outline outline-4 outline-brutal-accent'
    : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(player.id)}
      aria-pressed={selected}
      className={`flex w-40 shrink-0 snap-start flex-col border-brutal border-brutal-black bg-brutal-white text-left ${outline}`}
    >
      <div className="flex items-center justify-between border-b-brutal border-brutal-black px-2 py-1">
        <span className="text-xs font-bold">{player.position}</span>
        <span
          className={`border border-brutal-black px-1 text-[10px] font-bold ${HEALTH_CLASS[player.health]}`}
        >
          {player.health}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-2">
        <span className="text-sm font-bold leading-tight">{player.name}</span>
        <span className="text-[10px] uppercase tracking-wide">
          {player.depthOrder === 1 ? 'Starter' : `Depth ${player.depthOrder ?? '-'}`}
          {player.age !== null ? ` · ${player.age}y` : ''}
        </span>
        {player.trendingAdds !== null && player.trendingAdds >= 500 && (
          <span className="text-[10px] font-bold">
            ▲ {player.trendingAdds.toLocaleString()} adds / 48h
          </span>
        )}
      </div>
      <div
        className={`border-t-brutal border-brutal-black px-2 py-1 text-[10px] font-bold ${VERDICT_CLASS[player.verdict]}`}
      >
        {player.verdict}
        {recommended ? ' ★' : ''}
      </div>
    </button>
  );
}
