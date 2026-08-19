import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATA_SOURCES, KNOWN_HOSTS, REGISTERED_HOSTS, ATTRIBUTION_REQUIRED } from '~/lib/data/sources';
import { FeedsSchema } from '~/lib/schemas/news';
import feeds from '../data/feeds.json';

/**
 * Provenance drift is silent, which is what makes it worth a mechanical check.
 *
 * Nobody adds an undocumented data source on purpose. What happens is that a
 * pass adds one `fetch()` to solve a real problem, the URL is obvious in
 * context, and eighteen months later nothing on the site can say where a number
 * came from or under what license it arrived. So: if code fetches a host,
 * `src/lib/data/sources.ts` has to name it. The registry stops being
 * documentation that rots and becomes something the check enforces.
 */

const ROOTS = ['scripts', 'src/lib'];

/** Hosts that are infrastructure rather than data — never rendered, never cited. */
const NOT_A_DATA_SOURCE = new Set([
  'registry.npmjs.org',
  'localhost',
  'example.com',
  'jnthns.github.io',
]);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * Hosts that appear in a string literal assigned to something fetch-shaped.
 *
 * Deliberately broad: it collects every https host in the file and lets the
 * allowlist below carve out the ones that are citations rather than fetches. A
 * check that under-reports here would defeat its own purpose.
 */
function hostsIn(source: string): string[] {
  const matches = source.matchAll(/https:\/\/([a-zA-Z0-9.-]+)/g);
  // Prose runs a URL into the sentence's full stop; strip it so
  // "see https://docs.sleeper.com." does not register as a distinct host.
  return [...matches].map((m) => m[1]!.replace(/\.+$/, ''));
}

const files = ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root)));

describe('data source registry', () => {
  it('finds the source files it is meant to be scanning', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('every host fetched by a sync is registered with its provenance', () => {
    const fetchers = files.filter((file) => /\bfetch\s*\(/.test(readFileSync(file, 'utf8')));
    expect(fetchers.length, 'expected to find files that fetch').toBeGreaterThan(0);

    const unregistered = new Map<string, string[]>();
    for (const file of fetchers) {
      for (const host of hostsIn(readFileSync(file, 'utf8'))) {
        if (NOT_A_DATA_SOURCE.has(host)) continue;
        if (KNOWN_HOSTS.includes(host)) continue;
        const at = unregistered.get(host) ?? [];
        at.push(file.replace(`${process.cwd()}/`, ''));
        unregistered.set(host, at);
      }
    }

    expect(
      Object.fromEntries(unregistered),
      'these hosts are fetched but absent from src/lib/data/sources.ts — register them with a license and a caveat',
    ).toEqual({});
  });

  it('every RSS feed we ship is covered by a registered source', () => {
    const parsed = FeedsSchema.parse(feeds);
    for (const feed of parsed) {
      const host = new URL(feed.url).hostname;
      expect(REGISTERED_HOSTS, `feed ${feed.id} (${host}) is not registered`).toContain(host);
    }
  });

  it('every source states what it provides, where it lands, and its caveat', () => {
    for (const source of DATA_SOURCES) {
      expect(source.provides.length, `${source.id} does not say what it provides`).toBeGreaterThan(20);
      expect(source.caveat.length, `${source.id} has no caveat — every source has one`).toBeGreaterThan(20);
      expect(source.writesTo.length, `${source.id} writes to nothing`).toBeGreaterThan(0);
      for (const file of source.writesTo) expect(file.startsWith('data/')).toBe(true);
      expect(source.url.startsWith('https://')).toBe(true);
    }
  });

  it('ids and hosts are unique, so provenance is never ambiguous', () => {
    const ids = DATA_SOURCES.map((s) => s.id);
    expect(ids).toHaveLength(new Set(ids).size);
    const hosts = DATA_SOURCES.flatMap((s) => s.hosts);
    expect(hosts, 'two sources claim the same host').toHaveLength(new Set(hosts).size);
    // A host we fetch must never also be listed as citation-only somewhere else.
    const cited = DATA_SOURCES.flatMap((s) => s.citedHosts ?? []);
    expect(cited.filter((h) => REGISTERED_HOSTS.includes(h))).toEqual([]);
  });

  it('knows which licenses oblige a visible credit', () => {
    // nflverse is CC-BY-4.0: attribution is a license term, not a courtesy, and
    // it is discharged by rendering — see PicksApp's attribution block.
    const nflverse = DATA_SOURCES.find((s) => s.id === 'nflverse')!;
    expect(nflverse.license).toBe('CC-BY-4.0');
    expect(nflverse.attributionRequired).toBe(true);
    expect(ATTRIBUTION_REQUIRED.map((s) => s.id)).toContain('nflverse');

    for (const source of ATTRIBUTION_REQUIRED) {
      expect(source.label.length, `${source.id} needs a credit-worthy label`).toBeGreaterThan(3);
    }
  });

  it('names the undocumented endpoint as undocumented rather than burying it', () => {
    const espn = DATA_SOURCES.find((s) => s.id === 'espn-api')!;
    expect(espn.stability).toBe('undocumented');
    expect(espn.caveat).toMatch(/undocumented/i);
  });
});
