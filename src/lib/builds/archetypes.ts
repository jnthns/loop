/**
 * The seven build archetypes this league's arithmetic supports — see
 * `src/content/knowledge/roster-construction/superflex-positional-builds.md`
 * for the prose argument each of these encodes.
 */

export const ARCHETYPE_IDS = [
  'superflex-qb-heavy',
  'zero-rb',
  'robust-rb',
  'hero-rb',
  'te-premium-leverage',
  'youth-first',
  'win-now',
] as const;

export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

export interface Archetype {
  id: ArchetypeId;
  name: string;
  /** Demand multiplier per position, roughly 0.4 (indifferent) – 1.6 (core need). */
  posWeight: Record<'QB' | 'RB' | 'WR' | 'TE', number>;
  /** Rounds by which a minimum count of the wanted positions should be secured. */
  plan: { throughRound: number; want: ('QB' | 'RB' | 'WR' | 'TE')[]; minCount: number }[];
  /** -1 (win-now, veterans) .. +1 (youth-first, rebuild). */
  ageBias: number;
  needsSuperflex: boolean;
  needsTePremium: boolean;
}

export const ARCHETYPES: Archetype[] = [
  {
    id: 'superflex-qb-heavy',
    name: 'Superflex QB-heavy (Robust QB)',
    posWeight: { QB: 1.6, RB: 0.7, WR: 0.9, TE: 0.6 },
    plan: [{ throughRound: 4, want: ['QB'], minCount: 2 }],
    ageBias: 0,
    needsSuperflex: true,
    needsTePremium: false,
  },
  {
    id: 'zero-rb',
    name: 'Zero RB',
    posWeight: { QB: 1.1, RB: 0.4, WR: 1.6, TE: 0.9 },
    plan: [
      { throughRound: 6, want: ['WR', 'QB'], minCount: 4 },
      { throughRound: 10, want: ['RB'], minCount: 0 },
    ],
    ageBias: 0.2,
    needsSuperflex: false,
    needsTePremium: false,
  },
  {
    id: 'robust-rb',
    name: 'Robust RB',
    posWeight: { QB: 0.7, RB: 1.6, WR: 1.0, TE: 0.6 },
    plan: [{ throughRound: 4, want: ['RB'], minCount: 2 }],
    ageBias: 0,
    needsSuperflex: false,
    needsTePremium: false,
  },
  {
    id: 'hero-rb',
    name: 'Hero RB',
    posWeight: { QB: 0.9, RB: 1.3, WR: 1.2, TE: 0.7 },
    plan: [{ throughRound: 2, want: ['RB'], minCount: 1 }],
    ageBias: 0,
    needsSuperflex: false,
    needsTePremium: false,
  },
  {
    id: 'te-premium-leverage',
    name: 'TE-premium leverage (TE anchor)',
    posWeight: { QB: 0.9, RB: 0.8, WR: 1.0, TE: 1.6 },
    plan: [{ throughRound: 3, want: ['TE'], minCount: 1 }],
    ageBias: 0.1,
    needsSuperflex: false,
    needsTePremium: true,
  },
  {
    id: 'youth-first',
    name: 'Youth-first rebuild',
    posWeight: { QB: 1.0, RB: 1.0, WR: 1.0, TE: 1.0 },
    plan: [{ throughRound: 30, want: ['QB', 'RB', 'WR', 'TE'], minCount: 0 }],
    ageBias: 1,
    needsSuperflex: false,
    needsTePremium: false,
  },
  {
    id: 'win-now',
    name: 'Win-now veteran build',
    posWeight: { QB: 1.1, RB: 1.1, WR: 1.1, TE: 0.9 },
    plan: [{ throughRound: 30, want: ['QB', 'RB', 'WR', 'TE'], minCount: 0 }],
    ageBias: -1,
    needsSuperflex: false,
    needsTePremium: false,
  },
];
