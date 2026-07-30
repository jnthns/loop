/**
 * The fixed spine of the knowledge base.
 *
 * The list is closed on purpose: the curator loop files new writing into an
 * existing facet rather than inventing a category every pass, which is what
 * keeps the library navigable as it grows. Adding a facet is a deliberate edit
 * here, not something a pass does incidentally.
 */

export const FACETS = [
  {
    id: 'roster-construction',
    title: 'Roster construction',
    blurb: 'Age curves, positional value, roster shape, superflex and TE-premium effects.',
  },
  {
    id: 'startup-drafts',
    title: 'Startup drafts',
    blurb: 'Startup draft and auction strategy, picks vs players, tier drafting.',
  },
  {
    id: 'rookie-drafts',
    title: 'Rookie drafts',
    blurb: 'Rookie pick value, prospect evaluation, landing spot, draft capital.',
  },
  {
    id: 'trading',
    title: 'Trading',
    blurb: 'Value frameworks, buy-low and sell-high windows, negotiation, pick trading.',
  },
  {
    id: 'contend-vs-rebuild',
    title: 'Contend vs rebuild',
    blurb: 'Diagnosing your window, pivoting decisively, the cost of the middle.',
  },
  {
    id: 'in-season-management',
    title: 'In-season management',
    blurb: 'FAAB and waivers, taxi and IR, streaming, bye planning.',
  },
  {
    id: 'league-settings',
    title: 'League settings',
    blurb: 'Scoring, roster slots, and how format changes correct strategy.',
  },
  {
    id: 'player-evaluation',
    title: 'Player evaluation',
    blurb: 'Archetypes, metrics that carry, aging by position, injury context.',
  },
  {
    id: 'lessons-learned',
    title: 'Lessons learned',
    blurb: 'This manager’s own mistakes and corrections — the compounding log.',
  },
] as const;

export type FacetId = (typeof FACETS)[number]['id'];
export type Facet = (typeof FACETS)[number];

export const FACET_IDS = FACETS.map((f) => f.id) as unknown as [FacetId, ...FacetId[]];

export function getFacet(id: string): Facet | undefined {
  return FACETS.find((f) => f.id === id);
}

export function isFacetId(id: string): id is FacetId {
  return FACETS.some((f) => f.id === id);
}
