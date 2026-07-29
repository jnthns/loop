/**
 * Tone assignment — the color-coding key for the whole app.
 *
 * A tone is a hue family declared in `src/styles/global.css`. Components never
 * name a color; they set `data-tone` (or `data-pos`) and read `--tone*`. Keeping
 * the assignment in one table is what stops the palette drifting into "whatever
 * hue the last pass felt like", and makes the coding learnable: knowledge is
 * always violet, the roster is always green, the market is always amber.
 */

export const TONES = [
  'blue',
  'violet',
  'teal',
  'green',
  'amber',
  'orange',
  'rose',
  'pink',
  'slate',
] as const;

export type Tone = (typeof TONES)[number];

/** Knowledge facets, in the order they appear in `FACETS`. */
export const FACET_TONES: Record<string, Tone> = {
  'roster-construction': 'blue',
  'startup-drafts': 'violet',
  'rookie-drafts': 'teal',
  trading: 'amber',
  'contend-vs-rebuild': 'rose',
  'in-season-management': 'green',
  'league-settings': 'slate',
  'player-evaluation': 'pink',
  'lessons-learned': 'orange',
};

export function facetTone(facetId: string): Tone {
  return FACET_TONES[facetId] ?? 'blue';
}

/** Top-level routes. The nav, the page hero, and each page's accents share one. */
export const ROUTE_TONES: Record<string, Tone> = {
  '/': 'blue',
  '/team': 'green',
  '/knowledge': 'violet',
  '/news': 'amber',
  '/progress': 'teal',
};

export function routeTone(path: string): Tone {
  return ROUTE_TONES[path] ?? 'blue';
}
