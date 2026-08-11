import { z } from 'zod';

export const POSITIONS = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'] as const;
export const PositionSchema = z.enum(POSITIONS);

/**
 * Dynasty tiers, not redraft ranks. `cornerstone` is a long-term core piece;
 * `win-now` is productive but aging; `dart-throw` is a lottery ticket.
 */
export const TIERS = ['cornerstone', 'starter', 'win-now', 'depth', 'dart-throw'] as const;
export const TierSchema = z.enum(TIERS);

export const PlayerSchema = z.object({
  /**
   * Our own slug, not Sleeper's numeric id. Slugs keep `data/team.json` targets
   * readable and stable across a sync, and keep diffs reviewable.
   */
  id: z.string().min(1),
  name: z.string().min(1),
  pos: PositionSchema,
  /** NFL team abbreviation, or 'FA' for a free agent. */
  nflTeam: z.string().min(2).max(3),
  /** Age matters more than anything else in dynasty — required, not optional. */
  age: z.number().int().min(18).max(50),
  tier: TierSchema,
  notes: z.string().default(''),
  /** Sleeper's player_id, when this row came from or was matched to Sleeper. */
  sleeperId: z.string().optional(),
  /** True when the player is rostered by someone in the league. */
  rosteredInLeague: z.boolean().optional(),
  /** Sleeper's search_rank (lower = more relevant). Absent for unranked players. */
  rank: z.number().int().positive().optional(),
  /**
   * Sleeper's roster status — 'Active', 'Inactive', 'Injured Reserve', 'PUP',
   * 'Non Football Injury', 'Practice Squad'. Availability, not health: a player
   * can be 'Active' and still be listed 'Questionable' below.
   */
  status: z.string().optional(),
  /**
   * Sleeper's injury designation — 'Questionable', 'Doubtful', 'Out', 'IR',
   * 'PUP', 'Sus'. Absent when the player carries no designation, which is the
   * normal case. Never inferred: if Sleeper does not say it, we do not store it.
   */
  injuryStatus: z.string().optional(),
});

export const PlayersSchema = z.array(PlayerSchema);

export type Position = z.infer<typeof PositionSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Player = z.infer<typeof PlayerSchema>;
