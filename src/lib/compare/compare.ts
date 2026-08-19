/**
 * Player-vs-player comparison, assembled from every upstream this app pulls.
 *
 * The naive version of this page is a table of numbers: four ranking columns
 * side by side, best number bolded. That table lies in two specific ways, and
 * both are avoided here on purpose.
 *
 *   1. **It manufactures agreement.** FantasyPros' consensus rank and
 *      DynastyProcess's trade value look like two analysts nodding at each
 *      other; they are one opinion expressed twice, because the value curve is
 *      derived from the same consensus (see `src/lib/schemas/market.ts`). So
 *      every row here declares the `family` it belongs to, and the page groups
 *      by family rather than listing columns flat. Sleeper's search rank is the
 *      only read here independent of the analyst consensus, which is why the
 *      headline verdict is built from exactly that disagreement.
 *   2. **It hides absence.** A blank cell and a bad number look alike once
 *      they are both grey. Every cell carries an explicit `value: null` plus a
 *      `display` of '—', and `missing` names, per player, which upstreams had
 *      nothing to say about him — an unlisted depth chart entry is not a
 *      third-string rank.
 *
 * Everything here is pure: the page passes committed data in, and the component
 * renders what comes back. No fetching, no dates from the clock.
 */

import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { NewsItem } from '~/lib/schemas/news';
import type { Player } from '~/lib/schemas/players';
import type { Profile } from '~/lib/schemas/profiles';
import type { Team } from '~/lib/schemas/team';
import type { Trending } from '~/lib/schemas/trending';

/** How many players fit side by side before the table stops being readable. */
export const MAX_COMPARE = 4;

/** How many news items to carry per player. Enough to show a trend, not a feed. */
export const NEWS_PER_PLAYER = 3;

/**
 * Which upstream a row's number comes from, and — the part that matters —
 * whether that upstream is independent of the others.
 */
export type SourceFamily = 'consensus' | 'independent' | 'opportunity' | 'context';

export interface FamilyMeta {
  id: SourceFamily;
  label: string;
  /** The honest framing of what this family can and cannot tell you. */
  note: string;
  /** False when the family shares an upstream with another family shown here. */
  independent: boolean;
  /** `DataSource.id` entries backing the family, for the credits block. */
  sourceIds: string[];
}

export const FAMILIES: FamilyMeta[] = [
  {
    id: 'consensus',
    label: 'Analyst consensus',
    note: 'FantasyPros’ expert consensus rank and the DynastyProcess trade value derived from it. Two columns, one opinion — read the value as a magnitude for the rank, never as a second vote.',
    independent: false,
    sourceIds: ['dynastyprocess'],
  },
  {
    id: 'independent',
    label: 'Sleeper — the independent read',
    note: 'Sleeper’s own search rank and league-wide add/drop counts. A different company measuring what its managers actually look up, so this is the only column that can genuinely disagree with the consensus. It moves on news before it moves on merit.',
    independent: true,
    sourceIds: ['sleeper'],
  },
  {
    id: 'opportunity',
    label: 'Opportunity — nflverse depth charts',
    note: 'Where each player is listed at his position on his NFL team’s published chart. Opportunity, not talent: a rookie who will start Week 1 is often still listed second in August.',
    independent: true,
    sourceIds: ['nflverse'],
  },
  {
    id: 'context',
    label: 'Context',
    note: 'Availability, league ownership, and how much has been written about each player lately.',
    independent: true,
    sourceIds: ['sleeper', 'rss', 'espn-api'],
  },
];

export type Direction = 'lower-better' | 'higher-better' | 'none';

export interface CompareCell {
  playerId: string;
  value: number | null;
  display: string;
  /** True when this is the best value in the row — never set on a `none` row. */
  leader: boolean;
}

export interface CompareRow {
  id: string;
  label: string;
  family: SourceFamily;
  /** `DataSource.id` this row's number comes from. */
  sourceId: string;
  /** What the number means, in one clause. */
  note: string;
  direction: Direction;
  cells: CompareCell[];
}

export interface ComparedPlayer {
  id: string;
  name: string;
  pos: string;
  nflTeam: string;
  /** Market's decimal age when it has one, the player file's integer otherwise. */
  age: number | null;
  tier: Player['tier'] | null;
  status: string | null;
  injuryStatus: string | null;
  /** Sleeper's search rank — lower means more looked-up. */
  sleeperRank: number | null;
  ecr: number | null;
  posEcr: number | null;
  value: number | null;
  /** valueSf / value1qb. Above 1 means this format inflates him. */
  sfPremium: number | null;
  depthRank: number | null;
  adds: number | null;
  drops: number | null;
  onMyRoster: boolean;
  isTarget: boolean;
  rosteredInLeague: boolean;
  profile: Profile | null;
  news: NewsItem[];
  /** 1-indexed placing inside this comparison by consensus rank. */
  consensusRank: number | null;
  /** 1-indexed placing inside this comparison by Sleeper search rank. */
  attentionRank: number | null;
  /**
   * Positive when Sleeper's managers rate him above where the analysts do,
   * relative to the others being compared. The only cross-source disagreement
   * on the row worth reading, because it is the only pair with no shared
   * upstream.
   */
  attentionGap: number | null;
  /** Registered sources that had nothing for this player, by `DataSource.id`. */
  missing: string[];
}

export interface Comparison {
  players: ComparedPlayer[];
  rows: CompareRow[];
  families: FamilyMeta[];
  /** Player id the consensus puts first, when it can separate them. */
  consensusLeader: string | null;
  /** Player id Sleeper's managers look up most. */
  attentionLeader: string | null;
  agreement: 'agree' | 'split' | 'unknown';
  /** One line naming what the sources do and do not agree on. */
  headline: string;
}

/** Everything the dossier builder needs — all of it committed data. */
export interface DossierInput {
  players: Player[];
  market: Market;
  trending: Trending;
  news: NewsItem[];
  profiles: Profile[];
  depthRankById: Record<string, number>;
  team: Team;
}

/**
 * The two facts about the league that change what a row means.
 *
 * Passed alongside the dossiers rather than re-derived, because the comparison
 * itself runs in the browser as the reader swaps players in and out, and the
 * league format is not something the browser should be guessing at.
 */
export interface CompareOptions {
  superflex: boolean;
  /** Sleeper's add/drop lookback window, straight from the snapshot. */
  lookbackHours: number;
}

// --- Joins ------------------------------------------------------------------

function nameKey(name: string, pos: string): string {
  return `${name.toLowerCase().replace(/[^a-z]/g, '')}|${pos.toUpperCase()}`;
}

/**
 * Market row for a player.
 *
 * The id join is the reliable one; the name join is the fallback for rows the
 * market sync could not tie to a slug. Fuzzy matching beyond exact name+position
 * is deliberately not attempted — a wrong join here would attribute one
 * player's ranking to another, which is worse than an empty cell.
 */
function marketRowFor(player: Player, market: Market): MarketPlayerRow | null {
  const byId = market.players.find((row) => row.playerId === player.id);
  if (byId) return byId;
  const key = nameKey(player.name, player.pos);
  return market.players.find((row) => nameKey(row.name, row.pos) === key) ?? null;
}

// --- Formatting -------------------------------------------------------------

function num(value: number | null, digits = 1): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function int(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '\u2014';
  return Math.round(value).toLocaleString('en-US');
}

/** 1-indexed placings for a set of values, ties sharing a placing. Nulls stay null. */
function placings(
  values: (number | null)[],
  direction: 'lower-better' | 'higher-better',
): (number | null)[] {
  const present = values.filter((v): v is number => v !== null);
  const sorted = [...present].sort((a, b) => (direction === 'lower-better' ? a - b : b - a));
  return values.map((v) => (v === null ? null : sorted.indexOf(v) + 1));
}

// --- Rows -------------------------------------------------------------------

interface RowSpec {
  id: string;
  label: string;
  family: SourceFamily;
  sourceId: string;
  note: string;
  direction: Direction;
  value: (p: ComparedPlayer) => number | null;
  display: (v: number | null) => string;
}

function rowSpecs(options: CompareOptions): RowSpec[] {
  const formatWord = options.superflex ? 'superflex' : '1QB';
  return [
    {
      id: 'ecr',
      label: `Expert consensus rank (${formatWord})`,
      family: 'consensus',
      sourceId: 'dynastyprocess',
      note: 'FantasyPros\u2019 dynasty ECR \u2014 the average of many analysts\u2019 boards. Lower is better.',
      direction: 'lower-better',
      value: (p) => p.ecr,
      display: (v) => num(v),
    },
    {
      id: 'posEcr',
      label: 'Consensus rank within position',
      family: 'consensus',
      sourceId: 'dynastyprocess',
      note: 'The same consensus, restricted to his own position \u2014 the only fair way to read a QB against a WR.',
      direction: 'lower-better',
      value: (p) => p.posEcr,
      display: (v) => num(v),
    },
    {
      id: 'value',
      label: `Trade value (${formatWord})`,
      family: 'consensus',
      sourceId: 'dynastyprocess',
      note: 'DynastyProcess\u2019s trade-value model, built from the consensus above. A magnitude for the same opinion, not a second one.',
      direction: 'higher-better',
      value: (p) => p.value,
      display: (v) => int(v),
    },
    {
      id: 'sfPremium',
      label: 'Superflex premium',
      family: 'consensus',
      sourceId: 'dynastyprocess',
      note: 'Superflex value divided by 1QB value. Above 1.00 means this format inflates him \u2014 descriptive, not better or worse.',
      direction: 'none',
      value: (p) => p.sfPremium,
      display: (v) => (v === null ? '\u2014' : `${v.toFixed(2)}\u00d7`),
    },
    {
      id: 'age',
      label: 'Age',
      family: 'consensus',
      sourceId: 'dynastyprocess',
      note: 'Dynasty is mostly an age bet, so younger leads the row \u2014 but a contending roster can want the older side of it.',
      direction: 'lower-better',
      value: (p) => p.age,
      display: (v) => num(v),
    },
    {
      id: 'sleeperRank',
      label: 'Sleeper search rank',
      family: 'independent',
      sourceId: 'sleeper',
      note: 'How high Sleeper\u2019s own managers look this player up. Attention rather than merit \u2014 and independent of every analyst column above.',
      direction: 'lower-better',
      value: (p) => p.sleeperRank,
      display: (v) => int(v),
    },
    {
      id: 'adds',
      label: `Leagues adding him (${options.lookbackHours}h)`,
      family: 'independent',
      sourceId: 'sleeper',
      note: 'League-wide adds across Sleeper. Blank means he is not among Sleeper\u2019s top movers, which is the normal case for a rostered star.',
      direction: 'higher-better',
      value: (p) => p.adds,
      display: (v) => int(v),
    },
    {
      id: 'drops',
      label: `Leagues dropping him (${options.lookbackHours}h)`,
      family: 'independent',
      sourceId: 'sleeper',
      note: 'The same feed in reverse. A drop spike is usually an injury the news below it will explain.',
      direction: 'lower-better',
      value: (p) => p.drops,
      display: (v) => int(v),
    },
    {
      id: 'depthRank',
      label: 'NFL depth-chart rank',
      family: 'opportunity',
      sourceId: 'nflverse',
      note: '1 is listed first at his position. Blank means nflverse does not list him at all, which is not the same as being buried.',
      direction: 'lower-better',
      value: (p) => p.depthRank,
      display: (v) => int(v),
    },
    {
      id: 'newsCount',
      label: 'Recent tagged news items',
      family: 'context',
      sourceId: 'rss',
      note: 'How many stories in the committed news snapshot name him. Volume, not sentiment \u2014 read the headlines below it.',
      direction: 'none',
      value: (p) => p.news.length,
      display: (v) => int(v),
    },
  ];
}

function buildRow(spec: RowSpec, players: ComparedPlayer[]): CompareRow {
  const values = players.map(spec.value);
  const present = values.filter((v): v is number => v !== null);
  // A leader on a single-entry row is a badge for showing up, so only mark one
  // when at least two players actually have the number and they differ.
  const best =
    spec.direction === 'none' || present.length < 2 || new Set(present).size === 1
      ? null
      : spec.direction === 'lower-better'
        ? Math.min(...present)
        : Math.max(...present);

  return {
    id: spec.id,
    label: spec.label,
    family: spec.family,
    sourceId: spec.sourceId,
    note: spec.note,
    direction: spec.direction,
    cells: players.map((player, i) => {
      const value = values[i] ?? null;
      return {
        playerId: player.id,
        value,
        display: spec.display(value),
        leader: best !== null && value === best,
      };
    }),
  };
}

// --- Dossiers ---------------------------------------------------------------

/**
 * Every player we can compare, with each upstream already joined on.
 *
 * Built once at page-build time rather than in the browser: the alternative is
 * shipping the whole market snapshot, the whole news file, and the depth chart
 * to the client so it can redo these joins on every checkbox click. The
 * comparison itself (`compare` below) is cheap and stays interactive.
 */
export function buildDossiers(input: DossierInput): ComparedPlayer[] {
  const addsById = new Map(input.trending.adds.map((t) => [t.playerId, t.count]));
  const dropsById = new Map(input.trending.drops.map((t) => [t.playerId, t.count]));
  const profileById = new Map(input.profiles.map((p) => [p.playerId, p]));
  const rosterIds = new Set(
    input.team.roster.map((slot) => slot.playerId).filter((id): id is string => Boolean(id)),
  );
  const targetIds = new Set(input.team.targets.map((t) => t.playerId));
  const sf = input.team.format.superflex;

  const newsByPlayer = new Map<string, NewsItem[]>();
  for (const item of input.news) {
    for (const id of item.players) {
      const list = newsByPlayer.get(id);
      if (list) list.push(item);
      else newsByPlayer.set(id, [item]);
    }
  }

  return input.players.map((player): ComparedPlayer => {
    const row = marketRowFor(player, input.market);
    const value = row ? (sf ? row.valueSf : row.value1qb) : null;
    const sfPremium =
      row && row.value1qb !== null && row.value1qb > 0 ? row.valueSf / row.value1qb : null;
    const news = (newsByPlayer.get(player.id) ?? [])
      .slice()
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, NEWS_PER_PLAYER);
    const depthRank = input.depthRankById[player.id] ?? null;

    // Named rather than inferred from an empty cell: "nflverse does not list
    // him" and "he is ranked badly" have to read differently on the page.
    const missing: string[] = [];
    if (!row) missing.push('dynastyprocess');
    if (player.rank === undefined) missing.push('sleeper');
    if (depthRank === null) missing.push('nflverse');
    if (news.length === 0) missing.push('rss');

    return {
      id: player.id,
      name: player.name,
      pos: player.pos,
      nflTeam: player.nflTeam,
      age: row?.age ?? player.age,
      tier: player.tier,
      status: player.status ?? null,
      injuryStatus: player.injuryStatus ?? null,
      sleeperRank: player.rank ?? null,
      ecr: row ? (sf ? row.ecrSf : row.ecr1qb) : null,
      posEcr: row?.posEcr ?? null,
      value,
      sfPremium,
      depthRank,
      adds: addsById.get(player.id) ?? null,
      drops: dropsById.get(player.id) ?? null,
      onMyRoster: rosterIds.has(player.id),
      isTarget: targetIds.has(player.id),
      rosteredInLeague: player.rosteredInLeague === true,
      profile: profileById.get(player.id) ?? null,
      news,
      consensusRank: null,
      attentionRank: null,
      attentionGap: null,
      missing,
    };
  });
}

// --- The comparison ---------------------------------------------------------

/**
 * Compare the chosen dossiers against each other.
 *
 * Pure and cheap, so the browser can re-run it on every selection change. It
 * never invents a number: placings and leaders come only from cells that are
 * actually filled in, and the headline says so out loud when they are not.
 */
export function compare(
  dossiers: ComparedPlayer[],
  playerIds: string[],
  options: CompareOptions,
): Comparison {
  const byId = new Map(dossiers.map((d) => [d.id, d]));
  const players = playerIds
    .slice(0, MAX_COMPARE)
    .map((id) => byId.get(id))
    .filter((d): d is ComparedPlayer => d !== undefined)
    // Copied so the placings written below never mutate the page-level dossiers,
    // which are shared across every comparison the reader builds.
    .map((d) => ({ ...d }));

  const consensusPlacings = placings(
    players.map((p) => p.ecr),
    'lower-better',
  );
  const attentionPlacings = placings(
    players.map((p) => p.sleeperRank),
    'lower-better',
  );
  players.forEach((player, i) => {
    player.consensusRank = consensusPlacings[i] ?? null;
    player.attentionRank = attentionPlacings[i] ?? null;
    player.attentionGap =
      player.consensusRank !== null && player.attentionRank !== null
        ? player.consensusRank - player.attentionRank
        : null;
  });

  const rows = rowSpecs(options).map((spec) => buildRow(spec, players));

  /**
   * Whoever this read puts first — but only when the read actually saw at least
   * two of these players. One ranked player and one it has never heard of is a
   * walkover, and calling that a leader is how the page would end up reporting
   * that the sources "agree" when only one of them spoke.
   */
  const leaderOf = (placing: (number | null)[]): string | null => {
    if (placing.filter((p) => p !== null).length < 2) return null;
    const firsts = players.filter((_, i) => placing[i] === 1);
    return firsts.length === 1 ? firsts[0]!.id : null;
  };
  const consensusLeader = leaderOf(consensusPlacings);
  const attentionLeader = leaderOf(attentionPlacings);
  const nameOf = (id: string | null) => players.find((p) => p.id === id)?.name ?? null;

  const agreement: Comparison['agreement'] =
    consensusLeader === null || attentionLeader === null
      ? 'unknown'
      : consensusLeader === attentionLeader
        ? 'agree'
        : 'split';

  let headline: string;
  if (players.length < 2) {
    headline = 'Add a second player to compare the sources against each other.';
  } else if (agreement === 'agree') {
    headline = `The analysts and Sleeper\u2019s managers both lead with ${nameOf(consensusLeader)} \u2014 the two independent reads here agree.`;
  } else if (agreement === 'split') {
    headline = `The analysts lead with ${nameOf(consensusLeader)}; Sleeper\u2019s managers look up ${nameOf(attentionLeader)} most. That split is the only real disagreement on this page, because the trade-value column shares FantasyPros\u2019 upstream.`;
  } else {
    headline =
      'Not every source ranks all of these players, so there is no clean cross-source verdict \u2014 read the rows that are filled in rather than the gaps.';
  }

  return {
    players,
    rows,
    families: FAMILIES,
    consensusLeader,
    attentionLeader,
    agreement,
    headline,
  };
}
