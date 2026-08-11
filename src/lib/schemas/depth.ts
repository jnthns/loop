import { z } from 'zod';

import { PositionSchema } from './players';

/**
 * `data/depth.json` — where each player sits on his NFL team's depth chart.
 *
 * Rank on the chart is the closest thing to a free opportunity signal: dynasty
 * value follows snaps, and snaps follow the chart. It answers the question a
 * ranking cannot — "is this backfield actually his?" — which is exactly the
 * question a startup draft keeps asking.
 *
 * Source: nflverse/nflverse-data `depth_charts` release, public and keyless.
 * Only the newest snapshot is kept; the release carries every snapshot back to
 * 2001 and we have no use for the history here.
 */
export const DepthEntrySchema = z.object({
  /** Our player slug, when the row matched a player we track. */
  id: z.string().min(1),
  name: z.string().min(1),
  pos: PositionSchema,
  /** NFL team abbreviation the chart belongs to. */
  nflTeam: z.string().min(2).max(3),
  /**
   * Rank within the position group: 1 is the starter, 2 the backup, and so on.
   * This is the whole point of the file.
   */
  depthRank: z.number().int().positive(),
  /** Sleeper's player_id, carried through so downstream joins need no fuzz. */
  sleeperId: z.string().optional(),
});

export const DepthSchema = z.object({
  capturedAt: z.string().min(1),
  /** The `dt` of the nflverse snapshot these rows came from. */
  snapshotAt: z.string().min(1),
  season: z.string().min(1),
  entries: z.array(DepthEntrySchema),
  /**
   * Chart rows we could not tie to a player we track, by name. Reported rather
   * than dropped silently — a join that quietly loses half its rows should be
   * visible in the diff, not discovered during a draft.
   */
  unmatched: z.array(z.string()),
});

export type DepthEntry = z.infer<typeof DepthEntrySchema>;
export type Depth = z.infer<typeof DepthSchema>;
