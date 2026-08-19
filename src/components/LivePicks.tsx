import { useEffect, useMemo, useState } from 'react';
import type { Market } from '~/lib/schemas/market';
import type { Player } from '~/lib/schemas/players';
import type { Profile } from '~/lib/schemas/profiles';
import type { Draft } from '~/lib/schemas/draft';
import type { Team } from '~/lib/schemas/team';
import type { Trending } from '~/lib/schemas/trending';
import type { SleeperConfig } from '~/lib/schemas/sleeper';
import { buildPositionBoards } from '~/lib/picks/board';
import { buildPickRecommendations } from '~/lib/picks/recommend';
import {
  SLEEPER_REFRESH_EVENT,
  loadLiveSnapshot,
  mergePlayerPatches,
} from '~/lib/team/live-storage';
import PicksApp from '~/components/PicksApp';
import SleeperRefreshButton from '~/components/SleeperRefreshButton';

/**
 * Keeps the picks page honest about who is actually still on the board.
 *
 * The recommender has always excluded drafted and rostered players, but it was
 * doing so against `data/draft.json` — a snapshot the CI job refreshes every six
 * hours. In a live startup that is the wrong clock entirely: picks land every
 * half hour, so for most of any given afternoon the page was confidently
 * recommending players who were already gone. The filter was right; the draft it
 * filtered against was hours old.
 *
 * So the scoring moved into the browser, where the live Sleeper snapshot
 * already lives. Two things fall out of that, and the second one is why this is
 * a rewrite rather than a patch:
 *
 *   1. **The board updates the moment you refresh from Sleeper.** A player
 *      taken two minutes ago disappears, the positional ranks close up behind
 *      him, and the roster gaps re-grade against the picks you have actually
 *      made.
 *   2. **There is exactly one scoring path.** Filtering a server-computed list
 *      in the browser would have left the score, the factor breakdown and the
 *      prose describing a board that no longer existed — "WR3 among everyone
 *      still available" is a claim about availability, and it would have been
 *      quietly false. Recomputing from the inputs means every number and every
 *      sentence is derived from the same board.
 *
 * It is also *smaller*: the inputs weigh about 123K against 223K for the
 * computed output they produce, because the output repeats each player under
 * both the flat list and his position group.
 *
 * The position boards are built here for the same reason. They used to be
 * computed once at build time and passed in, which left the page saying two
 * different things at once: the recommender knew a player had just gone, and
 * the WR board three tabs over still listed him as available. Building both
 * from the same inputs means one answer to "is he on the board?" everywhere.
 *
 * Rendering still happens server-side from the committed snapshot — this
 * component computes during SSR too — so the page is complete before hydration
 * and readable with no JavaScript at all. The live snapshot is applied after
 * mount, matching how `TeamApp` handles the same problem.
 */

export interface LivePicksProps {
  market: Market;
  trending: Trending;
  players: Player[];
  draft: Draft;
  team: Team;
  profiles: Profile[];
  depthRankById: Record<string, number>;
  sleeperConfig: SleeperConfig;
  links: { team: string; compare: string };
  /** Injectable for tests — defaults to reading this browser's localStorage. */
  loadSnapshot?: typeof loadLiveSnapshot;
}

export function LivePicks({
  market,
  trending,
  players: committedPlayers,
  draft: committedDraft,
  team: committedTeam,
  profiles,
  depthRankById,
  sleeperConfig,
  links,
  loadSnapshot = loadLiveSnapshot,
}: LivePicksProps) {
  const [team, setTeam] = useState<Team>(committedTeam);
  const [draft, setDraft] = useState<Draft>(committedDraft);
  const [players, setPlayers] = useState<Player[]>(committedPlayers);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);

  // Read localStorage only after mount, so the server-rendered markup matches
  // the committed baseline and hydration does not mismatch.
  useEffect(() => {
    function apply() {
      const live = loadSnapshot();
      if (live) {
        setTeam(live.team);
        setDraft(live.draft);
        setPlayers(mergePlayerPatches(committedPlayers, live.playerPatches));
        setSyncedAt(live.syncedAt);
        return;
      }
      setTeam(committedTeam);
      setDraft(committedDraft);
      setPlayers(committedPlayers);
      setSyncedAt(null);
    }
    apply();
    window.addEventListener(SLEEPER_REFRESH_EVENT, apply);
    return () => window.removeEventListener(SLEEPER_REFRESH_EVENT, apply);
    // The committed props are the build-time baseline for this page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [committedTeam, committedDraft, committedPlayers]);

  const boards = useMemo(
    () =>
      buildPositionBoards({
        market,
        trending,
        players,
        draft,
        format: team.format,
        depthRankById,
      }),
    [market, trending, players, draft, team.format, depthRankById],
  );

  const recs = useMemo(
    () =>
      buildPickRecommendations({
        market,
        trending,
        players,
        draft,
        team,
        profiles,
        depthRankById,
      }),
    [market, trending, players, draft, team, profiles, depthRankById],
  );

  const takenCount = draft.picks.length;

  return (
    <div className="space-y-4">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2"
        data-testid="live-picks-bar"
        data-live={syncedAt ? 'true' : 'false'}
      >
        <p className="text-[12px] text-muted" data-testid="live-picks-status">
          {syncedAt ? (
            <>
              Live from Sleeper ·{' '}
              <span data-numeric>{takenCount}</span> player
              {takenCount === 1 ? '' : 's'} off the board and hidden.
            </>
          ) : (
            <>
              Showing the last committed snapshot ·{' '}
              <span data-numeric>{takenCount}</span> player
              {takenCount === 1 ? '' : 's'} off the board and hidden. Refresh to pull picks made
              since.
            </>
          )}
        </p>
        <div className="ml-auto">
          <SleeperRefreshButton config={sleeperConfig} team={committedTeam} players={committedPlayers} />
        </div>
      </div>

      <PicksApp data={boards} recs={recs} links={links} />
    </div>
  );
}

export default LivePicks;
