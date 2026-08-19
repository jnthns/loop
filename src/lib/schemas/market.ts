import { z } from 'zod';
import { HttpsUrlSchema } from './url';

/**
 * Market data from DynastyProcess (values-players.csv, values-picks.csv,
 * db_playerids.csv), joined to our own player slugs via Sleeper's id.
 *
 * The league is 12-team superflex, so the `_2qb` (superflex) columns are the
 * ones that matter here and are named `...Sf`. The `_1qb` columns are kept
 * alongside because `value1qb / valueSf` is a direct read on the superflex QB
 * premium — a later task uses that ratio.
 */

/** Provenance of a data point — the same {label, url} shape the knowledge
 * collection already requires in src/content.config.ts. */
export const SourceSchema = z.object({
  label: z.string().min(1),
  url: HttpsUrlSchema,
  kind: z.enum(['dataset', 'rankings', 'market', 'news', 'article']),
});

export const MarketPlayerRowSchema = z.object({
  /** DynastyProcess fp_id — the join key into db_playerids.csv. */
  fpId: z.string(),
  sleeperId: z.string().nullable(),
  ktcId: z.string().nullable(),
  espnId: z.string().nullable(),
  /** Our own slug, when the row could be matched to an entry in data/players.json. */
  playerId: z.string().nullable(),
  name: z.string().min(1),
  pos: z.string().min(1),
  nflTeam: z.string(),
  age: z.number().nullable(),
  draftYear: z.number().int().nullable(),
  /** ecr_2qb — FantasyPros Expert Consensus Rank, superflex. */
  ecrSf: z.number().nullable(),
  /** ecr_1qb — for comparison against the superflex rank. */
  ecr1qb: z.number().nullable(),
  /** ecr_pos — rank within position. */
  posEcr: z.number().nullable(),
  /**
   * value_2qb — DynastyProcess's own trade-value model, superflex.
   *
   * NOT a KeepTradeCut value, despite `ktcId` sitting two fields up: that id is
   * from DynastyProcess's cross-platform id crosswalk and is used only to build
   * deep links to KTC player pages. `values-players.csv` carries no KTC column.
   *
   * More importantly, this is **not independent of `ecrSf`** — DynastyProcess
   * derives the value curve from the same FantasyPros consensus. Sorting the
   * committed snapshot both ways puts 69.5% of players in exactly the same
   * position and 91% within three spots. Treat value and ECR as one opinion
   * expressed twice (a rank and a magnitude), never as two sources agreeing.
   * For a genuinely independent read, use Sleeper's `rank` in players.json.
   */
  valueSf: z.number(),
  /** value_1qb — value1qb / valueSf measures the superflex QB premium. */
  value1qb: z.number().nullable(),
});

export const MarketPickRowSchema = z.object({
  /** The upstream label verbatim, e.g. '2026 Pick 1.01' or '2028 3rd'. */
  label: z.string().min(1),
  season: z.number().int(),
  round: z.number().int().positive(),
  /** Slot within the round, when the label names one ('1.04' -> 4); null for
   * unslotted future-round labels like '2028 3rd'. */
  pickInRound: z.number().int().positive().nullable(),
  ecrSf: z.number().nullable(),
  ecrHighSf: z.number().nullable(),
  ecrLowSf: z.number().nullable(),
  /**
   * DynastyProcess's values-picks.csv carries ECR columns only, not a value
   * column (unlike values-players.csv). Rather than fabricate a value from
   * ECR, this stays null until upstream actually publishes one.
   */
  valueSf: z.number().nullable(),
});

export const MarketSchema = z.object({
  /** When this snapshot was assembled by our sync, not DynastyProcess's own scrape. */
  capturedAt: z.iso.datetime(),
  /** DynastyProcess's own scrape_date column, verbatim. */
  scrapeDate: z.string(),
  sources: z.array(SourceSchema).min(1, 'every market snapshot must cite its data sources'),
  players: z.array(MarketPlayerRowSchema),
  picks: z.array(MarketPickRowSchema),
  /** Join failures, surfaced rather than swallowed — see joinToSleeper. */
  unmatched: z.array(
    z.object({
      name: z.string(),
      pos: z.string(),
      fpId: z.string(),
    }),
  ),
});

export type Source = z.infer<typeof SourceSchema>;
export type MarketPlayerRow = z.infer<typeof MarketPlayerRowSchema>;
export type MarketPickRow = z.infer<typeof MarketPickRowSchema>;
export type Market = z.infer<typeof MarketSchema>;

export const EMPTY_MARKET: Market = {
  capturedAt: '1970-01-01T00:00:00.000Z',
  scrapeDate: '',
  sources: [
    {
      label: 'DynastyProcess dynasty values',
      url: 'https://github.com/dynastyprocess/data',
      kind: 'dataset',
    },
  ],
  players: [],
  picks: [],
  unmatched: [],
};
