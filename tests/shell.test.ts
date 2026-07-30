import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guards on the app shell.
 *
 * Two of the spec's acceptance criteria are properties of every page rather than
 * of any one component — the news panel must be present everywhere, and no
 * internal link may be root-absolute (the site is served under /loop/). Both are
 * cheap to assert against the source and would otherwise only surface in
 * production.
 */

const PAGES_DIR = join(process.cwd(), 'src/pages');
const LAYOUT = join(process.cwd(), 'src/layouts/BaseLayout.astro');

function astroFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith('.astro'))
    .map((e) => join(e.parentPath ?? dir, e.name));
}

const pages = astroFiles(PAGES_DIR);

describe('app shell', () => {
  it('finds page files to check', () => {
    expect(pages.length).toBeGreaterThan(0);
  });

  it('mounts the news panel once, in the shared layout', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toContain('<NewsPanel');
    expect(layout).toContain('client:load');
  });

  it('mounts a theme toggle and FOUC-safe theme bootstrap', () => {
    const layout = readFileSync(LAYOUT, 'utf8');
    expect(layout).toContain('<ThemeToggle');
    expect(layout).toContain("dynasty-guide:theme");
    expect(layout).toContain('dataset.theme');
  });

  it.each(pages)('%s renders through BaseLayout', (page) => {
    const source = readFileSync(page, 'utf8');
    expect(source).toContain('BaseLayout');
  });

  it.each(pages)('%s uses no root-absolute internal links', (page) => {
    const source = readFileSync(page, 'utf8');
    // href="/foo" bypasses the base path; href={href('/foo')} is correct.
    const offenders = source.match(/href="\/(?!\/)[^"]*"/g) ?? [];
    expect(offenders).toEqual([]);
  });
});

describe('base path', () => {
  it('is configured for project-scoped Pages', () => {
    const config = readFileSync(join(process.cwd(), 'astro.config.mjs'), 'utf8');
    expect(config).toMatch(/base:\s*'\/loop'/);
  });
});
