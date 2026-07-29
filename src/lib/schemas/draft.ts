import { z } from 'zod';

/**
 * The league's draft.
 *
 * Before a startup, this is the most important object in the app: the roster is
 * empty and every decision is about picks. `status: 'none'` means the league has
 * no draft object at all, which is a legitimate state, not an error.
 */

export const DRAFT_STATUSES = ['none', 'pre_draft', 'drafting', 'paused', 'complete'] as const;
export const DraftStatusSchema = z.enum(DRAFT_STATUSES);

export const DraftPickSchema = z.object({
  /** Overall pick number, 1-indexed. */
  pick: z.number().int().positive(),
  round: z.number().int().positive(),
  /** Position within the round, 1-indexed. */
  slot: z.number().int().positive(),
  rosterId: z.number().int().nullable(),
  playerId: z.string().nullable(),
  playerName: z.string().default(''),
  pos: z.string().default(''),
  nflTeam: z.string().default(''),
  /** True when this pick belongs to the manager this app tracks. */
  mine: z.boolean().default(false),
});

export const DraftSchema = z.object({
  draftId: z.string().nullable(),
  status: DraftStatusSchema,
  /** 'snake' | 'linear' | 'auction' as Sleeper reports it. */
  type: z.string().default(''),
  /** ISO timestamp of the scheduled start, when Sleeper knows one. */
  startTime: z.string().nullable().default(null),
  teams: z.number().int().positive().default(12),
  rounds: z.number().int().positive().default(1),
  /** This manager's position in round 1, 1-indexed. Null when not yet assigned. */
  myDraftSlot: z.number().int().positive().nullable().default(null),
  /** Overall pick numbers this manager owns, ascending. */
  myPicks: z.array(z.number().int().positive()).default([]),
  /** Picks already made. Empty before the draft starts. */
  picks: z.array(DraftPickSchema).default([]),
});

export type DraftStatus = z.infer<typeof DraftStatusSchema>;
export type DraftPick = z.infer<typeof DraftPickSchema>;
export type Draft = z.infer<typeof DraftSchema>;

export const NO_DRAFT: Draft = {
  draftId: null,
  status: 'none',
  type: '',
  startTime: null,
  teams: 12,
  rounds: 1,
  myDraftSlot: null,
  myPicks: [],
  picks: [],
};

/** Before the draft, the roster is empty by design rather than by neglect. */
export function isPreDraft(draft: Draft): boolean {
  return draft.status === 'pre_draft' || draft.status === 'none';
}

/** Where the draft currently sits, as a sentence a human would say. */
export function draftSummary(draft: Draft): string {
  switch (draft.status) {
    case 'none':
      return 'No draft scheduled in Sleeper yet.';
    case 'pre_draft':
      return draft.startTime
        ? `Draft scheduled for ${new Date(draft.startTime).toLocaleString('en-US')}.`
        : 'Draft created but not yet scheduled.';
    case 'drafting':
      return `Draft in progress — ${draft.picks.length} pick${draft.picks.length === 1 ? '' : 's'} made.`;
    case 'paused':
      return 'Draft paused.';
    case 'complete':
      return 'Draft complete.';
  }
}
