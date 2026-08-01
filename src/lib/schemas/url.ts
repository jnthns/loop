import { z } from 'zod';

/**
 * URL validation that actually constrains the scheme.
 *
 * `z.url()` only asks whether the string parses as a URL, so it happily accepts
 * `javascript:alert(1)` and `data:text/html,...`. That matters here because news
 * URLs are not authored in this repo — they arrive from third-party RSS feeds,
 * get committed to `data/news.json` by CI, and are rendered straight into an
 * `href` in the news panel on every page. A hostile or compromised feed could
 * therefore have stored a script URL in the repo and had it clicked. Validating
 * the scheme at the boundary closes that off in the one place every URL passes
 * through, rather than trusting each render site to remember.
 *
 * https only, not http: everything this app cites is available over TLS, and a
 * plaintext link is both downgradeable and, from a page served over https,
 * mixed content.
 */
export const HttpsUrlSchema = z
  .string()
  .refine(
    (raw) => {
      try {
        return new URL(raw).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'must be an absolute https:// URL' },
  );

/**
 * Normalize an untrusted URL to https, or reject it.
 *
 * Upgrades `http:` rather than dropping the item — a plaintext feed link is
 * ordinary and its https form is what we want to store — but returns null for
 * every other scheme, so `javascript:`, `data:` and friends never reach disk.
 */
export function toHttpsUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol === 'https:') return parsed.toString();
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'https:';
    return parsed.toString();
  }
  return null;
}
