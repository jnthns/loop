/**
 * Live Sleeper roster refresh for the browser.
 *
 * Fetches league + rosters + draft picks (not the ~5MB player dump) and merges
 * into the committed team/players using the same pure mappers as
 * `scripts/sync-sleeper.ts`. Intended for the sidebar button on the static site:
 * results go to localStorage, never to disk.
 */

import type { Player, Position } from '~/lib/schemas/players';
import { POSITIONS } from '~/lib/schemas/players';
import type { SleeperConfig } from '~/lib/schemas/sleeper';
import type { SleeperDraftPick, SleeperRoster } from '~/lib/schemas/sleeper';
import type { Team } from '~/lib/schemas/team';
import type { Draft } from '~/lib/schemas/draft';
import { NO_DRAFT } from '~/lib/schemas/draft';
import * as api from '~/lib/sleeper/client';
import { applySleeperToTeam, slugify, toDraft } from '~/lib/sleeper/map';
import type { LiveSleeperSnapshot } from '~/lib/team/live-storage';

export interface LiveRefreshInput {
  config: SleeperConfig;
  team: Team;
  players: Player[];
}

export interface LiveRefreshResult extends LiveSleeperSnapshot {
  overflow: string[];
  unresolved: string[];
  satisfiedTargets: string[];
}

/**
 * Stub a player from draft-pick metadata when they are not yet in the committed
 * pool. Age is a documented sentinel (25) — we refuse to invent a real age from
 * nothing, but the schema requires one and without a row the roster slot stays
 * blank after a live pick.
 */
export function playerFromDraftPick(pick: SleeperDraftPick): Player | null {
  if (!pick.player_id) return null;
  const name = [pick.metadata?.first_name, pick.metadata?.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!name) return null;

  const rawPos = (pick.metadata?.position ?? '').toUpperCase();
  const pos = (POSITIONS as readonly string[]).includes(rawPos)
    ? (rawPos as Position)
    : rawPos === 'DST' || rawPos === 'D/ST'
      ? ('DEF' as Position)
      : null;
  if (!pos) return null;

  const team = (pick.metadata?.team ?? 'FA').toUpperCase().slice(0, 3);

  return {
    id: slugify(name),
    name,
    pos,
    nflTeam: team.length >= 2 ? team : 'FA',
    age: 25,
    tier: 'depth',
    notes: 'Added by live Sleeper refresh (age unknown until the next full sync).',
    sleeperId: pick.player_id,
    rosteredInLeague: true,
  };
}

/** Build the sleeper-id → slug map, adding stubs for unmapped draft picks. */
export function resolvePlayersForLiveRefresh(
  committed: Player[],
  rosters: SleeperRoster[],
  draftPicks: SleeperDraftPick[],
): { players: Player[]; patches: Player[] } {
  const bySleeper = new Map(
    committed.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p]),
  );
  const patches: Player[] = [];
  const players = committed.map((p) => ({ ...p }));

  const leagueRostered = new Set(rosters.flatMap((r) => r.players ?? []));

  // Availability flags from current league rosters (works even when empty pre-draft).
  for (const p of players) {
    if (!p.sleeperId) continue;
    const rostered = leagueRostered.has(p.sleeperId);
    if (p.rosteredInLeague !== rostered) {
      p.rosteredInLeague = rostered;
      patches.push({ ...p });
    }
  }

  for (const pick of draftPicks) {
    if (!pick.player_id || bySleeper.has(pick.player_id)) continue;
    const stub = playerFromDraftPick(pick);
    if (!stub) continue;
    bySleeper.set(pick.player_id, stub);
    players.push(stub);
    patches.push(stub);
  }

  // Anyone on a roster with no committed row and no draft metadata stays unresolved
  // — the full player dump is what fills those, and we deliberately skip it here.
  return { players, patches };
}

/**
 * Pure merge of an already-fetched Sleeper snapshot. Separated from the network
 * so tests can run offline against fixtures.
 */
export function applyLiveSnapshot(input: {
  team: Team;
  players: Player[];
  league: Parameters<typeof applySleeperToTeam>[1]['league'];
  roster: SleeperRoster;
  allRosters: SleeperRoster[];
  userId: string;
  season: string;
  teamName?: string | null;
  rawDraft: Parameters<typeof toDraft>[0]['draft'] | null;
  rawDraftPicks: SleeperDraftPick[];
}): LiveRefreshResult {
  const { players, patches } = resolvePlayersForLiveRefresh(
    input.players,
    input.allRosters,
    input.rawDraftPicks,
  );

  const sleeperIdToPlayerId = new Map(
    players.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]),
  );

  const draft: Draft = input.rawDraft
    ? toDraft({
        draft: input.rawDraft,
        picks: input.rawDraftPicks,
        userId: input.userId,
        rosterId: input.roster.roster_id,
        sleeperIdToPlayerId,
      })
    : NO_DRAFT;

  const result = applySleeperToTeam(input.team, {
    league: input.league,
    roster: input.roster,
    players,
    season: input.season,
    teamName: input.teamName ?? undefined,
    draftPicks: draft.picks,
  });

  return {
    team: result.team,
    draft,
    playerPatches: patches,
    syncedAt: new Date().toISOString(),
    overflow: result.overflow,
    unresolved: result.unresolved,
    satisfiedTargets: result.satisfiedTargets,
  };
}

/**
 * Hit the Sleeper API and produce a live snapshot. Throws on hard failures
 * (missing league, no roster owned by you) — the button surfaces the message.
 */
export async function fetchLiveSleeperRefresh(
  input: LiveRefreshInput,
): Promise<LiveRefreshResult> {
  const { config, team, players } = input;

  if (!config.leagueId || !config.userId) {
    throw new Error(
      'Sleeper league is not configured yet. Run `npm run sync:sleeper` once to resolve leagueId and userId.',
    );
  }

  const season = config.season ?? (await api.getState()).league_season ?? '2026';
  const [league, rosters] = await Promise.all([
    api.getLeague(config.leagueId),
    api.getRosters(config.leagueId),
  ]);

  const myRoster = rosters.find((r) => String(r.owner_id) === String(config.userId));
  if (!myRoster) {
    throw new Error(
      `No roster in league ${config.leagueId} is owned by user ${config.userId}.`,
    );
  }

  const [users, drafts] = await Promise.all([
    api.getLeagueUsers(config.leagueId).catch(() => []),
    api.getDrafts(config.leagueId).catch(() => []),
  ]);

  const me = users.find((u) => u.user_id === config.userId);
  const teamName =
    me?.metadata?.team_name?.trim() || me?.display_name?.trim() || null;

  const rawDraft = drafts.find((d) => d.season === season) ?? drafts[0] ?? null;
  const rawDraftPicks = rawDraft
    ? await api.getDraftPicks(rawDraft.draft_id).catch(() => [])
    : [];

  return applyLiveSnapshot({
    team,
    players,
    league,
    roster: myRoster,
    allRosters: rosters,
    userId: config.userId,
    season,
    teamName,
    rawDraft,
    rawDraftPicks,
  });
}
