import { XMLParser } from 'fast-xml-parser';
import type { Feed, NewsItem } from '~/lib/schemas/news';
import { NewsItemSchema } from '~/lib/schemas/news';

/**
 * Feed XML -> normalized news items.
 *
 * Handles RSS 2.0 and Atom because the registry mixes both (Reddit serves Atom,
 * most sports desks serve RSS). Everything here is pure and runs against
 * fixtures in tests — the network lives in scripts/fetch-news.ts alone.
 */

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return text((value as Record<string, unknown>)['#text']);
  }
  return '';
}

/** Strip HTML and collapse whitespace — feed summaries are full of markup. */
export function stripHtml(input: string): string {
  return input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Canonical form of a URL — tracking params and fragments dropped, trailing
 * slash normalized. This is what item ids hash, so the same story fetched twice
 * from two feeds collapses to one item.
 */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      // ESPN uses ex_cid, Yahoo uses .tsrc, most others use utm_*. Any of them
      // would otherwise split one story into several "distinct" items.
      if (/^(utm_|ref|ref_src|ref_url|cmp|icid|smid|ex_cid|\.tsrc|src|source)$|^utm/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.search = url.searchParams.toString() ? `?${url.searchParams.toString()}` : '';
    const path = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${path}${url.search}`;
  } catch {
    return raw.trim();
  }
}

/** Stable, short, deterministic id derived from the canonical URL. */
export function newsId(url: string): string {
  const canonical = canonicalUrl(url);
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < canonical.length; i += 1) {
    const c = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 + c, 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(36)}${h2.toString(36)}`.padStart(12, '0');
}

function toIso(value: string, fallback: Date): string {
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return fallback.toISOString();
}

interface RawEntry {
  title: string;
  link: string;
  summary: string;
  published: string;
}

function rssEntries(channel: Record<string, any>): RawEntry[] {
  return asArray(channel.item).map((item: Record<string, any>) => ({
    title: stripHtml(text(item.title)),
    link: text(item.link) || text(item.guid),
    summary: stripHtml(text(item.description) || text(item['content:encoded'])),
    published: text(item.pubDate) || text(item['dc:date']),
  }));
}

function atomEntries(feed: Record<string, any>): RawEntry[] {
  return asArray(feed.entry).map((entry: Record<string, any>) => {
    const links = asArray(entry.link);
    const alternate =
      links.find((l: any) => l?.['@rel'] === 'alternate' || l?.['@rel'] === undefined) ?? links[0];
    return {
      title: stripHtml(text(entry.title)),
      link: typeof alternate === 'object' ? String(alternate['@href'] ?? '') : text(alternate),
      summary: stripHtml(text(entry.summary) || text(entry.content)),
      published: text(entry.published) || text(entry.updated),
    };
  });
}

export interface ParseOptions {
  /** Fallback timestamp for entries with no usable date. */
  now?: Date;
  /** Enrichment inputs — see tagItem(). */
  players?: { id: string; name: string }[];
}

/**
 * Parse one feed document into validated news items. Unparseable entries are
 * dropped rather than throwing: one malformed item must not lose a whole fetch.
 */
export function parseFeed(xml: string, feed: Feed, options: ParseOptions = {}): NewsItem[] {
  const now = options.now ?? new Date();
  let doc: Record<string, any>;
  try {
    doc = parser.parse(xml);
  } catch {
    return [];
  }

  const raw: RawEntry[] = doc?.rss?.channel
    ? rssEntries(doc.rss.channel)
    : doc?.feed
      ? atomEntries(doc.feed)
      : doc?.['rdf:RDF']
        ? rssEntries(doc['rdf:RDF'])
        : [];

  const items: NewsItem[] = [];
  for (const entry of raw) {
    if (!entry.title || !entry.link) continue;
    const url = canonicalUrl(entry.link);
    const candidate = {
      id: newsId(url),
      title: entry.title,
      url,
      source: feed.name,
      sourceId: feed.id,
      publishedAt: toIso(entry.published, now),
      summary: entry.summary.slice(0, 400),
      tags: [feed.category],
      players: [],
      teams: [],
    };
    const parsed = NewsItemSchema.safeParse(candidate);
    if (!parsed.success) continue;
    const enriched = enrich(parsed.data, options.players ?? []);
    if (isFantasyRelevant(enriched)) items.push(enriched);
  }
  return items;
}

/** NFL team names -> abbreviations, for tagging items by team. */
export const NFL_TEAMS: Record<string, string> = {
  Cardinals: 'ARI',
  Falcons: 'ATL',
  Ravens: 'BAL',
  Bills: 'BUF',
  Panthers: 'CAR',
  Bears: 'CHI',
  Bengals: 'CIN',
  Browns: 'CLE',
  Cowboys: 'DAL',
  Broncos: 'DEN',
  Lions: 'DET',
  Packers: 'GB',
  Texans: 'HOU',
  Colts: 'IND',
  Jaguars: 'JAX',
  Chiefs: 'KC',
  Raiders: 'LV',
  Chargers: 'LAC',
  Rams: 'LAR',
  Dolphins: 'MIA',
  Vikings: 'MIN',
  Patriots: 'NE',
  Saints: 'NO',
  Giants: 'NYG',
  Jets: 'NYJ',
  Eagles: 'PHI',
  Steelers: 'PIT',
  Seahawks: 'SEA',
  '49ers': 'SF',
  Buccaneers: 'TB',
  Titans: 'TEN',
  Commanders: 'WAS',
};

/** Keyword tags worth surfacing — dynasty managers scan for these. */
const KEYWORD_TAGS: [RegExp, string][] = [
  [/\b(injur(?:y|ed|ies)?|hamstring|acl|concussion|ir\b|out for the season|tweaked|strain|sprain|torn|fracture|surgery|carted|helped off|pup\b|nfi\b)/i, 'injury'],
  [/\b(trade|traded|acquire[sd]?|trade request)\b/i, 'trade'],
  [/\b(sign(s|ed|ing)?|contract|extension|restructure|hold-?in|holdout)\b/i, 'contract'],
  [/\b(draft|rookie|combine|prospect)\b/i, 'rookie'],
  [/\b(suspend|suspension|arrest)\b/i, 'discipline'],
  [/\b(waive[ds]?|release[ds]?|cut|claimed|workout for|placed on)\b/i, 'roster-move'],
  [
    /\b(starter|depth chart|snap count|snap share|target share|workload|first-team|named starter|starting role|with the (offense|defense))\b/i,
    'usage',
  ],
  [
    /\b(not participating|skipped practice|missed practice|full go|full speed|cleared to return|activated|deactivated|ruled out|questionable|doubtful|dnp\b|limited participant|unlikely to be ready|practices for|ready for week)\b/i,
    'availability',
  ],
];

/** Tags that mean the item may affect roster or player output. */
const ACTIONABLE_TAGS = new Set([
  'injury',
  'trade',
  'contract',
  'discipline',
  'roster-move',
  'usage',
  'availability',
]);

/**
 * Headlines that name a player but carry no roster, health, or usage signal —
 * praise pieces, human-interest stories, betting roundups, community threads.
 */
const NOISE_PATTERNS: RegExp[] = [
  /\bwants to be remembered\b/i,
  /\bhas it all\b/i,
  /\bcan become the best\b/i,
  /\bbetting preview\b/i,
  /\bodds:\s/i,
  /\bmegathread\b/i,
  /\bAMA\b/,
  /\bdaily links\b/i,
  /\bmorning briefing\b/i,
  /\bopen thread\b/i,
  /\bsleepers.*busts.*predictions\b/i,
  /\breading the tea leaves\b/i,
  /\bresponds to criticism\b/i,
  /\bclerical error\b/i,
  /\bred helmets\b/i,
  /\blotteries run\b/i,
  /\b(dynasty|fantasy) community\b/i,
  /\bis it time to (buy|sell)\b/i,
  /\bdraft pick value\b/i,
  /\btraining camp:\s*latest intel\b/i,
  /\bposition battles to watch\b/i,
  /\badvanced stats to know\b/i,
  /\bcan'?t afford to have someone trip\b/i,
  /\bwhich .{0,40} starter do we see first\b/i,
  /\bwhy .{0,40} expects\b/i,
  /\bfinal season with\b/i,
  /\bsounds nice, but probably isn'?t happening\b/i,
];

/** Extra prose signals when tagging missed an obvious event. */
const RELEVANCE_SIGNALS: RegExp[] = [
  /\b(helped off the field|carted into|not putting any weight on)\b/i,
  /\b(qb battle|position battle)\b/i,
  /\b(will start|expected to start|won'?t start)\b/i,
  /\b(in a .{0,12} jersey with the (offense|defense))\b/i,
  /\b(failed physical|landed on)\b/i,
];

/**
 * True when an item reports something that can change playing time, health,
 * or roster status — not puff pieces or fantasy-community chatter.
 */
export function isFantasyRelevant(item: NewsItem): boolean {
  const haystack = `${item.title} ${item.summary}`;
  if (NOISE_PATTERNS.some((re) => re.test(haystack))) return false;

  const actionableTags = item.tags.filter((t) => ACTIONABLE_TAGS.has(t));
  if (actionableTags.length > 0) return true;

  if (RELEVANCE_SIGNALS.some((re) => re.test(haystack))) return true;

  // "Rookie" alone often means dynasty meta, not a camp report — require usage context.
  if (item.tags.includes('rookie') && /\b(first-team|practice|participat|camp|starter|depth chart|injur|out|limited)\b/i.test(haystack)) {
    return true;
  }

  return false;
}

/** Attach players, teams, and keyword tags to an item from its text. */
export function enrich(item: NewsItem, players: { id: string; name: string }[]): NewsItem {
  const haystack = `${item.title} ${item.summary}`;

  const matchedPlayers = players
    .filter((p) => haystack.toLowerCase().includes(p.name.toLowerCase()))
    .map((p) => p.id);

  const matchedTeams = Object.entries(NFL_TEAMS)
    .filter(([name]) => new RegExp(`\\b${name}\\b`, 'i').test(haystack))
    .map(([, abbr]) => abbr);

  const keywordTags = KEYWORD_TAGS.filter(([re]) => re.test(haystack)).map(([, tag]) => tag);

  return {
    ...item,
    players: [...new Set(matchedPlayers)],
    teams: [...new Set(matchedTeams)],
    tags: [...new Set([...item.tags, ...keywordTags, ...matchedTeams])],
  };
}
