import { z } from 'zod';

/**
 * Output of the roster-review loop. Every suggestion must cite something that
 * exists in the repo — a news item id or a knowledge article slug. The check
 * verifies the citation resolves, which is what stops the loop from inventing
 * advice.
 */
export const SuggestionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['buy', 'sell', 'hold', 'watch', 'roster-move']),
  headline: z.string().min(1),
  detail: z.string().min(1),
  /** Player ids this concerns. */
  players: z.array(z.string()).default([]),
  /** News item ids backing this suggestion. */
  newsRefs: z.array(z.string()).default([]),
  /** Knowledge article slugs ('facet/slug') backing this suggestion. */
  knowledgeRefs: z.array(z.string()).default([]),
  confidence: z.enum(['low', 'medium', 'high']),
});

export const BriefingSchema = z.object({
  /** ISO date the briefing was generated. */
  date: z.iso.datetime(),
  summary: z.string().min(1),
  suggestions: z.array(SuggestionSchema),
});

export const InsightsSchema = z.array(BriefingSchema);

export type Suggestion = z.infer<typeof SuggestionSchema>;
export type Briefing = z.infer<typeof BriefingSchema>;

/** A suggestion is only usable if it cites at least one existing source. */
export function hasCitation(s: Suggestion): boolean {
  return s.newsRefs.length > 0 || s.knowledgeRefs.length > 0;
}
