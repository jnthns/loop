import { NFL_TEAMS } from '~/lib/news/normalize';
import type { NewsItem } from '~/lib/schemas/news';

/**
 * Canonical form of a headline for syndication dedupe.
 * Same story from ESPN and Yahoo often differs only by source, not title.
 */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DedupeByTitleOptions {
  /** When titles collide, keep the item with the later publishedAt. */
  strategy?: 'newest' | 'first';
}

/**
 * Collapse items that share the same normalized title.
 * Input order matters for `first`; for `newest`, the latest publishedAt wins.
 */
export function dedupeByTitle(
  items: NewsItem[],
  options: DedupeByTitleOptions = {},
): NewsItem[] {
  const { strategy = 'newest' } = options;
  const byTitle = new Map<string, NewsItem>();

  for (const item of items) {
    const key = normalizeTitle(item.title);
    if (!key) continue;

    const prior = byTitle.get(key);
    if (!prior) {
      byTitle.set(key, item);
      continue;
    }

    if (strategy === 'first') continue;

    if (item.publishedAt.localeCompare(prior.publishedAt) > 0) {
      byTitle.set(key, item);
    }
  }

  return items.filter((item) => {
    const key = normalizeTitle(item.title);
    if (!key) return true;
    return byTitle.get(key)?.id === item.id;
  });
}

/**
 * One story per player.
 *
 * The feeds are heavily syndicated: a single Najee Harris carry count shows up
 * as sixteen items across ESPN, the team site, and three aggregators, each with
 * its own headline, so `dedupeByTitle` never collapses them. Reading the rail
 * then means scrolling past the same fact five times to find the next one.
 *
 * The rule is deliberately blunt: walking the list in order, an item is kept
 * only if it is the first thing said about at least one of the players it
 * mentions. Everything that item mentions is then marked as covered, so a
 * two-player story counts as the story for both. "First" is resolved by
 * publication time rather than by argument order, so the copy that survives is
 * the latest one whatever order the caller happens to hold the list in.
 *
 * Items that mention no player at all are league-wide reporting rather than
 * repetition, so they survive — collapsed by headline (the syndication case
 * `dedupeByTitle` does handle) unless that is turned off.
 */

/**
 * Words that are capitalized in a headline without naming a person: teams and
 * their cities, position abbreviations, and the furniture of sports copy. A
 * candidate made only of these is not a subject.
 */
const NOT_A_NAME = new Set(
  [
    ...Object.keys(NFL_TEAMS),
    ...Object.values(NFL_TEAMS),
    'Arizona', 'Atlanta', 'Baltimore', 'Buffalo', 'Carolina', 'Chicago', 'Cincinnati',
    'Cleveland', 'Dallas', 'Denver', 'Detroit', 'Green', 'Bay', 'Houston', 'Indianapolis',
    'Jacksonville', 'Kansas', 'City', 'Las', 'Vegas', 'Los', 'Angeles', 'Miami', 'Minnesota',
    'New', 'England', 'Orleans', 'York', 'Philadelphia', 'Pittsburgh', 'San', 'Francisco',
    'Seattle', 'Tampa', 'Bay', 'Tennessee', 'Washington',
    'QB', 'RB', 'WR', 'TE', 'OL', 'OT', 'OG', 'DL', 'DE', 'DT', 'LB', 'CB', 'S', 'DB', 'K', 'P',
    'C', 'G', 'T', 'FB', 'FS', 'SS', 'NT', 'EDGE', 'OLB', 'ILB', 'MLB', 'LS', 'KR', 'PR',
    'NFL', 'NFC', 'AFC', 'IR', 'PUP', 'MVP', 'ESPN', 'Week', 'Report', 'Sources', 'Source',
    'Fantasy', 'Football', 'Dynasty', 'Rankings', 'Waiver', 'Wire', 'Start', 'Sit', 'Draft',
    'Trade', 'Injury', 'Injuries', 'News', 'Notes', 'Preseason', 'Season', 'Sunday', 'Monday',
    'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Super', 'Bowl', 'Pro', 'All',
    'Ball', 'Best', 'Value', 'Chart', 'Update', 'Updates', 'Preview', 'Recap', 'Roundup',
    'Analysis', 'Takeaways', 'Winners', 'Losers', 'Camp', 'Training', 'Practice', 'Board',
    'Depth', 'Live', 'Big', 'Em', 'Team', 'Teams', 'Player', 'Players', 'Free', 'Agent',
    'Agents', 'Roster', 'Cut', 'Cuts', 'Deal', 'Deals', 'Contract', 'Return', 'Debut', 'Game',
    'Games', 'Notebook', 'Buzz', 'Rumors', 'Watch', 'List', 'Guide', 'Podcast', 'Breaking',
    'Exclusive', 'Opinion', 'Column', 'Video', 'Photos', 'Podcasts',
  ].map((w) => w.toLowerCase()),
);

/** Initialisms — ACL, MRI, PUP — read as name tokens but never name a person. */
const INITIALISM = /^[A-Z]{2,4}$/;

/** A token that could be part of a person's name: capitalized, letters only. */
const NAME_TOKEN = /^[A-Z][\p{L}'’.-]*$/u;

/**
 * The person a headline is about, when the item carries no tagged player.
 *
 * The player tags only cover names in `data/players.json` — the league's own
 * pool — so a cornerback signing reaches the feed untagged and arrives three
 * times over from three outlets, each with its own wording. Pulling the name
 * out of the headline gives those items a subject to collapse on.
 *
 * Deliberately conservative: it takes runs of capitalized words, drops the ones
 * that are teams, cities, positions or sports-page furniture, and accepts what
 * is left only if it is two or three words long. Anything else returns null and
 * the item is treated as having no subject at all — a missed collapse is a
 * duplicate row, while a wrong one hides a story that was never a duplicate.
 */
export function headlineSubject(title: string): string | null {
  const tokens = title.split(/[\s,:;—–|()"]+/u).filter(Boolean);

  let run: string[] = [];
  const runs: string[][] = [];
  for (const token of tokens) {
    if (NAME_TOKEN.test(token)) run.push(token);
    else {
      if (run.length > 0) runs.push(run);
      run = [];
    }
  }
  if (run.length > 0) runs.push(run);

  for (const candidate of runs) {
    const name = candidate.filter(
      (t) => !NOT_A_NAME.has(t.toLowerCase()) && !INITIALISM.test(t),
    );
    if (name.length < 2 || name.length > 3) continue;
    return name.join(' ').toLowerCase();
  }
  return null;
}

export interface DedupeByPlayerOptions {
  /** Also collapse identical headlines among items that name no player. */
  collapseUntaggedTitles?: boolean;
}

export function dedupeByPlayer(
  items: NewsItem[],
  options: DedupeByPlayerOptions = {},
): NewsItem[] {
  const { collapseUntaggedTitles = true } = options;
  const covered = new Set<string>();
  const untagged: NewsItem[] = [];
  const keep = new Set<string>();

  const newestFirst = [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  for (const item of newestFirst) {
    // Tagged ids first; failing that, the person the headline names. The second
    // is what catches everyone outside this league's player pool — a corner
    // signing somewhere else is still one story, however many outlets ran it.
    const subject = item.players.length > 0 ? item.players : subjectKeys(item);
    if (subject.length === 0) {
      untagged.push(item);
      continue;
    }
    if (subject.some((id) => !covered.has(id))) keep.add(item.id);
    for (const id of subject) covered.add(id);
  }

  const survivingUntagged = collapseUntaggedTitles ? dedupeByTitle(untagged) : untagged;
  for (const item of survivingUntagged) keep.add(item.id);

  return items.filter((item) => keep.has(item.id));
}

/**
 * The default view of the feed: at most one item per player, and no repeated
 * headline among what is left. This is what every news surface shows unless the
 * reader explicitly asks to see every source.
 */
function subjectKeys(item: NewsItem): string[] {
  const subject = headlineSubject(item.title);
  return subject ? [`headline:${subject}`] : [];
}

export function uniqueStories(items: NewsItem[]): NewsItem[] {
  return dedupeByPlayer(items);
}
