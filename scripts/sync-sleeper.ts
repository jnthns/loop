#!/usr/bin/env tsx
/**
 * sync-sleeper — pull the real league into the committed data files.
 *
 *   npm run sync:sleeper                 resolve + sync from the Sleeper API
 *   npm run sync:sleeper -- --fixtures   map committed fixtures instead (offline)
 *   npm run sync:sleeper -- --dry-run    report what would change, write nothing
 *
 * Sleeper's read API is public and keyless, so this introduces no secret.
 *
 * What Sleeper owns and this overwrites: league format, roster assignments, the
 * FAAB ledger's total and spend-to-date, and the player rows.
 * What stays yours and is never touched: `targets` (rationale and cost), the
 * `auction` budget, and per-slot notes where the slot still holds the same
 * player.
 *
 * Safety rule: any fetch failure aborts before writing. A bad network day must
 * never blank a good roster.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SleeperConfigSchema, type SleeperConfig } from '../src/lib/schemas/sleeper.ts';
import {
  SleeperDraftPickSchema,
  SleeperDraftSchema,
  SleeperLeagueSchema,
  SleeperPlayerSchema,
  SleeperRosterSchema,
  SleeperTrendingSchema,
  type SleeperLeague,
  type SleeperPlayer,
  type SleeperRoster,
} from '../src/lib/schemas/sleeper.ts';
import { PlayersSchema, type Player } from '../src/lib/schemas/players.ts';
import { TeamSchema } from '../src/lib/schemas/team.ts';
import { TrendingSchema, type TrendingPlayer } from '../src/lib/schemas/trending.ts';
import { DraftSchema, NO_DRAFT, type Draft } from '../src/lib/schemas/draft.ts';
import { applySleeperToTeam, toDraft, toPlayer, teamNameFor } from '../src/lib/sleeper/map.ts';
import * as api from '../src/lib/sleeper/client.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
const FIXTURES = join(ROOT, 'tests/fixtures/sleeper');

const args = new Set(process.argv.slice(2));
const useFixtures = args.has('--fixtures');
const dryRun = args.has('--dry-run') || (useFixtures && !args.has('--write'));

const DAY_MS = 86_400_000;

function readData(file: string): unknown {
  return JSON.parse(readFileSync(join(DATA, file), 'utf8'));
}

function writeData(file: string, value: unknown): void {
  writeFileSync(join(DATA, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readFixture(name: string): unknown {
  const path = join(FIXTURES, name);
  if (!existsSync(path)) throw new Error(`missing fixture: tests/fixtures/sleeper/${name}`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

interface Snapshot {
  league: SleeperLeague;
  rosters: SleeperRoster[];
  userId: string;
  season: string;
  players: Record<string, SleeperPlayer>;
  trendingAdds: { player_id: string; count: number }[];
  trendingDrops: { player_id: string; count: number }[];
  config: SleeperConfig;
  teamName: string | null;
  rawDraft: import('../src/lib/schemas/sleeper.ts').SleeperDraft | null;
  rawDraftPicks: import('../src/lib/schemas/sleeper.ts').SleeperDraftPick[];
}

/** Offline path: everything comes from tests/fixtures/sleeper/. */
function fixtureSnapshot(config: SleeperConfig): Snapshot {
  const league = SleeperLeagueSchema.parse(readFixture('league.json'));
  const rosters = SleeperRosterSchema.array().parse(readFixture('rosters.json'));
  const rawPlayers = readFixture('players.json') as Record<string, unknown>;
  const players: Record<string, SleeperPlayer> = {};
  for (const [id, value] of Object.entries(rawPlayers)) {
    const parsed = SleeperPlayerSchema.safeParse(value);
    if (parsed.success) players[id] = parsed.data;
  }
  const trending = SleeperTrendingSchema.parse(readFixture('trending-add.json'));
  const rawDraft = existsSync(join(FIXTURES, 'draft.json'))
    ? SleeperDraftSchema.parse(readFixture('draft.json'))
    : null;
  const rawDraftPicks = existsSync(join(FIXTURES, 'draft-picks.json'))
    ? SleeperDraftPickSchema.array().parse(readFixture('draft-picks.json'))
    : [];

  return {
    league,
    rosters,
    userId: String(rosters[0]?.owner_id ?? 'fixture-user'),
    season: league.season ?? '2026',
    players,
    trendingAdds: trending,
    trendingDrops: [],
    config,
    teamName: 'Fixture Team',
    rawDraft,
    rawDraftPicks,
  };
}

/** Live path. Throws on any failure — the caller must not write on a throw. */
async function liveSnapshot(config: SleeperConfig): Promise<Snapshot | null> {
  const state = await api.getState();
  const season = config.season ?? state.league_season ?? state.season;

  const userId = config.userId ?? (await api.getUser(config.username)).user_id;
  console.log(`  · user ${config.username} -> ${userId}`);

  let leagueId = config.leagueId;
  if (!leagueId) {
    const leagues = await api.getLeaguesForUser(userId, season);
    console.log(`  · ${leagues.length} NFL league(s) in ${season}`);

    if (leagues.length === 0) {
      throw new Error(
        `no NFL leagues found for ${config.username} in ${season}. ` +
          `Check the username spelling (it is case-sensitive) or set leagueId in data/sleeper.json.`,
      );
    }

    if (leagues.length > 1) {
      // Refuse to guess which one is the dynasty league.
      const candidates = leagues.map((l) => ({
        leagueId: l.league_id,
        name: l.name,
        teams: l.total_rosters,
      }));
      writeData('sleeper.json', { ...config, userId, season, candidateLeagues: candidates });
      console.log('\nSeveral leagues found. Pick one and set `leagueId` in data/sleeper.json:');
      for (const c of candidates) console.log(`  ${c.leagueId}  ${c.name} (${c.teams} teams)`);
      return null;
    }

    leagueId = leagues[0].league_id;
  }

  const [league, rosters] = await Promise.all([api.getLeague(leagueId), api.getRosters(leagueId)]);
  console.log(`  · league "${league.name}" (${league.total_rosters} teams)`);

  // The 5MB player dump is fetched at most once a day, per Sleeper's guidance.
  const lastSync = config.lastPlayerSync ? Date.parse(config.lastPlayerSync) : 0;
  const playersAreStale = !Number.isFinite(lastSync) || Date.now() - lastSync > DAY_MS;
  const players = playersAreStale ? await api.getAllPlayers() : {};
  console.log(
    playersAreStale
      ? `  · player dump: ${Object.keys(players).length} rows`
      : '  · player dump: skipped (synced within 24h)',
  );

  // Market signal, team name, and draft are all nice-to-haves relative to the
  // roster; none of them should fail a sync.
  const [trendingAdds, trendingDrops, users, drafts] = await Promise.all([
    api.getTrending('add', 24, 25).catch(() => []),
    api.getTrending('drop', 24, 25).catch(() => []),
    api.getLeagueUsers(leagueId).catch(() => []),
    api.getDrafts(leagueId).catch(() => []),
  ]);

  const teamName = teamNameFor(users, userId);
  if (teamName) console.log(`  · team name: ${teamName}`);

  // Newest draft first is Sleeper's order; the current season's is the one we want.
  const rawDraft = drafts.find((d) => d.season === season) ?? drafts[0] ?? null;
  const rawDraftPicks = rawDraft
    ? await api.getDraftPicks(rawDraft.draft_id).catch(() => [])
    : [];
  if (rawDraft) {
    console.log(`  · draft ${rawDraft.draft_id}: ${rawDraft.status} (${rawDraftPicks.length} picks)`);
  } else {
    console.log('  · no draft found for this league yet');
  }

  return {
    league,
    rosters,
    userId,
    season,
    players,
    trendingAdds,
    trendingDrops,
    config: { ...config, userId, leagueId, season, candidateLeagues: [] },
    teamName,
    rawDraft,
    rawDraftPicks,
  };
}

/**
 * Add/drop counts, resolved to names where possible.
 *
 * These are counts, not journalism — there is no article and no author — so they
 * are kept out of `data/news.json` entirely rather than given a manufactured
 * headline and URL.
 */
function buildTrending(
  snapshot: Snapshot,
  players: Player[],
): { adds: TrendingPlayer[]; drops: TrendingPlayer[] } {
  const bySleeperId = new Map(players.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p]));

  const resolve = (entry: { player_id: string; count: number }): TrendingPlayer | null => {
    const known = bySleeperId.get(entry.player_id);
    const raw = snapshot.players[entry.player_id];
    const name = known?.name ?? raw?.full_name;
    if (!name) return null;
    return {
      playerId: known?.id ?? null,
      sleeperId: entry.player_id,
      name,
      pos: known?.pos ?? raw?.position ?? '—',
      nflTeam: known?.nflTeam ?? raw?.team ?? 'FA',
      count: entry.count,
    };
  };

  const map = (entries: { player_id: string; count: number }[]) =>
    entries.map(resolve).filter((t): t is TrendingPlayer => t !== null);

  return { adds: map(snapshot.trendingAdds), drops: map(snapshot.trendingDrops) };
}

/**
 * Keep only the players that matter: your roster, everyone rostered in the
 * league, your targets, and what the league is trending on. The full dump is
 * thousands of rows of noise that would dominate every diff.
 */
function selectPlayers(
  snapshot: Snapshot,
  myRoster: SleeperRoster,
  targetPlayerIds: string[],
  existing: Player[],
): Player[] {
  const existingBySleeperId = new Map(existing.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p]));
  const existingById = new Map(existing.map((p) => [p.id, p]));

  const mine = new Set([
    ...(myRoster.players ?? []),
    ...(myRoster.reserve ?? []),
    ...(myRoster.taxi ?? []),
  ]);
  const leagueRostered = new Set(snapshot.rosters.flatMap((r) => r.players ?? []));
  const trendingIds = [
    ...snapshot.trendingAdds.map((t) => t.player_id),
    ...snapshot.trendingDrops.map((t) => t.player_id),
  ];
  const wanted = new Set([...mine, ...leagueRostered, ...trendingIds]);

  const out: Player[] = [];
  const seenIds = new Set<string>();

  for (const sleeperId of wanted) {
    const raw = snapshot.players[sleeperId];
    if (!raw) continue;
    const mapped = toPlayer(raw, existingBySleeperId.get(sleeperId));
    if (!mapped) continue;

    // Slug collisions (two players with the same name) get disambiguated rather
    // than silently overwriting each other.
    let id = mapped.id;
    if (seenIds.has(id)) id = `${id}-${mapped.pos.toLowerCase()}-${sleeperId}`;
    seenIds.add(id);

    out.push({ ...mapped, id, rosteredInLeague: leagueRostered.has(sleeperId) });
  }

  // Never drop a player a target still points at, even if they left the league.
  for (const targetId of targetPlayerIds) {
    if (seenIds.has(targetId)) continue;
    const prior = existingById.get(targetId);
    if (prior) {
      out.push(prior);
      seenIds.add(targetId);
    }
  }

  return out.sort((a, b) => a.pos.localeCompare(b.pos) || a.name.localeCompare(b.name));
}

async function main() {
  const config = SleeperConfigSchema.parse(readData('sleeper.json'));
  const previousTeam = TeamSchema.parse(readData('team.json'));
  const previousPlayers = PlayersSchema.parse(readData('players.json'));

  console.log(
    `${useFixtures ? 'Mapping fixtures for' : 'Syncing'} Sleeper user "${config.username}"…`,
  );

  const snapshot = useFixtures ? fixtureSnapshot(config) : await liveSnapshot(config);
  if (!snapshot) return; // Ambiguous league — a human has to choose.

  const myRoster = snapshot.rosters.find((r) => String(r.owner_id) === String(snapshot.userId));
  if (!myRoster) {
    throw new Error(
      `no roster in league ${snapshot.league.league_id} is owned by user ${snapshot.userId}. ` +
        `Are you sure this is your league?`,
    );
  }

  // When the player dump was skipped, reuse what is already committed.
  const players =
    Object.keys(snapshot.players).length > 0
      ? selectPlayers(
          snapshot,
          myRoster,
          previousTeam.targets.map((t) => t.playerId),
          previousPlayers,
        )
      : previousPlayers;

  const result = applySleeperToTeam(previousTeam, {
    league: snapshot.league,
    roster: myRoster,
    players,
    season: snapshot.season,
    teamName: snapshot.teamName ?? undefined,
  });

  const sleeperIdToPlayerId = new Map(
    players.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]),
  );
  const draft: Draft = snapshot.rawDraft
    ? DraftSchema.parse(
        toDraft({
          draft: snapshot.rawDraft,
          picks: snapshot.rawDraftPicks,
          userId: snapshot.userId,
          rosterId: myRoster.roster_id,
          sleeperIdToPlayerId,
        }),
      )
    : NO_DRAFT;

  if (draft.status !== 'none') {
    console.log(
      `  · draft: ${draft.status}, ${draft.type || 'unknown type'}, ${draft.rounds} rounds` +
        (draft.myDraftSlot
          ? ` · your slot ${draft.myDraftSlot} → picks ${draft.myPicks.slice(0, 5).join(', ')}${draft.myPicks.length > 5 ? '…' : ''}`
          : ' · draft order not set yet'),
    );
  }

  const team = TeamSchema.parse(result.team);
  const validPlayers = PlayersSchema.parse(players);

  const filled = team.roster.filter((r) => r.playerId).length;
  console.log(
    `  · ${filled}/${team.roster.length} slots filled · ${validPlayers.length} player(s) retained · ` +
      `${team.targets.length} target(s) preserved`,
  );

  if (result.unresolved.length > 0) {
    console.warn(
      `  ! ${result.unresolved.length} rostered player(s) not in the player file — ` +
        `re-run after the daily player dump refreshes: ${result.unresolved.slice(0, 5).join(', ')}`,
    );
  }
  if (result.overflow.length > 0) {
    console.warn(
      `  ! ${result.overflow.length} player(s) had no bench slot. Widen rosterSlots or check taxi/IR settings.`,
    );
  }
  if (result.satisfiedTargets.length > 0) {
    console.log(
      `  · ${result.satisfiedTargets.length} target(s) are now on the roster (kept, not deleted): ` +
        result.satisfiedTargets.join(', '),
    );
  }

  const trendingLists = buildTrending(snapshot, validPlayers);
  const trending = TrendingSchema.parse({
    capturedAt: new Date().toISOString(),
    lookbackHours: 24,
    ...trendingLists,
  });
  console.log(
    `  · market: ${trending.adds.length} trending add(s), ${trending.drops.length} drop(s)`,
  );

  if (dryRun) {
    console.log('Dry run — no files written.');
    return;
  }

  writeData('team.json', team);
  writeData('players.json', validPlayers);
  writeData('trending.json', trending);
  writeData('draft.json', draft);
  writeData('sleeper.json', {
    ...snapshot.config,
    lastPlayerSync:
      Object.keys(snapshot.players).length > 0
        ? new Date().toISOString()
        : snapshot.config.lastPlayerSync,
    lastSyncedAt: new Date().toISOString(),
  });
  console.log(
    'Wrote data/team.json, data/players.json, data/trending.json, data/draft.json, data/sleeper.json',
  );
}

main().catch((error) => {
  console.error(`\nSync failed — nothing was written.\n${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
