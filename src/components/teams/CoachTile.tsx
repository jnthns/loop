import { useState } from 'react';
import type { CoachProfile } from '../../lib/nfl/types';
import { Chip } from '~/components/ui/Primitives';

interface CoachTileProps {
  coach: CoachProfile;
}

export function CoachTile({ coach }: CoachTileProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      data-tone="slate"
      data-testid="coach-tile"
      className="flex w-44 shrink-0 snap-start flex-col overflow-hidden rounded-[0.5rem] border border-line bg-surface"
    >
      <div className="border-b border-line bg-tone-soft px-2 py-1.5">
        <span className="label text-tone">{coach.title}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <span className="text-sm font-bold leading-tight">{coach.name}</span>
        <Chip tone="orange" className="w-fit uppercase tracking-wide">
          {coach.styleTag}
        </Chip>
        {expanded && (
          <p className="mt-0.5 text-[11px] leading-snug text-ink-soft">{coach.offense}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="border-t border-line px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-tone hover:bg-tone-soft"
      >
        {expanded ? '− Hide scheme' : '+ Offensive scheme'}
      </button>
    </div>
  );
}
