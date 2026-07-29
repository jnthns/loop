import { z } from 'zod';

/**
 * `data/sleeper.json` — how this repo finds your league.
 *
 * Nothing here is a secret: Sleeper's read API is public and keyless, so the
 * username and league id are as sensitive as your league URL. The nulls are
 * filled in by the first successful sync and reused afterwards so later runs
 * skip the lookup calls.
 */
export const SleeperConfigSchema = z.object({
  /** Sleeper handle. Case-sensitive in the API. */
  username: z.string().min(1),
  /** Resolved from the username on first sync. */
  userId: z.string().nullable().default(null),
  /** The dynasty league this app tracks. */
  leagueId: z.string().nullable().default(null),
  /** Season the league id belongs to, e.g. '2026'. */
  season: z.string().nullable().default(null),
  /**
   * When the ~5MB player dump was last pulled. Gated to once per day — the
   * data changes slowly and the file is large.
   */
  lastPlayerSync: z.string().nullable().default(null),
  lastSyncedAt: z.string().nullable().default(null),
  /**
   * Populated when the account has several NFL leagues in a season: the sync
   * refuses to guess which one is the dynasty league and records the options
   * here for a human to choose from.
   */
  candidateLeagues: z
    .array(z.object({ leagueId: z.string(), name: z.string(), teams: z.number() }))
    .default([]),
});

export type SleeperConfig = z.infer<typeof SleeperConfigSchema>;

/* -------------------------------------------------------------------------- */
/* Shapes of the Sleeper API responses we actually read.                       */
/* Loose on purpose — Sleeper returns far more than this and adds fields over  */
/* time; we validate only what we consume so a new upstream field cannot break */
/* a sync.                                                                      */
/* -------------------------------------------------------------------------- */

export const SleeperUserSchema = z.object({
  user_id: z.string(),
  username: z.string().optional(),
  display_name: z.string().optional(),
});

export const SleeperStateSchema = z.object({
  season: z.string(),
  league_season: z.string().optional(),
  week: z.number().optional(),
});

export const SleeperLeagueSchema = z.object({
  league_id: z.string(),
  name: z.string(),
  season: z.string().optional(),
  total_rosters: z.number(),
  roster_positions: z.array(z.string()),
  scoring_settings: z.record(z.string(), z.number()).default({}),
  settings: z.record(z.string(), z.union([z.number(), z.string()])).default({}),
});

export const SleeperRosterSchema = z.object({
  roster_id: z.number(),
  owner_id: z.string().nullable().optional(),
  players: z.array(z.string()).nullable().default([]),
  starters: z.array(z.string()).nullable().default([]),
  reserve: z.array(z.string()).nullable().default([]),
  taxi: z.array(z.string()).nullable().default([]),
  settings: z.record(z.string(), z.number()).default({}),
});

export const SleeperPlayerSchema = z.object({
  player_id: z.string(),
  full_name: z.string().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  position: z.string().nullable().optional(),
  fantasy_positions: z.array(z.string()).nullable().optional(),
  team: z.string().nullable().optional(),
  age: z.number().nullable().optional(),
  status: z.string().nullable().optional(),
  injury_status: z.string().nullable().optional(),
  years_exp: z.number().nullable().optional(),
});

export const SleeperTrendingSchema = z.array(
  z.object({ player_id: z.string(), count: z.number() }),
);

/** A league member. Sleeper carries the team name here, not on the league. */
export const SleeperLeagueUserSchema = z.object({
  user_id: z.string(),
  display_name: z.string().optional(),
  metadata: z.looseObject({ team_name: z.string().optional() }).nullable().optional(),
});

export const SleeperDraftSchema = z.object({
  draft_id: z.string(),
  status: z.string(),
  type: z.string().optional(),
  season: z.string().optional(),
  /** Epoch milliseconds. */
  start_time: z.number().nullable().optional(),
  settings: z.record(z.string(), z.number()).default({}),
  /** user_id -> draft slot (1-indexed). */
  draft_order: z.record(z.string(), z.number()).nullable().optional(),
  /** draft slot -> roster_id. */
  slot_to_roster_id: z.record(z.string(), z.number()).nullable().optional(),
});

export const SleeperDraftPickSchema = z.object({
  pick_no: z.number(),
  round: z.number(),
  draft_slot: z.number(),
  roster_id: z.number().nullable().optional(),
  player_id: z.string().nullable().optional(),
  picked_by: z.string().nullable().optional(),
  metadata: z
    .looseObject({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      position: z.string().optional(),
      team: z.string().optional(),
    })
    .nullable()
    .optional(),
});

export type SleeperLeague = z.infer<typeof SleeperLeagueSchema>;
export type SleeperRoster = z.infer<typeof SleeperRosterSchema>;
export type SleeperPlayer = z.infer<typeof SleeperPlayerSchema>;
export type SleeperTrending = z.infer<typeof SleeperTrendingSchema>;
export type SleeperLeagueUser = z.infer<typeof SleeperLeagueUserSchema>;
export type SleeperDraft = z.infer<typeof SleeperDraftSchema>;
export type SleeperDraftPick = z.infer<typeof SleeperDraftPickSchema>;
