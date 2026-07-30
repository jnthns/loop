import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACETS } from '~/lib/knowledge/facets';
import { FACET_TONES, ROUTE_TONES, TONES, facetTone, routeTone } from '~/lib/ui/tone';

/**
 * The color coding is a contract, not decoration: a facet that has no tone falls
 * back to blue and silently stops being distinguishable, and a tone named here
 * but never declared in CSS renders as the default. Both failures look fine in a
 * screenshot, so they get a test.
 */

const css = readFileSync(join(process.cwd(), 'src/styles/global.css'), 'utf8');

describe('tone palette', () => {
  it('declares every tone as a hue family, in light and dark theme', () => {
    for (const tone of TONES) {
      for (const suffix of ['', '-soft', '-line']) {
        // One declaration in `:root`, one under `:root[data-theme='dark']`.
        const matches = css.match(new RegExp(`--t-${tone}${suffix}:`, 'g')) ?? [];
        expect(matches.length, `--t-${tone}${suffix}`).toBe(2);
      }
    }
  });

  it('drives dark mode from data-theme rather than prefers-color-scheme alone', () => {
    expect(css).toContain(":root[data-theme='dark']");
    expect(css).not.toContain('@media (prefers-color-scheme: dark)');
  });

  it('maps every tone to `--tone*` through a `data-tone` selector', () => {
    for (const tone of TONES) {
      expect(css, `[data-tone='${tone}']`).toContain(`[data-tone='${tone}']`);
    }
  });

  it('gives every position a fixed hue', () => {
    for (const pos of ['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'FLEX', 'SUPERFLEX']) {
      expect(css, `[data-pos='${pos}']`).toContain(`[data-pos='${pos}']`);
    }
  });
});

describe('tone assignment', () => {
  it('assigns a distinct tone to every knowledge facet', () => {
    const assigned = FACETS.map((facet) => {
      expect(FACET_TONES[facet.id], `${facet.id} has no tone`).toBeDefined();
      return facetTone(facet.id);
    });
    expect(new Set(assigned).size).toBe(FACETS.length);
  });

  it('only assigns tones that exist', () => {
    for (const tone of [...Object.values(FACET_TONES), ...Object.values(ROUTE_TONES)]) {
      expect(TONES).toContain(tone);
    }
  });

  it('falls back to the accent for anything unmapped', () => {
    expect(facetTone('not-a-facet')).toBe('blue');
    expect(routeTone('/nowhere')).toBe('blue');
  });
});
