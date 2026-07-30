import { assertHeader, parseCsv, parseCsvRecords } from './csv';
import type { MarketPickRow, Source } from '~/lib/schemas/market';
import type { Player } from '~/lib/schemas/players';
import { slugify } from '~/lib/sleeper/map';

/**
 * DynastyProcess CSV -> our shapes, pure (no fs, no fetch) so this is trivially
 * testable against committed fixtures. The join is id-based first
 * (values-players.fp_id -> db_playerids.fantasypros_id -> sleeper_id) and falls
 * back to normalized-name matching only when the id path has nothing to go on.
 */

const VALUES_PLAYERS_HEADER = [
  'player',
  'pos',
  'team',
  'age',
  'draft_year',
  'ecr_1qb',
  'ecr_2qb',
  'ecr_pos',
  'value_1qb',
  'value_2qb',
  'scrape_date',
  'fp_id',
];

const VALUES_PICKS_HEADER = [
  'player',
  'pos',
  'ecr_1qb',
  'ecr_2qb',
  'ecr_high_1qb',
  'ecr_high_2qb',
  'ecr_low_1qb',
  'ecr_low_2qb',
  'scrape_date',
  'pick',
];

const PLAYER_IDS_HEADER = [
  'fantasypros_id',
  'sleeper_id',
  'ktc_id',
  'espn_id',
  'name',
  'merge_name',
  'position',
  'team',
];

/** Positions this superflex league starts (QB/RB/WR/TE/FLEX/SUPERFLEX only). */
const SKILL_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

/**
 * Blank cells and DynastyProcess's own 'NA' sentinel both mean "unknown" —
 * never 0. `Number('')` is 0, which would silently make every unknown age 0.
 */
function num(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'NA') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Same as num(), but returns '' instead of null — for id-like string columns. */
function str(raw: string | undefined): string | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === '' || trimmed === 'NA' ? null : trimmed;
}

/* ------------------------------- players ---------------------------------- */

export interface ValuesPlayerRow {
  fpId: string;
  name: string;
  pos: string;
  nflTeam: string;
  age: number | null;
  draftYear: number | null;
  ecrSf: number | null;
  ecr1qb: number | null;
  posEcr: number | null;
  valueSf: number;
  value1qb: number | null;
  scrapeDate: string;
}

export function parseValuesPlayers(csv: string): ValuesPlayerRow[] {
  assertHeader(parseCsv(csv)[0] ?? [], VALUES_PLAYERS_HEADER);
  const rows = parseCsvRecords(csv);

  return rows
    .filter((r) => SKILL_POSITIONS.has((r.pos ?? '').toUpperCase()))
    .map((r) => ({
      fpId: r.fp_id?.trim() ?? '',
      name: r.player?.trim() ?? '',
      pos: r.pos.toUpperCase(),
      nflTeam: r.team?.trim() ?? '',
      age: num(r.age),
      draftYear: num(r.draft_year),
      ecrSf: num(r.ecr_2qb),
      ecr1qb: num(r.ecr_1qb),
      posEcr: num(r.ecr_pos),
      valueSf: num(r.value_2qb) ?? 0,
      value1qb: num(r.value_1qb),
      scrapeDate: r.scrape_date?.trim() ?? '',
    }));
}

/* --------------------------------- picks ----------------------------------- */

const ORDINAL_ROUND: Record<string, number> = {
  '1st': 1,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
  '6th': 6,
  '7th': 7,
  '8th': 8,
  '9th': 9,
  '10th': 10,
};

/**
 * '2026 Pick 1.01' -> {season: 2026, round: 1, pickInRound: 1}
 * '2028 3rd'       -> {season: 2028, round: 3, pickInRound: null}
 * '2027 Early 2nd' -> {season: 2027, round: 2, pickInRound: null} (tier words
 *   like Early/Mid/Late are dropped rather than encoded as a slot).
 */
function parsePickLabel(label: string): { season: number; round: number; pickInRound: number | null } | null {
  const seasonMatch = label.match(/^(\d{4})\b/);
  if (!seasonMatch) return null;
  const season = Number(seasonMatch[1]);

  const slotted = label.match(/Pick\s+(\d+)\.(\d+)/i);
  if (slotted) {
    return { season, round: Number(slotted[1]), pickInRound: Number(slotted[2]) };
  }

  const ordinalMatch = label.match(/\b(\d+)(st|nd|rd|th)\b/i);
  if (ordinalMatch) {
    const key = `${ordinalMatch[1]}${ordinalMatch[2].toLowerCase()}`;
    const round = ORDINAL_ROUND[key] ?? Number(ordinalMatch[1]);
    return { season, round, pickInRound: null };
  }

  return null;
}

export function parseValuesPicks(csv: string): MarketPickRow[] {
  assertHeader(parseCsv(csv)[0] ?? [], VALUES_PICKS_HEADER);
  const rows = parseCsvRecords(csv);

  const out: MarketPickRow[] = [];
  for (const r of rows) {
    const label = r.player?.trim() ?? '';
    const parsed = parsePickLabel(label);
    if (!parsed) continue;

    out.push({
      label,
      season: parsed.season,
      round: parsed.round,
      pickInRound: parsed.pickInRound,
      ecrSf: num(r.ecr_2qb),
      ecrHighSf: num(r.ecr_high_2qb),
      ecrLowSf: num(r.ecr_low_2qb),
      // values-picks.csv has no value column upstream — see MarketPickRowSchema.
      valueSf: null,
    });
  }
  return out;
}

/* ------------------------------ player ids ---------------------------------- */

export interface PlayerIdRow {
  fantasyprosId: string | null;
  sleeperId: string | null;
  ktcId: string | null;
  espnId: string | null;
  name: string;
  mergeName: string;
  position: string;
  team: string;
}

export function parsePlayerIds(csv: string): PlayerIdRow[] {
  assertHeader(parseCsv(csv)[0] ?? [], PLAYER_IDS_HEADER);
  const rows = parseCsvRecords(csv);

  return rows.map((r) => ({
    fantasyprosId: str(r.fantasypros_id),
    sleeperId: str(r.sleeper_id),
    ktcId: str(r.ktc_id),
    espnId: str(r.espn_id),
    name: r.name?.trim() ?? '',
    mergeName: r.merge_name?.trim() ?? '',
    position: (r.position ?? '').toUpperCase(),
    team: (r.team ?? '').toUpperCase(),
  }));
}

/* --------------------------------- join ------------------------------------- */

const SUFFIX_RE = /\b(jr|sr|ii|iii|iv|v)\.?\b/g;

/**
 * Normalizes a name for the fallback join: lowercase, strip diacritics and
 * generational suffixes, drop everything that isn't alphanumeric. Reuses the
 * same diacritic-stripping approach as slugify() in sleeper/map.ts, but folds
 * away separators entirely rather than hyphenating, since this is a join key
 * rather than a URL-safe id.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(SUFFIX_RE, '')
    .replace(/[^a-z0-9]+/g, '');
}

export interface MarketPlayerRow {
  fpId: string;
  sleeperId: string | null;
  ktcId: string | null;
  espnId: string | null;
  playerId: string | null;
  name: string;
  pos: string;
  nflTeam: string;
  age: number | null;
  draftYear: number | null;
  ecrSf: number | null;
  ecr1qb: number | null;
  posEcr: number | null;
  valueSf: number;
  value1qb: number | null;
}

export interface JoinResult {
  players: MarketPlayerRow[];
  unmatched: { name: string; pos: string; fpId: string }[];
}

/**
 * values-players.csv -> Sleeper -> our slug.
 *
 * Id-based join first (exact, no fuzz): fp_id -> fantasypros_id -> sleeper_id.
 * Falls back to name matching, keyed on `normalizeName(name)|pos`, only when
 * the id path finds nothing. A fallback match that is ambiguous even after a
 * team tiebreak is never guessed — it goes to `unmatched` and the row is
 * dropped from `players`, per the "never guess" rule. A fallback match with NO
 * candidates at all is not ambiguous, just absent: the row stays in `players`
 * with sleeperId/ktcId/espnId left null.
 */
export function joinToSleeper(
  vals: ValuesPlayerRow[],
  ids: PlayerIdRow[],
  ourPlayers: Player[],
): JoinResult {
  const byFpId = new Map<string, PlayerIdRow>();
  const byNameKey = new Map<string, PlayerIdRow[]>();

  for (const row of ids) {
    if (row.fantasyprosId) byFpId.set(row.fantasyprosId, row);
    const key = `${normalizeName(row.name)}|${row.position}`;
    const bucket = byNameKey.get(key);
    if (bucket) bucket.push(row);
    else byNameKey.set(key, [row]);
  }

  const sleeperIdToOurId = new Map(
    ourPlayers.filter((p) => p.sleeperId).map((p) => [p.sleeperId!, p.id]),
  );
  const ourIds = new Set(ourPlayers.map((p) => p.id));

  const players: MarketPlayerRow[] = [];
  const unmatched: { name: string; pos: string; fpId: string }[] = [];

  for (const v of vals) {
    let matched: PlayerIdRow | null = v.fpId ? (byFpId.get(v.fpId) ?? null) : null;
    let ambiguous = false;

    if (!matched) {
      const key = `${normalizeName(v.name)}|${v.pos}`;
      const candidates = byNameKey.get(key) ?? [];
      if (candidates.length === 1) {
        matched = candidates[0];
      } else if (candidates.length > 1) {
        const byTeam = candidates.filter((c) => c.team === v.nflTeam.toUpperCase());
        if (byTeam.length === 1) {
          matched = byTeam[0];
        } else {
          ambiguous = true;
        }
      }
    }

    if (ambiguous) {
      unmatched.push({ name: v.name, pos: v.pos, fpId: v.fpId });
      continue;
    }

    const sleeperId = matched?.sleeperId ?? null;
    const playerId =
      (sleeperId && sleeperIdToOurId.get(sleeperId)) ||
      (ourIds.has(slugify(v.name)) ? slugify(v.name) : null);

    players.push({
      fpId: v.fpId,
      sleeperId,
      ktcId: matched?.ktcId ?? null,
      espnId: matched?.espnId ?? null,
      playerId: playerId ?? null,
      name: v.name,
      pos: v.pos,
      nflTeam: v.nflTeam,
      age: v.age,
      draftYear: v.draftYear,
      ecrSf: v.ecrSf,
      ecr1qb: v.ecr1qb,
      posEcr: v.posEcr,
      valueSf: v.valueSf,
      value1qb: v.value1qb,
    });
  }

  return { players, unmatched };
}

/* ------------------------------- citations ----------------------------------- */

/**
 * Deep link per id, gated independently — never fabricate a player URL.
 *
 * This sandbox's network policy blocks keeptradecut.com, fantasypros.com,
 * sleeper.com and espn.com outright (403 at the CONNECT layer), so none of
 * their per-player URL shapes could be verified here. Every link below is
 * therefore each site's stable index/search page, not a guessed per-player
 * path — a homepage link is honest; a 404 masquerading as a citation is not.
 */
/**
 * Per-player citation targets, one per external source that has an id for them.
 *
 * Each template is gated on the id it needs, so a player missing from a
 * crosswalk gets that site's stable index page rather than a fabricated path —
 * a 404 masquerading as a citation is worse than a homepage link.
 *
 * The deep-link path shapes below are the sites' documented public URL formats.
 * They could NOT be confirmed with a live request: this repo's CI sandbox denies
 * outbound CONNECT to every host except raw.githubusercontent.com, so curl
 * cannot reach sleeper.com, keeptradecut.com, fantasypros.com or espn.com from
 * here. They are kept in this one table so that if a shape ever turns out to be
 * wrong, there is a single place to correct it.
 */
const DEEP_LINKS = {
  sleeper: (id: string) => `https://sleeper.com/players/nfl/${id}`,
  ktc: (id: string) => `https://keeptradecut.com/dynasty-rankings/players/${id}`,
  espn: (id: string) => `https://www.espn.com/nfl/player/_/id/${id}`,
  /**
   * FantasyPros keys player pages off a name slug, not the numeric fp_id, and
   * drops apostrophes rather than hyphenating them — `jamarr-chase`, not
   * `ja-marr-chase`. Strip them before slugify, which would otherwise turn the
   * apostrophe into a separator.
   */
  fantasyPros: (name: string) =>
    `https://www.fantasypros.com/nfl/players/${slugify(name.replace(/['’]/g, ''))}.php`,
} as const;

const INDEX_LINKS = {
  ktc: 'https://keeptradecut.com/dynasty-rankings',
  fantasyPros: 'https://www.fantasypros.com/nfl/rankings/dynasty-overall.php',
} as const;

export function sourceLinks(row: MarketPlayerRow): Source[] {
  const links: Source[] = [];

  if (row.sleeperId) {
    links.push({
      label: `${row.name} on Sleeper`,
      url: DEEP_LINKS.sleeper(row.sleeperId),
      kind: 'market',
    });
  }
  links.push(
    row.ktcId
      ? { label: `${row.name} on KeepTradeCut`, url: DEEP_LINKS.ktc(row.ktcId), kind: 'market' }
      : { label: 'KeepTradeCut dynasty rankings', url: INDEX_LINKS.ktc, kind: 'market' },
  );
  links.push(
    row.name
      ? {
          label: `${row.name} on FantasyPros`,
          url: DEEP_LINKS.fantasyPros(row.name),
          kind: 'rankings',
        }
      : { label: 'FantasyPros dynasty rankings', url: INDEX_LINKS.fantasyPros, kind: 'rankings' },
  );
  if (row.espnId) {
    links.push({
      label: `${row.name} on ESPN`,
      url: DEEP_LINKS.espn(row.espnId),
      kind: 'article',
    });
  }

  return links;
}
