/**
 * Every upstream this app pulls from, in one auditable place.
 *
 * Two things go wrong with data provenance in a project like this, and both are
 * silent:
 *
 *   1. **A license obligation goes unmet.** nflverse publishes under CC-BY-4.0,
 *      which requires attribution wherever the work is used. Crediting it in a
 *      code comment does not discharge that — the obligation is to the person
 *      reading the site, so the credit has to render. Every `DC1` badge in this
 *      app is nflverse data.
 *   2. **A new fetch appears and nobody records where it came from.** Six
 *      months later "where does this number come from?" has no answer.
 *      `tests/sources.test.ts` fails the build if a host is fetched anywhere in
 *      `scripts/` or `src/lib/` and is not registered here, which turns the
 *      documentation into something the check enforces rather than something
 *      that rots.
 *
 * The `stability` field is the honest part. Not every source here is equal: two
 * are versioned open datasets, one is an official public API, and one is an
 * undocumented endpoint that happens to answer. Ranking them by that rather
 * than by how useful they are is what stops the weakest link being invisible.
 */

export type SourceStability =
  /** Open dataset, public repo, documented schema, maintained on a cadence. */
  | 'open-dataset'
  /** Official, documented, publicly-offered API. */
  | 'official-api'
  /** Publicly published feed intended for syndication. */
  | 'public-feed'
  /** Works, but is undocumented and carries no stability promise. */
  | 'undocumented';

export interface DataSource {
  id: string;
  label: string;
  /** Where a reader can verify the source themselves. */
  url: string;
  /** Hosts we actually make requests to. */
  hosts: string[];
  /**
   * Hosts that appear in our citation links but are never fetched.
   *
   * Kept separate from `hosts` on purpose: linking to FantasyPros as the
   * upstream of the DynastyProcess columns is a very different act from pulling
   * bytes off their servers, and collapsing the two would misdescribe what this
   * app does. The drift check accepts either, so a citation never has to be
   * disguised as a fetch to satisfy it.
   */
  citedHosts?: string[];
  /** What we actually take. Kept specific: "everything" is how scope creeps. */
  provides: string;
  /** Which committed file it lands in. */
  writesTo: string[];
  license: string;
  licenseUrl: string | null;
  /** True when the license obliges us to display credit, not merely to know it. */
  attributionRequired: boolean;
  stability: SourceStability;
  /** How often the refresh job re-pulls it, and how fresh the upstream itself is. */
  cadence: string;
  /** The honest caveat. Every source has one. */
  caveat: string;
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'dynastyprocess',
    label: 'DynastyProcess — open dynasty dataset',
    url: 'https://github.com/dynastyprocess/data',
    hosts: ['raw.githubusercontent.com'],
    // FantasyPros is where the ECR and the value curve ultimately come from, so
    // it is cited on the page — but we take it via DynastyProcess and never
    // request anything from fantasypros.com ourselves.
    citedHosts: ['www.fantasypros.com'],
    provides:
      'FantasyPros Expert Consensus Rank (1QB and superflex) and DynastyProcess’s own trade-value model, plus the cross-platform player id crosswalk.',
    writesTo: ['data/market.json'],
    license: 'GPL-3.0',
    licenseUrl: 'https://github.com/dynastyprocess/data/blob/master/LICENSE',
    attributionRequired: false,
    stability: 'open-dataset',
    cadence: 'Pulled every 6h; upstream re-scrapes roughly weekly.',
    caveat:
      'A small project (about 100 stars) and a single point of failure for both the ranking and the value columns. Its value model is derived from the same FantasyPros consensus it publishes, so the two columns are one opinion, not two.',
  },
  {
    id: 'nflverse',
    label: 'nflverse — NFL depth charts',
    url: 'https://github.com/nflverse/nflverse-data',
    hosts: ['github.com'],
    provides: 'Each player’s rank on his NFL team’s published depth chart.',
    writesTo: ['data/depth.json'],
    license: 'CC-BY-4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    attributionRequired: true,
    stability: 'open-dataset',
    cadence: 'Pulled every 6h; upstream release asset rebuilds daily.',
    caveat:
      'A depth chart is opportunity, not talent, and August charts are conservative — a rookie who will start Week 1 is often listed second. A player with no entry is unlisted, which is not the same as buried.',
  },
  {
    id: 'sleeper',
    label: 'Sleeper — league, rosters, and platform rankings',
    url: 'https://docs.sleeper.com/',
    hosts: ['api.sleeper.app'],
    citedHosts: ['docs.sleeper.com', 'sleeper.com'],
    provides:
      'The real league (rosters, draft picks, FAAB), the player dump including Sleeper’s own search rank, and league-wide trending adds and drops.',
    writesTo: ['data/team.json', 'data/players.json', 'data/draft.json', 'data/trending.json'],
    license: 'Public read-only API, keyless',
    licenseUrl: 'https://docs.sleeper.com/',
    attributionRequired: false,
    stability: 'official-api',
    cadence: 'Pulled every 6h; the ~5MB player dump is gated to once a day.',
    caveat:
      'Search rank measures what Sleeper’s managers look up, which is attention rather than quality — it moves on news before it moves on merit. It is the only ranking here independent of the analyst consensus, which is exactly why it is worth carrying.',
  },
  {
    id: 'espn-api',
    label: 'ESPN — standings, injuries, and news',
    url: 'https://www.espn.com/nfl/',
    hosts: ['site.api.espn.com'],
    provides: 'Team standings, league-wide injury designations, and news articles.',
    writesTo: ['data/news.json'],
    license: 'No published terms for this endpoint',
    licenseUrl: null,
    attributionRequired: false,
    stability: 'undocumented',
    cadence: 'Pulled every 6h.',
    caveat:
      'The weakest link here: `site.api.espn.com` is an undocumented endpoint with no stability guarantee and no published terms of use. It can change shape or stop answering without notice. Nothing on the site should depend on it alone, and if it ever needs replacing, the RSS feed below covers the same ground.',
  },
  {
    id: 'rss',
    label: 'News feeds — ESPN, Pro Football Talk, CBS, Yahoo, r/DynastyFF, r/fantasyfootball',
    url: 'https://www.espn.com/espn/rss/nfl/news',
    hosts: [
      'www.espn.com',
      'profootballtalk.nbcsports.com',
      'www.cbssports.com',
      'sports.yahoo.com',
      'www.reddit.com',
    ],
    provides: 'Headlines and summaries, deduped and tagged against the player file.',
    writesTo: ['data/news.json'],
    license: 'Publisher RSS, intended for syndication',
    licenseUrl: null,
    attributionRequired: true,
    stability: 'public-feed',
    cadence: 'Pulled every 6h; the registry lives in data/feeds.json.',
    caveat:
      'Headlines and summaries only, always linked back to the publisher — we never reproduce an article body. Two of the six feeds are subreddits, so treat those items as community chatter rather than reporting.',
  },
];

/** Sources whose license obliges the rendered page to carry a credit. */
export const ATTRIBUTION_REQUIRED: DataSource[] = DATA_SOURCES.filter(
  (source) => source.attributionRequired,
);

/** Every host the app is allowed to fetch from, for the drift check. */
export const REGISTERED_HOSTS: string[] = [...new Set(DATA_SOURCES.flatMap((s) => s.hosts))];

/** Fetched hosts plus citation-only hosts — what the drift check accepts. */
export const KNOWN_HOSTS: string[] = [
  ...new Set(DATA_SOURCES.flatMap((s) => [...s.hosts, ...(s.citedHosts ?? [])])),
];
