import type { ArchetypeId } from './archetypes';
import type { Source } from '~/lib/schemas/market';
import type { Verdict } from '~/lib/nfl/types';

export type FitBand = 'BEST FIT' | 'FITS' | 'STRETCH' | 'FIGHTS THE FORMAT';

/** A single supporting fact for a fit score — `evidence` is the literal
 * arithmetic behind `text`, never a restatement of it. */
export interface Reason {
  text: string;
  evidence: string;
}

export interface BuildFit {
  id: ArchetypeId;
  score: number;
  band: FitBand;
  reasons: Reason[];
  components: {
    formatFit: number;
    supplyFit: number;
    valueEdge: number;
    /** The age axis — the only thing separating youth-first from win-now. */
    ageFit: number;
  };
}

/** One candidate player surfaced for a pick — the primary recommendation or an alternate. */
export interface PickCandidate {
  playerId: string | null;
  name: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  valueSf: number;
  ecrSf: number | null;
  /** The candidate's final weighted score at the pick it was evaluated for, 0-100. */
  score: number;
}

/**
 * A single recommended pick surfaced by a chosen archetype at a given draft
 * slot. `picks.ts` implements the function that produces these — a primary
 * plus two alternates, never repeating a player across the whole pick sheet.
 */
export interface PickSuggestion {
  pick: number;
  round: number;
  archetypeId: ArchetypeId;
  verdict: Verdict;
  primary: PickCandidate;
  alternates: PickCandidate[];
  /** One templated sentence over computed facts, in the voice of buildWhyPick(). */
  reason: string;
  /** Literal arithmetic backing `reason` — never a restatement of it. */
  evidence: string[];
  citations: Source[];
}
