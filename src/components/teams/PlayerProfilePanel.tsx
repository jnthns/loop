import type { PlayerPick, TeamNewsItem, Verdict } from '../../lib/nfl/types';
import type { Tone } from '~/lib/ui/tone';
import { Chip, PosTag } from '~/components/ui/Primitives';

const VERDICT_TONE: Record<Verdict, Tone> = {
  'STRONG PICK': 'green',
  PICK: 'teal',
  HOLD: 'amber',
  AVOID: 'rose',
};

interface PlayerProfilePanelProps {
  player: PlayerPick;
  teamNews: TeamNewsItem[];
  recommended: boolean;
}

export function PlayerProfilePanel({ player, teamNews, recommended }: PlayerProfilePanelProps) {
  const verdictTone = VERDICT_TONE[player.verdict];

  return (
    <div data-pos={player.position} className="overflow-hidden rounded-[0.5rem] border border-line bg-surface">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-tone-soft/60 px-3 py-2">
        <span className="text-sm font-bold">{player.name}</span>
        <PosTag pos={player.position} />
        <Chip tone={verdictTone} className="uppercase">
          {player.verdict}
        </Chip>
        {recommended && (
          <Chip tone="green" className="uppercase">
            ★ Top recommendation
          </Chip>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted" data-numeric>
          Score {player.score}/100 · {player.health}
          {player.trendingAdds !== null && player.trendingAdds >= 500
            ? ` · ▲ ${player.trendingAdds.toLocaleString()} adds`
            : ''}
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b border-line p-3 md:border-r md:border-b-0">
          <h4 className="label mb-1">Why the pick</h4>
          <p className="text-xs leading-relaxed text-ink-soft">{player.whyPick}</p>
        </div>
        <div className="p-3">
          <h4 className="label mb-1">Team build fit</h4>
          <p className="text-xs leading-relaxed text-ink-soft">{player.buildFit}</p>
        </div>
      </div>
      {teamNews.length > 0 && (
        <div className="border-t border-line p-3">
          <h4 className="label mb-1">Latest team news</h4>
          <ul className="list-none space-y-1">
            {teamNews.map((item) => (
              <li key={item.headline} className="text-xs text-ink-soft">
                <span className="text-tone" aria-hidden="true">
                  ▪{' '}
                </span>
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-tone-line underline-offset-2 hover:text-tone"
                  >
                    {item.headline}
                  </a>
                ) : (
                  item.headline
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
