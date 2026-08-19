import type { Draft } from '~/lib/schemas/draft';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Player } from '~/lib/schemas/players';
import type { Team } from '~/lib/schemas/team';
import type { Trending } from '~/lib/schemas/trending';

/**
 * Position boards: for each position, the most popular players first.
 *
 * Two different meanings of "popular" are on this page, and they are kept
 * separate on purpose because they answer different questions:
 *
 *   - **Board** — FantasyPros Expert Consensus Rank from `data/market.json`.
 *     A consensus rank *is* a popularity measure: it is where a room of experts
 *     agrees a player goes, which is the best available proxy for where the
 *     other eleven managers will take him. This is the draft-day list.
 *   - **Trending** — Sleeper's 24-hour add counts from `data/trending.json`.
 *     Raw manager behavior across every Sleeper league. This is the in-season
 *     waiver-wire list.
 *
 * Nothing here is invented: every number on a row comes from one of those two
 * committed files, and a row whose number is missing renders null rather than a
 * fabricated rank.
 */

export const BOARD_POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
export type BoardPos = (typeof BOARD_POSITIONS)[number];

/** Why a player is not takeable right now. `available` = go get him. */
export type Availability = 'available' | 'drafted' | 'rostered';

export interface BoardEntry {
  /** Stable per-row key — market rows always have an fpId, trending rows a sleeperId. */
  key: string;
  playerId: string | null;
  name: string;
  pos: BoardPos;
  nflTeam: string;
  age: number | null;
  /** 1-indexed rank within this list, i.e. the popularity order itself. */
  rank: number;
  /** Format-aware expert consensus rank (superflex when the league is). Null when unranked. */
  ecr: number | null;
  /** Rank within position as the consensus sheet reports it. */
  posEcr: number | null;
  /** Format-aware dynasty trade value. Null when the market has no row. */
  value: number | null;
  /** Sleeper adds in the lookback window. Null when the player is not trending. */
  adds: number | null;
  /** Sleeper drops in the lookback window. Null when the player is not trending. */
  drops: number | null;
  availability: Availability;
  /** Depth-chart rank on his NFL team, when nflverse lists him. */
  depthRank: number | null;
  status: string | null;
  injuryStatus: string | null;
}

export interface PositionBoard {
  pos: BoardPos;
  /** Consensus order — the draft-day list. */
  board: BoardEntry[];
  /** Sleeper add counts — the waiver-wire list. */
  trending: BoardEntry[];
}

export interface PositionBoardsInput {
  market: Market;
  trending: Trending;
  players: Player[];
  draft: Draft;
  format: Team['format'];
  depthRankById?: Record<string, number>;
  /** Rows kept per position on the consensus board. */
  boardLimit?: number;
  /** Rows kept per position on the trending list. */
  trendingLimit?: number;
}

export interface PositionBoards {
  boards: PositionBoard[];
  /** When `data/market.json` was captured. */
  marketCapturedAt: string;
  /** When `data/trending.json` was captured. */
  trendingCapturedAt: string;
  trendingLookbackHours: number;
  sources: Market['sources'];
}

const DEFAULT_BOARD_LIMIT = 40;
const DEFAULT_TRENDING_LIMIT = 12;

function isBoardPos(pos: string): pos is BoardPos {
  return (BOARD_POSITIONS as readonly string[]).includes(pos.toUpperCase());
}

/**
 * A loose identity key. Sleeper ids, our slugs, and DynastyProcess fp_ids only
 * partially overlap, so name+position is the fallback join — it is what the
 * draft feed gives us for a player we have never seen before.
 */
function nameKey(name: string, pos: string): string {
  return `${name.toLowerCase().replace(/[^a-z]/g, '')}|${pos.toUpperCase()}`;
}

/** Consensus rank in the league's format. Superflex leagues read the 2QB sheet. */
function consensusEcr(row: MarketPlayerRow, format: Team['format']): number | null {
  return format.superflex ? row.ecrSf : row.ecr1qb;
}

function consensusValue(row: MarketPlayerRow, format: Team['format']): number | null {
  return format.superflex ? row.valueSf : row.value1qb;
}

/** Ids and name keys of everyone already off the board in this draft. */
function draftedKeys(draft: Draft): Set<string> {
  const keys = new Set<string>();
  for (const pick of draft.picks) {
    if (pick.playerId) keys.add(pick.playerId);
    if (pick.playerName) keys.add(nameKey(pick.playerName, pick.pos));
  }
  return keys;
}

/**
 * Players another manager already owns.
 *
 * `rosteredInLeague` is written by the Sleeper sync from the league's actual
 * rosters, so this is real ownership, not an assumption. Before a startup it is
 * empty, which is correct — nobody owns anybody yet.
 */
function rosteredKeys(players: Player[]): Set<string> {
  const keys = new Set<string>();
  for (const player of players) {
    if (!player.rosteredInLeague) continue;
    keys.add(player.id);
    keys.add(nameKey(player.name, player.pos));
  }
  return keys;
}

function availabilityOf(
  playerId: string | null,
  name: string,
  pos: string,
  drafted: Set<string>,
  rostered: Set<string>,
): Availability {
  const key = nameKey(name, pos);
  if ((playerId && drafted.has(playerId)) || drafted.has(key)) return 'drafted';
  if ((playerId && rostered.has(playerId)) || rostered.has(key)) return 'rostered';
  return 'available';
}

export function buildPositionBoards(input: PositionBoardsInput): PositionBoards {
  const {
    market,
    trending,
    players,
    draft,
    format,
    depthRankById = {},
    boardLimit = DEFAULT_BOARD_LIMIT,
    trendingLimit = DEFAULT_TRENDING_LIMIT,
  } = input;

  const drafted = draftedKeys(draft);
  const rostered = rosteredKeys(players);

  const playerById = new Map(players.map((p) => [p.id, p]));
  const playerByName = new Map(players.map((p) => [nameKey(p.name, p.pos), p]));
  const findPlayer = (playerId: string | null, name: string, pos: string): Player | undefined =>
    (playerId ? playerById.get(playerId) : undefined) ?? playerByName.get(nameKey(name, pos));

  // Add/drop counts, keyed both ways so a market row can find its trending row
  // whether or not the two sources agreed on an id.
  const addsBy = new Map<string, number>();
  const dropsBy = new Map<string, number>();
  for (const [rows, sink] of [
    [trending.adds, addsBy],
    [trending.drops, dropsBy],
  ] as const) {
    for (const row of rows) {
      sink.set(nameKey(row.name, row.pos), row.count);
      if (row.playerId) sink.set(row.playerId, row.count);
      if (row.sleeperId) sink.set(`sleeper:${row.sleeperId}`, row.count);
    }
  }
  const countFor = (
    sink: Map<string, number>,
    playerId: string | null,
    sleeperId: string | null,
    name: string,
    pos: string,
  ): number | null => {
    const hit =
      (playerId ? sink.get(playerId) : undefined) ??
      (sleeperId ? sink.get(`sleeper:${sleeperId}`) : undefined) ??
      sink.get(nameKey(name, pos));
    return hit ?? null;
  };

  // Market rows, best consensus rank first. Unranked rows are dropped rather
  // than sorted to the end: a board is a claim about order, and a row with no
  // rank has no place in one.
  const marketByPos = new Map<BoardPos, MarketPlayerRow[]>(
    BOARD_POSITIONS.map((pos) => [pos, [] as MarketPlayerRow[]]),
  );
  for (const row of market.players) {
    const pos = row.pos.toUpperCase();
    if (!isBoardPos(pos)) continue;
    if (consensusEcr(row, format) === null) continue;
    marketByPos.get(pos)!.push(row);
  }

  const marketRowFor = new Map<string, MarketPlayerRow>();
  for (const row of market.players) {
    marketRowFor.set(nameKey(row.name, row.pos), row);
    if (row.playerId) marketRowFor.set(row.playerId, row);
    if (row.sleeperId) marketRowFor.set(`sleeper:${row.sleeperId}`, row);
  }

  const boards: PositionBoard[] = BOARD_POSITIONS.map((pos) => {
    const rows = [...(marketByPos.get(pos) ?? [])].sort((a, b) => {
      const ea = consensusEcr(a, format) ?? Number.POSITIVE_INFINITY;
      const eb = consensusEcr(b, format) ?? Number.POSITIVE_INFINITY;
      if (ea !== eb) return ea - eb;
      return (consensusValue(b, format) ?? 0) - (consensusValue(a, format) ?? 0);
    });

    // The limit counts *available* players, not rows. Slicing the raw list
    // instead meant that mid-draft — with seventy names already gone from the
    // top of it — "top 40" was really "the eleven of the top 40 nobody has
    // taken", and hiding taken players emptied the board out. Taken names are
    // still carried, in place, because reading who went just ahead of you is
    // half of what a board is for.
    let availableSoFar = 0;
    const inScope: MarketPlayerRow[] = [];
    for (const row of rows) {
      const player = findPlayer(row.playerId, row.name, row.pos);
      const status = availabilityOf(
        row.playerId ?? player?.id ?? null,
        row.name,
        pos,
        drafted,
        rostered,
      );
      if (status === 'available') {
        if (availableSoFar >= boardLimit) break;
        availableSoFar += 1;
      }
      inScope.push(row);
    }

    const board: BoardEntry[] = inScope.map((row, i) => {
      const player = findPlayer(row.playerId, row.name, row.pos);
      return {
        key: row.fpId || nameKey(row.name, row.pos),
        playerId: row.playerId ?? player?.id ?? null,
        name: row.name,
        pos,
        nflTeam: row.nflTeam,
        age: row.age,
        rank: i + 1,
        ecr: consensusEcr(row, format),
        posEcr: row.posEcr,
        value: consensusValue(row, format),
        adds: countFor(addsBy, row.playerId, row.sleeperId, row.name, row.pos),
        drops: countFor(dropsBy, row.playerId, row.sleeperId, row.name, row.pos),
        availability: availabilityOf(
          row.playerId ?? player?.id ?? null,
          row.name,
          pos,
          drafted,
          rostered,
        ),
        depthRank: (player && depthRankById[player.id]) ?? null,
        status: player?.status ?? null,
        injuryStatus: player?.injuryStatus ?? null,
      };
    });

    const dropsByKeyForPos = dropsBy;
    const trendingRows = trending.adds
      .filter((row) => row.pos.toUpperCase() === pos)
      .sort((a, b) => b.count - a.count)
      .slice(0, trendingLimit)
      .map((row, i): BoardEntry => {
        const player = findPlayer(row.playerId, row.name, row.pos);
        const marketRow =
          (row.playerId ? marketRowFor.get(row.playerId) : undefined) ??
          marketRowFor.get(`sleeper:${row.sleeperId}`) ??
          marketRowFor.get(nameKey(row.name, row.pos));
        return {
          key: `sleeper-${row.sleeperId}`,
          playerId: row.playerId ?? player?.id ?? null,
          name: row.name,
          pos,
          nflTeam: row.nflTeam,
          age: marketRow?.age ?? player?.age ?? null,
          rank: i + 1,
          ecr: marketRow ? consensusEcr(marketRow, format) : null,
          posEcr: marketRow?.posEcr ?? null,
          value: marketRow ? consensusValue(marketRow, format) : null,
          adds: row.count,
          drops: dropsByKeyForPos.get(nameKey(row.name, row.pos)) ?? null,
          availability: availabilityOf(
            row.playerId ?? player?.id ?? null,
            row.name,
            pos,
            drafted,
            rostered,
          ),
          depthRank: (player && depthRankById[player.id]) ?? null,
          status: player?.status ?? null,
          injuryStatus: player?.injuryStatus ?? null,
        };
      });

    return { pos, board, trending: trendingRows };
  });

  return {
    boards,
    marketCapturedAt: market.capturedAt,
    trendingCapturedAt: trending.capturedAt,
    trendingLookbackHours: trending.lookbackHours,
    sources: market.sources,
  };
}
