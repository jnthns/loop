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
  id: z.string().min(1),
  name: z.string().min(1),
  pos: PositionSchema,
  /** NFL team abbreviation, or 'FA' for a free agent. */
  nflTeam: z.string().min(2).max(3),
  /** Age matters more than anything else in dynasty — required, not optional. */
  age: z.number().int().min(18).max(50),
  tier: TierSchema,
  notes: z.string().default(''),
});

export const PlayersSchema = z.array(PlayerSchema);

export type Position = z.infer<typeof PositionSchema>;
export type Tier = z.infer<typeof TierSchema>;
export type Player = z.infer<typeof PlayerSchema>;
