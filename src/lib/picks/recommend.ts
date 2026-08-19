import type { Draft } from '~/lib/schemas/draft';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Player, Position } from '~/lib/schemas/players';
import type { Profile } from '~/lib/schemas/profiles';
import type { Team } from '~/lib/schemas/team';
import type { Trending } from '~/lib/schemas/trending';
import { diagnoseRosterHealth, type HealthFacetId, type RosterHealth } from '~/lib/team/health';
import { rosteredPlayersIncludingDraft } from '~/lib/team/draft-coaching';
import { BOARD_POSITIONS, type BoardPos } from '~/lib/picks/board';

/**
 * The pick recommender: one ranked list answering "who should I take next?"
 *
 * The position boards in `board.ts` answer a different question — "who is the
 * next name off the board at WR?" — and answer it well. What they cannot do is
 * weigh a receiver against a running back, because a consensus rank knows
 * nothing about *your* roster. A manager staring at four names in the same tier
 * is not short of rankings; they are short of a reason to prefer one.
 *
 * So this module scores every available player against four things the raw
 * board ignores:
 *
 *   1. **Two independent market opinions.** KeepTradeCut-derived trade value
 *      (`valueSf` / `value1qb`, what the market pays) and FantasyPros Expert
 *      Consensus Rank (what a room of analysts says). They disagree often, and
 *      the disagreement is itself a signal, so both are scored and the gap
 *      between them is reported rather than averaged away.
 *   2. **Your roster's actual holes**, taken from the same positional audit the
 *      team page runs (`diagnoseRosterHealth`) plus how many starting slots at
 *      that position are still empty.
 *   3. **This league's scoring settings.** Superflex, full PPR and a +0.5 TE
 *      premium are not decoration — they change what a position is worth. The
 *      weighting is a published table below, not a hidden constant.
 *   4. **Age against the published positional peak**, and depth-chart
 *      opportunity, both already cited elsewhere in this app.
 *
 * What it deliberately does **not** do: invent projections. Every number that
 * enters the score comes from a committed data file, and the qualitative half —
 * role, scheme fit, risk — comes from `data/profiles.json`, where the schema
 * refuses an uncited claim. A recommendation here is a weighting of sourced
 * facts, and the page shows the weighting so it can be argued with.
 */

// --- The published weighting tables -----------------------------------------
//
// These are the whole model. They are constants in one place, exported, and
// rendered on the page, because a recommender whose reasoning you cannot
// inspect is indistinguishable from one that is guessing.

/** Points available from KeepTradeCut-derived market value. The largest single input. */
export const MARKET_POINTS = 60;
/** Points available from FantasyPros Expert Consensus Rank. */
export const CONSENSUS_POINTS = 20;
/** Consensus ranks past this are treated as off the useful board. */
const CONSENSUS_HORIZON = 200;
/** A maximal roster hole multiplies the base score by at most this much. */
const MAX_NEED_BOOST = 0.35;
/** Format weighting scales the base between (1 - SWING) and (1 + SWING). */
const FORMAT_SWING = 0.15;

/**
 * Published peak ages, carried over from the roster audit's sources so the two
 * surfaces cannot drift apart. RB peak has sat at 24.8 since 2016; WR peak is
 * ~27 with no significant per-game drop until 30; TE peak (outliers removed) is
 * 26.8. QB is blended: rushing quarterbacks peak ~26.1 and pocket passers
 * ~30.6, so a single number is a compromise and is labeled as one.
 *
 * `decline` scales how hard age is punished past the peak — a running back a
 * year past peak is a different asset than a quarterback a year past his.
 */
export const AGE_CURVES: Record<BoardPos, { peak: number; decline: number; note: string }> = {
  QB: { peak: 28, decline: 0.75, note: 'blended: rushing QBs peak ~26.1, pocket passers ~30.6' },
  RB: { peak: 24.8, decline: 1.25, note: 'peak season age has sat at 24.8 since 2016' },
  WR: { peak: 27, decline: 1.0, note: 'peak ~27; no significant PPG drop until 30' },
  TE: { peak: 26.8, decline: 0.9, note: 'average peak, outliers removed, is 26.8' },
};

/**
 * How much this league's scoring settings favor each position, 0–1.
 *
 * Superflex is the single biggest lever in the format, which is why a
 * superflex QB scores a full weight and a 1QB quarterback scores well under
 * half. PPR lifts pass-catchers more than backs because backs catch fewer
 * passes; the TE premium is added on top rather than folded in, so a league
 * that turns the premium off sees the weight fall immediately.
 */
export function formatWeight(pos: BoardPos, format: Team['format']): number {
  const ppr = Math.max(0, Math.min(1, format.ppr));
  const tep = Math.max(0, Math.min(1, format.tePremium));
  switch (pos) {
    case 'QB':
      return format.superflex ? 1 : 0.35;
    case 'RB':
      return 0.55 + 0.15 * ppr;
    case 'WR':
      return 0.6 + 0.4 * ppr;
    case 'TE':
      return Math.min(1, 0.5 + 0.25 * ppr + 0.5 * tep);
  }
}

/** Human-readable reason the format weight is what it is. */
export function formatWeightReason(pos: BoardPos, format: Team['format']): string {
  switch (pos) {
    case 'QB':
      return format.superflex
        ? 'Superflex starts a second quarterback most weeks, so QB carries the format’s heaviest weight.'
        : 'One-QB league — a quarterback beyond your starter is depth, not an edge.';
    case 'RB':
      return format.ppr > 0
        ? `Full ${format.ppr} PPR helps backs, but they catch fewer passes than receivers, so the lift is partial.`
        : 'Standard scoring — running back value rests on carries and touchdowns.';
    case 'WR':
      return format.ppr > 0
        ? `${format.ppr} PPR pays every reception, and this format starts three receivers plus flex.`
        : 'Standard scoring caps how much volume alone is worth at receiver.';
    case 'TE':
      return format.tePremium > 0
        ? `+${format.tePremium} TE premium turns an every-down tight end into a weekly structural edge.`
        : 'No TE premium, so do not pay past the top tier at the position.';
  }
}

// --- Types ------------------------------------------------------------------

export type FactorId = 'market' | 'consensus' | 'need' | 'format' | 'age' | 'opportunity';

/** One scored input, carrying its own explanation so the UI never re-derives it. */
export interface ScoreFactor {
  id: FactorId;
  label: string;
  /** Points contributed to the final score. Negative for penalties. */
  points: number;
  /** What the factor could have contributed at most, for a share bar. */
  max: number;
  detail: string;
}

export interface Recommendation {
  key: string;
  playerId: string | null;
  name: string;
  pos: BoardPos;
  nflTeam: string;
  age: number | null;
  /** 1-indexed position in the recommendation order. */
  rank: number;
  /** 0–100. A weighting of the factors below, never a projection. */
  score: number;
  factors: ScoreFactor[];
  /** Generated prose — the "why this player" blobs, in reading order. */
  why: string[];
  /** Cited scouting profile, when `data/profiles.json` has one. */
  profile: Profile | null;
  /** Format-aware expert consensus rank. */
  ecr: number | null;
  /** Consensus rank within position, as the sheet reports it. */
  posEcr: number | null;
  /** Format-aware KeepTradeCut-derived trade value. */
  value: number | null;
  /** Rank at this position among *available* players, by market value. */
  ktcPosRank: number | null;
  /** Rank at this position among *available* players, by consensus rank. */
  ecrPosRank: number | null;
  /**
   * Positive when the market rates him higher than the consensus does (a buy
   * signal from the trade market), negative when the experts are the high side.
   */
  marketVsConsensus: number | null;
  depthRank: number | null;
  status: string | null;
  injuryStatus: string | null;
  adds: number | null;
  /** True when this player closes the roster's top-priority hole. */
  fillsTopNeed: boolean;
}

export interface PositionNeed {
  pos: BoardPos;
  /** The roster audit's 0–10 grade for this room. */
  facetScore: number;
  grade: 'strong' | 'watch' | 'weak';
  /** Starting slots this format asks for at the position (superflex/flex included). */
  requiredStarters: number;
  /** Players currently on the roster at this position, draft picks included. */
  rosteredCount: number;
  openStarters: number;
  /** 0–1. The blend of audit grade and empty slots that drives the score boost. */
  needWeight: number;
  summary: string;
  /** The audit's own callout for the room, when it flagged one. */
  attention: string | null;
}

export interface NeedGroup {
  need: PositionNeed;
  /** Best available at this position, same scores as the flat list. */
  players: Recommendation[];
}

export interface PickRecommendations {
  /** Every available player, best first. */
  recommendations: Recommendation[];
  /** The same players grouped by the hole they fill, most urgent hole first. */
  byNeed: NeedGroup[];
  /** Roster gaps, most urgent first — the header of the page. */
  needs: PositionNeed[];
  health: RosterHealth;
  /** One-line read on the next decision, from the draft coach. */
  headline: string;
  nextPickNumber: number | null;
  picksUntilNext: number | null;
  marketCapturedAt: string;
  sources: Market['sources'];
  /** The weighting table, passed through so the page can show its own math. */
  weights: {
    marketPoints: number;
    consensusPoints: number;
    maxNeedBoost: number;
    formatSwing: number;
    byPosition: { pos: BoardPos; weight: number; reason: string }[];
  };
}

export interface RecommendInput {
  market: Market;
  trending: Trending;
  players: Player[];
  draft: Draft;
  team: Team;
  profiles: Profile[];
  depthRankById?: Record<string, number>;
  /** How many recommendations to keep on the flat list. */
  limit?: number;
  /** How many to keep under each position group. */
  perPositionLimit?: number;
}

const DEFAULT_LIMIT = 40;
const DEFAULT_PER_POSITION_LIMIT = 8;
const FACET_BY_POS: Record<BoardPos, HealthFacetId> = { QB: 'qb', RB: 'rb', WR: 'wr', TE: 'te' };
const SEVERE_INJURY = /^(out|ir|injured reserve|pup|doubtful|sus|non football injury)$/i;

function isBoardPos(pos: string): pos is BoardPos {
  return (BOARD_POSITIONS as readonly string[]).includes(pos.toUpperCase());
}

function nameKey(name: string, pos: string): string {
  return `${name.toLowerCase().replace(/[^a-z]/g, '')}|${pos.toUpperCase()}`;
}

function consensusEcr(row: MarketPlayerRow, format: Team['format']): number | null {
  return format.superflex ? row.ecrSf : row.ecr1qb;
}

function consensusValue(row: MarketPlayerRow, format: Team['format']): number | null {
  return format.superflex ? row.valueSf : row.value1qb;
}

/**
 * How many starters this format wants at a position.
 *
 * SUPERFLEX counts fully toward QB because that is what the slot is for in
 * practice. FLEX is split evenly between RB and WR — a flex is almost never a
 * quarterback and only sometimes a tight end, so charging half a slot to each
 * of the two positions that actually fill it beats both alternatives (ignoring
 * flex understates the need; charging it to every position overstates it).
 */
export function requiredStarters(pos: BoardPos, format: Team['format']): number {
  const count = (kind: string) => format.rosterSlots.filter((s) => s.kind === kind).length;
  const flex = count('FLEX');
  switch (pos) {
    case 'QB':
      return count('QB') + count('SUPERFLEX');
    case 'RB':
      return count('RB') + flex * 0.5;
    case 'WR':
      return count('WR') + flex * 0.5;
    case 'TE':
      return count('TE');
  }
}

function buildNeeds(team: Team, health: RosterHealth, rostered: Player[]): PositionNeed[] {
  const needs = BOARD_POSITIONS.map((pos): PositionNeed => {
    const facet = health.facets.find((f) => f.id === FACET_BY_POS[pos]);
    const facetScore = facet?.score ?? 0;
    const required = requiredStarters(pos, team.format);
    const have = rostered.filter((p) => (p.pos as Position) === pos).length;
    const open = Math.max(0, required - have);

    // Two independent readings of "how badly do I need this position": the
    // audit's quality grade, and raw empty slots. A room can be graded weak
    // while its slots are full (bad players), or graded fine with slots open
    // (good players, not enough of them). Blending both catches each case.
    const facetGap = (10 - facetScore) / 10;
    const slotPressure = required > 0 ? Math.min(1, open / required) : 0;
    const needWeight = 0.65 * facetGap + 0.35 * slotPressure;

    return {
      pos,
      facetScore,
      grade: facet?.grade ?? 'weak',
      requiredStarters: required,
      rosteredCount: have,
      openStarters: open,
      needWeight,
      summary:
        open > 0
          ? `${facetScore}/10 room, ${formatSlots(open)} of ${formatSlots(required)} starting ${pos} slots still open.`
          : `${facetScore}/10 room, starting ${pos} slots filled.`,
      attention: facet?.attention ?? null,
    };
  });

  return [...needs].sort((a, b) => b.needWeight - a.needWeight || a.pos.localeCompare(b.pos));
}

/** Slot counts can be fractional because FLEX is shared — render them readably. */
function formatSlots(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function ageFactor(pos: BoardPos, age: number | null): { points: number; detail: string } {
  const curve = AGE_CURVES[pos];
  if (age === null) {
    return { points: 0, detail: 'No age on file — this factor is scored neutral rather than guessed.' };
  }
  const delta = age - curve.peak;
  let points: number;
  if (delta <= -3) points = 6;
  else if (delta <= 0) points = 4;
  else if (delta <= 1.5) points = 1;
  else if (delta <= 3) points = -2;
  else points = -6;
  if (points < 0) points *= curve.decline;

  const rounded = Math.round(points * 10) / 10;
  const where =
    delta <= -3
      ? `${age.toFixed(1)} is well ahead of the ${pos} peak of ${curve.peak}`
      : delta <= 0
        ? `${age.toFixed(1)} is right at or just under the ${pos} peak of ${curve.peak}`
        : delta <= 1.5
          ? `${age.toFixed(1)} is just past the ${pos} peak of ${curve.peak}`
          : `${age.toFixed(1)} is ${delta.toFixed(1)} years past the ${pos} peak of ${curve.peak}`;

  return { points: rounded, detail: `${where} (${curve.note}).` };
}

function opportunityFactor(
  depthRank: number | null,
  status: string | null,
  injuryStatus: string | null,
): { points: number; detail: string } {
  const parts: string[] = [];
  let points = 0;

  // Absence from the depth chart is not evidence of being buried — see
  // data/README.md — so an unlisted player scores zero, not a penalty.
  if (depthRank === 1) {
    points += 5;
    parts.push('listed first at his position on the depth chart');
  } else if (depthRank === 2) {
    points += 1;
    parts.push('listed second — camp charts are conservative, so treat this as a question');
  } else if (depthRank !== null && depthRank >= 3) {
    points -= 4;
    parts.push(`listed ${depthRank}th at his position`);
  } else {
    parts.push('not listed on the current depth chart, which is different from being buried');
  }

  const designation = injuryStatus?.trim() ?? '';
  if (designation && SEVERE_INJURY.test(designation)) {
    points -= 8;
    parts.push(`carries a ${designation} designation`);
  } else if (/questionable/i.test(designation)) {
    points -= 2;
    parts.push('listed Questionable');
  }
  if (status && /injured reserve|pup|inactive|practice squad/i.test(status)) {
    points -= 4;
    parts.push(`roster status: ${status}`);
  }

  return { points, detail: `${parts.join('; ')}.` };
}

export function buildPickRecommendations(input: RecommendInput): PickRecommendations {
  const {
    market,
    trending,
    players,
    draft,
    team,
    profiles,
    depthRankById = {},
    limit = DEFAULT_LIMIT,
    perPositionLimit = DEFAULT_PER_POSITION_LIMIT,
  } = input;
  const { format } = team;

  const health = diagnoseRosterHealth(team, players, draft);
  const byId = new Map(players.map((p) => [p.id, p]));
  const rostered = rosteredPlayersIncludingDraft(team, byId, draft);
  const needs = buildNeeds(team, health, rostered);
  const needByPos = new Map(needs.map((n) => [n.pos, n]));
  const profileByPlayer = new Map(profiles.map((p) => [p.playerId, p]));

  // Everyone already off the board: drafted by anyone, rostered anywhere in the
  // league, or sitting on my own roster. A recommendation for a player someone
  // else owns is noise at best and a misread at worst.
  const unavailable = new Set<string>();
  for (const pick of draft.picks) {
    if (pick.playerId) unavailable.add(pick.playerId);
    if (pick.playerName) unavailable.add(nameKey(pick.playerName, pick.pos));
  }
  for (const player of players) {
    if (!player.rosteredInLeague) continue;
    unavailable.add(player.id);
    unavailable.add(nameKey(player.name, player.pos));
  }
  for (const player of rostered) {
    unavailable.add(player.id);
    unavailable.add(nameKey(player.name, player.pos));
  }

  const playerByName = new Map(players.map((p) => [nameKey(p.name, p.pos), p]));
  const findPlayer = (playerId: string | null, name: string, pos: string): Player | undefined =>
    (playerId ? byId.get(playerId) : undefined) ?? playerByName.get(nameKey(name, pos));

  const addsBy = new Map<string, number>();
  for (const row of trending.adds) {
    addsBy.set(nameKey(row.name, row.pos), row.count);
    if (row.playerId) addsBy.set(row.playerId, row.count);
  }

  // Available market rows only. A row with neither a value nor a rank cannot be
  // scored against anything, so it is dropped rather than floated to the end.
  const available = market.players.filter((row) => {
    const pos = row.pos.toUpperCase();
    if (!isBoardPos(pos)) return false;
    const player = findPlayer(row.playerId, row.name, row.pos);
    const id = row.playerId ?? player?.id ?? null;
    if (id && unavailable.has(id)) return false;
    if (unavailable.has(nameKey(row.name, row.pos))) return false;
    return consensusEcr(row, format) !== null || consensusValue(row, format) !== null;
  });

  // The two market opinions, each ranked within position across what is still
  // available. Ranking among *available* players (rather than league-wide) is
  // the point: "WR3 on the board" is actionable, "WR23 overall" is trivia.
  const ktcPosRank = new Map<string, number>();
  const ecrPosRank = new Map<string, number>();
  for (const pos of BOARD_POSITIONS) {
    const atPos = available.filter((r) => r.pos.toUpperCase() === pos);
    [...atPos]
      .sort((a, b) => (consensusValue(b, format) ?? 0) - (consensusValue(a, format) ?? 0))
      .forEach((row, i) => ktcPosRank.set(row.fpId, i + 1));
    [...atPos]
      .filter((r) => consensusEcr(r, format) !== null)
      .sort((a, b) => consensusEcr(a, format)! - consensusEcr(b, format)!)
      .forEach((row, i) => ecrPosRank.set(row.fpId, i + 1));
  }

  const maxValue = Math.max(1, ...available.map((r) => consensusValue(r, format) ?? 0));
  const topNeed = needs[0]?.pos ?? null;

  const scored = available.map((row): Recommendation => {
    const pos = row.pos.toUpperCase() as BoardPos;
    const player = findPlayer(row.playerId, row.name, row.pos);
    const playerId = row.playerId ?? player?.id ?? null;
    const value = consensusValue(row, format);
    const ecr = consensusEcr(row, format);
    const need = needByPos.get(pos)!;
    const depthRank = (player && depthRankById[player.id]) ?? null;
    const status = player?.status ?? null;
    const injuryStatus = player?.injuryStatus ?? null;

    const marketPoints = value !== null ? (MARKET_POINTS * value) / maxValue : 0;
    const consensusPoints =
      ecr !== null ? CONSENSUS_POINTS * Math.max(0, 1 - (ecr - 1) / CONSENSUS_HORIZON) : 0;
    const base = marketPoints + consensusPoints;

    const needMultiplier = 1 + MAX_NEED_BOOST * need.needWeight;
    const weight = formatWeight(pos, format);
    const formatMultiplier = 1 - FORMAT_SWING + 2 * FORMAT_SWING * weight;

    const age = ageFactor(pos, row.age);
    const opportunity = opportunityFactor(depthRank, status, injuryStatus);

    const weighted = base * needMultiplier * formatMultiplier;
    // Raw here, normalized against the field once every player is scored. A
    // clamp at this point would flatten the top of the board into a row of
    // hundreds and throw away exactly the ordering the page exists to show.
    const raw = Math.max(0, weighted + age.points + opportunity.points);

    const ktcRank = ktcPosRank.get(row.fpId) ?? null;
    const ecrRank = ecrPosRank.get(row.fpId) ?? null;
    const marketVsConsensus = ktcRank !== null && ecrRank !== null ? ecrRank - ktcRank : null;

    const factors: ScoreFactor[] = [
      {
        id: 'market',
        label: 'Market value (KeepTradeCut)',
        points: Math.round(marketPoints * 10) / 10,
        max: MARKET_POINTS,
        detail:
          value !== null
            ? `Trade value ${value.toLocaleString()}${ktcRank ? ` — ${pos}${ktcRank} among available players` : ''}.`
            : 'No market value on file for this player.',
      },
      {
        id: 'consensus',
        label: 'Expert consensus (FantasyPros)',
        points: Math.round(consensusPoints * 10) / 10,
        max: CONSENSUS_POINTS,
        detail:
          ecr !== null
            ? `${format.superflex ? 'Superflex' : '1QB'} ECR ${ecr}${ecrRank ? ` — ${pos}${ecrRank} among available players` : ''}.`
            : 'Unranked on the consensus sheet.',
      },
      {
        id: 'need',
        label: 'Your roster gap',
        points: Math.round((weighted - base * formatMultiplier) * 10) / 10,
        max: Math.round(base * formatMultiplier * MAX_NEED_BOOST * 10) / 10,
        detail: `${pos} need scores ${(need.needWeight * 100).toFixed(0)}/100 — ${need.summary}`,
      },
      {
        id: 'format',
        label: 'League scoring',
        points: Math.round((base * formatMultiplier - base) * 10) / 10,
        max: Math.round(base * FORMAT_SWING * 10) / 10,
        detail: `${pos} weight ${weight.toFixed(2)} — ${formatWeightReason(pos, format)}`,
      },
      { id: 'age', label: 'Age curve', points: age.points, max: 6, detail: age.detail },
      {
        id: 'opportunity',
        label: 'Opportunity and availability',
        points: opportunity.points,
        max: 5,
        detail: opportunity.detail,
      },
    ];

    return {
      key: row.fpId || nameKey(row.name, row.pos),
      playerId,
      name: row.name,
      pos,
      nflTeam: row.nflTeam,
      age: row.age,
      rank: 0,
      score: raw,
      factors,
      why: [],
      profile: playerId ? (profileByPlayer.get(playerId) ?? null) : null,
      ecr,
      posEcr: row.posEcr,
      value,
      ktcPosRank: ktcRank,
      ecrPosRank: ecrRank,
      marketVsConsensus,
      depthRank,
      status,
      injuryStatus,
      adds:
        (playerId ? addsBy.get(playerId) : undefined) ?? addsBy.get(nameKey(row.name, row.pos)) ?? null,
      fillsTopNeed: pos === topNeed,
    };
  });

  // Normalize so the best player still on the board reads 100. The score is a
  // comparison, not a measurement — there is no absolute "82 out of 100" for a
  // football player — so anchoring it to the actual field is both more honest
  // and more useful than a fixed ceiling nobody reaches. Factor points are
  // scaled by the same constant so the bars still sum to the total.
  const best = Math.max(1, ...scored.map((r) => r.score));
  const k = 100 / best;
  const round = (n: number) => Math.round(n * 10) / 10;

  const allSorted = scored
    .sort((a, b) => b.score - a.score || (a.ecr ?? Infinity) - (b.ecr ?? Infinity))
    .map((rec, i) => ({
      ...rec,
      rank: i + 1,
      score: round(rec.score * k),
      factors: rec.factors.map((f) => ({ ...f, points: round(f.points * k), max: round(f.max * k) })),
    }));

  for (const rec of allSorted) {
    rec.why = explain(rec, needByPos.get(rec.pos)!, format);
  }

  const ordered = allSorted.slice(0, limit);

  // The same players again, grouped under the hole each one fills, needs first.
  // The flat list answers "who is best?"; this answers "who is best at the thing
  // I am actually short of?" — and those are different questions whenever the
  // top of the board is a position you have already filled.
  const byNeed = needs.map((need) => ({
    need,
    players: allSorted.filter((r) => r.pos === need.pos).slice(0, perPositionLimit),
  }));

  const coaching = health.draftCoaching;

  return {
    recommendations: ordered,
    byNeed,
    needs,
    health,
    headline: coaching?.headline ?? buildStaticHeadline(needs),
    nextPickNumber: coaching?.nextPickNumber ?? null,
    picksUntilNext: coaching?.picksUntilNext ?? null,
    marketCapturedAt: market.capturedAt,
    sources: market.sources,
    weights: {
      marketPoints: MARKET_POINTS,
      consensusPoints: CONSENSUS_POINTS,
      maxNeedBoost: MAX_NEED_BOOST,
      formatSwing: FORMAT_SWING,
      byPosition: BOARD_POSITIONS.map((pos) => ({
        pos,
        weight: formatWeight(pos, format),
        reason: formatWeightReason(pos, format),
      })),
    },
  };
}

function buildStaticHeadline(needs: PositionNeed[]): string {
  const worst = needs[0];
  if (!worst) return 'No roster data to grade — fill the roster before trusting a recommendation.';
  return `No draft in progress. Biggest standing hole: ${worst.pos} — ${worst.summary}`;
}

/**
 * The "why this player" prose.
 *
 * Each line is derived from a factor that actually moved the score, so the text
 * and the number can never tell different stories. Lines that would say nothing
 * are omitted rather than padded — a rationale that lists every factor for
 * every player trains the eye to skip all of them.
 */
function explain(rec: Recommendation, need: PositionNeed, format: Team['format']): string[] {
  const out: string[] = [];

  if (rec.fillsTopNeed) {
    out.push(
      `Closes your biggest hole. ${rec.pos} is the weakest room on the roster — ${need.summary}${
        need.attention ? ` ${need.attention}` : ''
      }`,
    );
  } else if (need.openStarters > 0) {
    out.push(
      `Fills a real slot: ${formatSlots(need.openStarters)} of ${formatSlots(need.requiredStarters)} starting ${rec.pos} spots are still open, though ${rec.pos} is not your most urgent room.`,
    );
  } else {
    out.push(
      `Not a need pick — your ${rec.pos} slots are filled, so this is value over need. Take him only if the gap in quality is wide.`,
    );
  }

  if (rec.value !== null && rec.ktcPosRank !== null) {
    const ecrPart =
      rec.ecr !== null
        ? ` Consensus has him at ${format.superflex ? 'SF ' : ''}ECR ${rec.ecr}${
            rec.ecrPosRank !== null ? ` (${rec.pos}${rec.ecrPosRank} available)` : ''
          }.`
        : ' He is unranked on the consensus sheet, which is its own warning.';
    out.push(
      `The market pays ${rec.value.toLocaleString()} for him — ${rec.pos}${rec.ktcPosRank} among everyone still on the board.${ecrPart}`,
    );
  }

  // The disagreement between the two sources is the most useful thing on the
  // row when it is large, and worth nothing when it is small, so it only
  // appears past a threshold.
  if (rec.marketVsConsensus !== null && Math.abs(rec.marketVsConsensus) >= 3) {
    out.push(
      rec.marketVsConsensus > 0
        ? `Sources disagree in his favor: KeepTradeCut ranks him ${rec.marketVsConsensus} spots higher at ${rec.pos} than the expert consensus does. The trade market is usually the faster-moving of the two.`
        : `Sources disagree against him: the expert consensus is ${Math.abs(rec.marketVsConsensus)} spots higher at ${rec.pos} than the trade market. You would be buying at the analysts' price, not the market's.`,
    );
  }

  const formatFactor = rec.factors.find((f) => f.id === 'format');
  if (formatFactor && Math.abs(formatFactor.points) >= 1) {
    out.push(
      `${formatFactor.points > 0 ? 'Format helps him' : 'Format works against him'}: ${formatFactor.detail}`,
    );
  }

  const age = rec.factors.find((f) => f.id === 'age');
  if (age && Math.abs(age.points) >= 1) out.push(age.detail);

  const opportunity = rec.factors.find((f) => f.id === 'opportunity');
  if (opportunity && Math.abs(opportunity.points) >= 1) out.push(opportunity.detail);

  return out;
}
