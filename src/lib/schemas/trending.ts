import { z } from 'zod';

/**
 * League-wide add/drop activity from Sleeper.
 *
 * Deliberately NOT stored as news. These are counts, not journalism: nobody
 * wrote them, there is nothing to read, and there is no article to link to.
 * Filing them as news items would mean inventing a headline and a URL, which is
 * exactly the kind of plausible-looking fabrication this repo refuses to do.
 * They live here instead, and the UI labels them as market signal.
 */
export const TrendingPlayerSchema = z.object({
  /** Our player slug, when the player is known; null when unmatched. */
  playerId: z.string().nullable(),
  sleeperId: z.string(),
  name: z.string(),
  pos: z.string(),
  nflTeam: z.string(),
  /** Number of leagues that added or dropped this player in the lookback window. */
  count: z.number().int().min(0),
});

export const TrendingSchema = z.object({
  /** When this snapshot was taken. */
  capturedAt: z.iso.datetime(),
  lookbackHours: z.number().int().positive(),
  adds: z.array(TrendingPlayerSchema).default([]),
  drops: z.array(TrendingPlayerSchema).default([]),
});

export type TrendingPlayer = z.infer<typeof TrendingPlayerSchema>;
export type Trending = z.infer<typeof TrendingSchema>;

export const EMPTY_TRENDING: Trending = {
  capturedAt: '1970-01-01T00:00:00.000Z',
  lookbackHours: 24,
  adds: [],
  drops: [],
};
