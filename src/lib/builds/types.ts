import type { ArchetypeId } from './archetypes';

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

/**
 * A single recommended pick surfaced by a chosen archetype at a given draft
 * slot. T5 (`picks.ts`) implements the function that produces these; this
 * task only declares the shape so both tasks type-check against one contract.
 */
export interface PickSuggestion {
  pick: number;
  archetypeId: ArchetypeId;
  playerId: string | null;
  name: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  valueSf: number;
  ecrSf: number | null;
  rationale: string;
}
