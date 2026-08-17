import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARCHETYPE_IDS } from '~/lib/builds/archetypes';

/**
 * The builds collection is hand-written but still needs the same integrity
 * guarantees as the knowledge base: every file must cite real sources, and
 * the archetype <-> markdown mapping must be an exact bijection against
 * `ARCHETYPE_IDS`, since `src/content.config.ts` types `archetype` against
 * that same enum.
 *
 * Frontmatter is read straight off disk rather than through astro:content so
 * this runs in plain Vitest, without an Astro build.
 */

const CONTENT = join(process.cwd(), 'src/content/builds');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(dir, e.name));
}

interface Build {
  file: string;
  frontmatter: string;
  body: string;
}

const builds: Build[] = markdownFiles(CONTENT).map((file) => {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return {
    file,
    frontmatter: match?.[1] ?? '',
    body: match?.[2] ?? raw,
  };
});

const field = (b: Build, name: string) =>
  b.frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';

/** Collect `url:` values under the `sources:` key. */
function sourceUrls(b: Build): string[] {
  const block = b.frontmatter.split(/^sources:\s*$/m)[1];
  if (!block) return [];
  return [...block.matchAll(/^\s+url:\s*(\S+)\s*$/gm)].map((m) => m[1]);
}

/** Collect entries under a list key like `worksWhen:` or `failsWhen:`. */
function listEntries(b: Build, key: string): string[] {
  const re = new RegExp(`^${key}:\\s*\\n((?:\\s+-.*\\n?)*)`, 'm');
  const block = b.frontmatter.match(re)?.[1] ?? '';
  return [...block.matchAll(/^\s+-\s+(.*)$/gm)].map((m) => m[1]);
}

describe('builds collection', () => {
  it('has a file for every archetype', () => {
    expect(builds.length).toBe(ARCHETYPE_IDS.length);
  });

  it.each(builds.map((b) => [b.file, b] as const))('%s has frontmatter', (_file, build) => {
    expect(build.frontmatter).not.toBe('');
  });

  it.each(builds.map((b) => [b.file, b] as const))(
    '%s cites at least two sources, each with an https URL',
    (_file, build) => {
      const urls = sourceUrls(build);
      expect(urls.length).toBeGreaterThanOrEqual(2);
      for (const url of urls) {
        expect(url.startsWith('https://'), `${url} is not https`).toBe(true);
        expect(() => new URL(url)).not.toThrow();
      }
    },
  );

  it.each(builds.map((b) => [b.file, b] as const))(
    '%s declares title, tagline, thesis, confidence, and updated',
    (_file, build) => {
      expect(field(build, 'title')).not.toBe('');
      expect(field(build, 'tagline')).not.toBe('');
      expect(build.frontmatter).toMatch(/^thesis:/m);
      expect(field(build, 'confidence')).toMatch(/^(low|medium|high)$/);
      expect(field(build, 'updated')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it.each(builds.map((b) => [b.file, b] as const))(
    '%s has non-empty worksWhen and failsWhen',
    (_file, build) => {
      expect(listEntries(build, 'worksWhen').length).toBeGreaterThan(0);
      expect(listEntries(build, 'failsWhen').length).toBeGreaterThan(0);
    },
  );

  it.each(builds.map((b) => [b.file, b] as const))('%s has a body', (_file, build) => {
    expect(build.body.trim().length).toBeGreaterThan(200);
  });

  it('maps every ARCHETYPE_IDS entry to exactly one file (bijection)', () => {
    const declared = builds.map((b) => field(b, 'archetype'));
    const declaredSet = new Set(declared);

    // Every declared archetype is a real id.
    for (const id of declared) {
      expect((ARCHETYPE_IDS as readonly string[]).includes(id), `unknown archetype "${id}"`).toBe(true);
    }

    // No duplicates.
    expect(declaredSet.size).toBe(declared.length);

    // Every id is covered.
    for (const id of ARCHETYPE_IDS) {
      expect(declaredSet.has(id), `no build file declares archetype "${id}"`).toBe(true);
    }
  });
});
