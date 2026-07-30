import type { PlayerPick, TeamNewsItem } from '../../lib/nfl/types';

const VERDICT_CLASS: Record<PlayerPick['verdict'], string> = {
  'STRONG PICK': 'bg-brutal-black text-brutal-accent',
  PICK: 'bg-brutal-accent text-brutal-black',
  HOLD: 'bg-brutal-white text-brutal-black',
  AVOID: 'bg-brutal-white text-brutal-black opacity-60',
};

interface PlayerProfilePanelProps {
  player: PlayerPick;
  teamNews: TeamNewsItem[];
  recommended: boolean;
}

export function PlayerProfilePanel({ player, teamNews, recommended }: PlayerProfilePanelProps) {
  return (
    <div className="border-brutal border-brutal-black bg-brutal-white">
      <div className="flex flex-wrap items-center gap-2 border-b-brutal border-brutal-black bg-brutal-black px-3 py-2 text-brutal-white">
        <span className="text-sm font-bold">
          {player.name} · {player.position}
        </span>
        <span
          className={`border border-brutal-black px-2 py-0.5 text-[10px] font-bold ${VERDICT_CLASS[player.verdict]}`}
        >
          {player.verdict}
        </span>
        {recommended && (
          <span className="border border-brutal-accent px-2 py-0.5 text-[10px] font-bold text-brutal-accent">
            ★ TOP RECOMMENDATION
          </span>
        )}
        <span className="ml-auto text-[10px] uppercase tracking-wide">
          Score {player.score}/100 · {player.health}
          {player.trendingAdds !== null && player.trendingAdds >= 500
            ? ` · ▲ ${player.trendingAdds.toLocaleString()} adds`
            : ''}
        </span>
      </div>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="border-b-brutal border-brutal-black p-3 md:border-b-0 md:border-r-brutal">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest">
            Why the pick
          </h4>
          <p className="text-xs leading-relaxed">{player.whyPick}</p>
        </div>
        <div className="p-3">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest">
            Team build fit
          </h4>
          <p className="text-xs leading-relaxed">{player.buildFit}</p>
        </div>
      </div>
      {teamNews.length > 0 && (
        <div className="border-t-brutal border-brutal-black p-3">
          <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest">
            Latest team news
          </h4>
          <ul className="list-none space-y-1">
            {teamNews.map((item) => (
              <li key={item.headline} className="text-xs">
                ▪{' '}
                {item.link ? (
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
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
