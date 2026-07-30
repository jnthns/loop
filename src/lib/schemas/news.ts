import { z } from 'zod';

/** A source feed the news pipeline reads. */
export const FeedSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url(),
  /** Groups feeds in the UI and lets the curator weigh sources differently. */
  category: z.enum(['league-news', 'fantasy', 'dynasty', 'analytics', 'team']),
  /** Set false to keep a feed on record without fetching it. */
  enabled: z.boolean().default(true),
});

export const FeedsSchema = z.array(FeedSchema);

/**
 * One normalized news item. `id` is derived from the canonical URL (see
 * src/lib/news/normalize.ts) so refetching the same story never duplicates it
 * and citations from knowledge articles stay valid across passes.
 */
export const NewsItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  source: z.string().min(1),
  sourceId: z.string().min(1),
  /** ISO 8601 timestamp. */
  publishedAt: z.iso.datetime(),
  summary: z.string().default(''),
  tags: z.array(z.string()).default([]),
  /** Player ids from data/players.json mentioned in the item. */
  players: z.array(z.string()).default([]),
  /** NFL team abbreviations mentioned in the item. */
  teams: z.array(z.string()).default([]),
});

export const NewsSchema = z.array(NewsItemSchema);

export type Feed = z.infer<typeof FeedSchema>;
export type NewsItem = z.infer<typeof NewsItemSchema>;
