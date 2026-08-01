import { describe, expect, it } from 'vitest';
import { HttpsUrlSchema, toHttpsUrl } from '~/lib/schemas/url';
import { canonicalUrl } from '~/lib/news/normalize';
import { NewsItemSchema } from '~/lib/schemas/news';

/**
 * News URLs are third-party input: they come from RSS feeds, are committed to
 * data/news.json by CI, and render straight into an href on every page. Before
 * this was enforced, `z.url()` accepted `javascript:` and `data:`, so a hostile
 * or compromised feed could have stored a script URL in the repo.
 */
describe('URL scheme enforcement', () => {
  const HOSTILE = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'ftp://example.com/x',
  ];

  it.each(HOSTILE)('rejects %s at the schema boundary', (raw) => {
    expect(HttpsUrlSchema.safeParse(raw).success).toBe(false);
  });

  it.each(HOSTILE)('refuses to canonicalize %s into a storable url', (raw) => {
    expect(canonicalUrl(raw)).toBe('');
  });

  it('rejects plaintext http at the schema boundary', () => {
    expect(HttpsUrlSchema.safeParse('http://example.com/x').success).toBe(false);
  });

  it('accepts ordinary https urls', () => {
    expect(HttpsUrlSchema.safeParse('https://example.com/a?b=c').success).toBe(true);
  });

  it('rejects a relative or malformed url', () => {
    expect(HttpsUrlSchema.safeParse('/knowledge/trading').success).toBe(false);
    expect(HttpsUrlSchema.safeParse('not a url').success).toBe(false);
  });

  describe('toHttpsUrl', () => {
    it('upgrades http rather than dropping an ordinary article', () => {
      expect(toHttpsUrl('http://example.com/story')).toBe('https://example.com/story');
    });

    it('returns null for every non-http(s) scheme', () => {
      for (const raw of HOSTILE) expect(toHttpsUrl(raw)).toBeNull();
    });
  });

  it('upgrades http to https when canonicalizing a feed link', () => {
    expect(canonicalUrl('http://example.com/story/')).toBe('https://example.com/story');
  });

  // The write-side and read-side halves have to agree: a URL the normalizer
  // refuses must also be one the schema refuses, so a bad item is dropped by
  // safeParse in the ingest loop rather than being stored with an empty url.
  it('drops a news item whose url was refused', () => {
    const candidate = {
      id: 'x',
      title: 'Hostile',
      url: canonicalUrl('javascript:alert(1)'),
      source: 'Feed',
      sourceId: 'feed',
      publishedAt: '2026-07-30T00:00:00.000Z',
    };
    expect(NewsItemSchema.safeParse(candidate).success).toBe(false);
  });
});
