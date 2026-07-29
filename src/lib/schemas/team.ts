import { z } from 'zod';
import { PositionSchema } from './players';

/**
 * A lineup slot. `FLEX` is RB/WR/TE, `SUPERFLEX` adds QB, `BN` is bench and
 * `TAXI` is the developmental squad — both dynasty-specific and both meaningful
 * for roster construction, so they are first-class rather than a catch-all.
 */
export const SLOT_KINDS = [
  'QB',
  'RB',
  'WR',
  'TE',
  'FLEX',
  'SUPERFLEX',
  'K',
  'DEF',
  'BN',
  'TAXI',
  'IR',
] as const;
export const SlotKindSchema = z.enum(SLOT_KINDS);

export const RosterSlotSchema = z.object({
  /** Stable id, e.g. 'wr-2' — targets reference this. */
  id: z.string().min(1),
  kind: SlotKindSchema,
  label: z.string().min(1),
});

export const LeagueFormatSchema = z.object({
  teams: z.number().int().min(4).max(32),
  superflex: z.boolean(),
  /** Points per reception. */
  ppr: z.number().min(0).max(2),
  tePremium: z.number().min(0).max(2).default(0),
  rosterSlots: z.array(RosterSlotSchema).min(1),
});

export const RosterEntrySchema = z.object({
  slotId: z.string().min(1),
  /** Player id from data/players.json, or null for an empty slot. */
  playerId: z.string().min(1).nullable(),
  acquired: z.string().default(''),
  notes: z.string().default(''),
});

/** An alternative the owner is considering for a given slot. */
export const TargetSchema = z.object({
  id: z.string().min(1),
  slotId: z.string().min(1),
  playerId: z.string().min(1),
  /** 1 is the top target for that slot. */
  priority: z.number().int().min(1),
  rationale: z.string().min(1),
  /** What it would plausibly cost — a pick, a player, or auction dollars. */
  cost: z.string().default(''),
});

export const BUDGET_KINDS = ['auction', 'faab'] as const;
export const BudgetKindSchema = z.enum(BUDGET_KINDS);

export const BudgetEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  amount: z.number(),
  date: z.string().default(''),
});

export const BudgetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: BudgetKindSchema,
  total: z.number().min(0),
  entries: z.array(BudgetEntrySchema).default([]),
});

export const TeamSchema = z.object({
  leagueName: z.string().min(1),
  teamName: z.string().min(1),
  format: LeagueFormatSchema,
  roster: z.array(RosterEntrySchema),
  targets: z.array(TargetSchema),
  budgets: z.array(BudgetSchema),
});

export type SlotKind = z.infer<typeof SlotKindSchema>;
export type RosterSlot = z.infer<typeof RosterSlotSchema>;
export type LeagueFormat = z.infer<typeof LeagueFormatSchema>;
export type RosterEntry = z.infer<typeof RosterEntrySchema>;
export type Target = z.infer<typeof TargetSchema>;
export type BudgetKind = z.infer<typeof BudgetKindSchema>;
export type BudgetEntry = z.infer<typeof BudgetEntrySchema>;
export type Budget = z.infer<typeof BudgetSchema>;
export type Team = z.infer<typeof TeamSchema>;

/** Positions a slot can legally hold — used to filter alternatives per slot. */
export function eligiblePositions(kind: SlotKind): readonly z.infer<typeof PositionSchema>[] {
  switch (kind) {
    case 'FLEX':
      return ['RB', 'WR', 'TE'];
    case 'SUPERFLEX':
      return ['QB', 'RB', 'WR', 'TE'];
    case 'BN':
    case 'TAXI':
    case 'IR':
      return ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
    default:
      return [kind];
  }
}
