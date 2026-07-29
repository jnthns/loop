/**
 * Base-path-aware link builder.
 *
 * The site is deployed project-scoped at https://jnthns.github.io/loop/, so a
 * bare `/team` href 404s in production while working fine in dev. Every internal
 * link in the app goes through here.
 */

const RAW_BASE =
  typeof import.meta.env !== 'undefined' && import.meta.env.BASE_URL
    ? import.meta.env.BASE_URL
    : '/';

/** The site base with exactly one leading slash and no trailing slash ('' at root). */
export function baseSegment(base: string = RAW_BASE): string {
  const trimmed = base.replace(/\/+$/, '');
  if (trimmed === '' || trimmed === '/') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/** Build an internal href: href('/team') -> '/loop/team'. */
export function href(path: string, base: string = RAW_BASE): string {
  const suffix = path.replace(/^\/+/, '');
  const root = baseSegment(base);
  return suffix === '' ? `${root}/` : `${root}/${suffix}`;
}

/**
 * True when `current` is on the `target` route — used for nav highlighting.
 * Exact match for the dashboard, prefix match elsewhere, so
 * /knowledge/trading/xyz still lights up "Knowledge".
 */
export function isActive(current: string, target: string, base: string = RAW_BASE): boolean {
  const strip = (p: string) => {
    const root = baseSegment(base);
    const withoutBase = root && p.startsWith(root) ? p.slice(root.length) : p;
    const normalized = withoutBase.replace(/\/+$/, '');
    return normalized === '' ? '/' : normalized;
  };
  const here = strip(current);
  const there = strip(target);
  return there === '/' ? here === '/' : here === there || here.startsWith(`${there}/`);
}
