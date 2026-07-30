import { useState } from 'react';
import type { CoachProfile } from '../../lib/nfl/types';

interface CoachTileProps {
  coach: CoachProfile;
}

export function CoachTile({ coach }: CoachTileProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="sticky left-0 z-10 w-44 shrink-0 snap-start border-brutal border-brutal-black bg-brutal-black text-brutal-white">
      <div className="border-b border-brutal-white px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-brutal-accent">
        {coach.title}
      </div>
      <div className="flex flex-col gap-1 p-2">
        <span className="text-sm font-bold leading-tight">{coach.name}</span>
        <span className="inline-block w-fit border border-brutal-accent px-1 text-[10px] font-bold uppercase text-brutal-accent">
          {coach.styleTag}
        </span>
        {expanded && (
          <p className="mt-1 text-[11px] leading-snug">{coach.offense}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full border-t border-brutal-white px-2 py-1 text-left text-[10px] font-bold uppercase tracking-wide text-brutal-accent"
      >
        {expanded ? '− Hide scheme' : '+ Offensive scheme'}
      </button>
    </div>
  );
}
