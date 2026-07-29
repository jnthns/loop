import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FACETS, isFacetId } from '~/lib/knowledge/facets';

/**
 * The knowledge base is written unattended by the curator loop, so its integrity
 * has to be a test rather than a convention. The load-bearing assertion is the
 * source requirement: an article that cites nothing must fail the build.
 *
 * Frontmatter is read straight off disk rather than through astro:content so
 * these run in plain Vitest, without an Astro build.
 */

const CONTENT = join(process.cwd(), 'src/content/knowledge');

function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.md'))
    .map((e) => join(e.parentPath ?? dir, e.name));
}

interface Article {
  path: string;
  /** Path relative to the collection root, e.g. 'trading/trade-value-frameworks.md'. */
  rel: string;
  frontmatter: string;
  body: string;
}

const articles: Article[] = markdownFiles(CONTENT).map((path) => {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  return {
    path,
    rel: relative(CONTENT, path),
    frontmatter: match?.[1] ?? '',
    body: match?.[2] ?? raw,
  };
});

const field = (a: Article, name: string) =>
  a.frontmatter.match(new RegExp(`^${name}:\\s*(.*)$`, 'm'))?.[1]?.trim() ?? '';

/** Count `- label:` entries under the `sources:` key. */
function sourceCount(a: Article): number {
  const block = a.frontmatter.split(/^sources:\s*$/m)[1];
  if (!block) return 0;
  return (block.match(/^\s+-\s+label:/gm) ?? []).length;
}

describe('knowledge collection', () => {
  it('has articles to check', () => {
    expect(articles.length).toBeGreaterThan(0);
  });

  it.each(articles.map((a) => [a.rel, a] as const))('%s has frontmatter', (_rel, article) => {
    expect(article.frontmatter).not.toBe('');
  });

  it.each(articles.map((a) => [a.rel, a] as const))(
    '%s cites at least one source',
    (_rel, article) => {
      expect(sourceCount(article)).toBeGreaterThanOrEqual(1);
    },
  );

  it.each(articles.map((a) => [a.rel, a] as const))(
    '%s gives every source a URL',
    (_rel, article) => {
      const labels = (article.frontmatter.match(/^\s+-\s+label:/gm) ?? []).length;
      const urls = (article.frontmatter.match(/^\s+url:\s*https?:\/\//gm) ?? []).length;
      expect(urls).toBe(labels);
    },
  );

  it.each(articles.map((a) => [a.rel, a] as const))(
    '%s declares a known facet matching its directory',
    (_rel, article) => {
      const facet = field(article, 'facet');
      expect(isFacetId(facet), `unknown facet "${facet}"`).toBe(true);
      expect(article.rel.split('/')[0]).toBe(facet);
    },
  );

  it.each(articles.map((a) => [a.rel, a] as const))(
    '%s declares title, summary, confidence, and updated',
    (_rel, article) => {
      expect(field(article, 'title')).not.toBe('');
      expect(field(article, 'confidence')).toMatch(/^(low|medium|high)$/);
      expect(field(article, 'updated')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(article.frontmatter).toMatch(/^summary:/m);
    },
  );

  it.each(articles.map((a) => [a.rel, a] as const))('%s has a body', (_rel, article) => {
    expect(article.body.trim().length).toBeGreaterThan(200);
  });

  it('covers every facet — the index must show no empty facets', () => {
    const covered = new Set(articles.map((a) => a.rel.split('/')[0]));
    const missing = FACETS.map((f) => f.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
  });

  it('uses unique slugs within a facet', () => {
    const rels = articles.map((a) => a.rel);
    expect(new Set(rels).size).toBe(rels.length);
  });
});

describe('the source requirement is real', () => {
  // Guards the guard: if sourceCount ever stopped detecting a bare article,
  // every test above would pass vacuously.
  const bare: Article = {
    path: 'memory',
    rel: 'trading/invented.md',
    frontmatter: 'title: Invented\nfacet: trading\nconfidence: high\nupdated: 2026-01-01',
    body: 'A claim with nothing behind it.',
  };

  it('counts zero sources for an article that cites nothing', () => {
    expect(sourceCount(bare)).toBe(0);
  });
});
