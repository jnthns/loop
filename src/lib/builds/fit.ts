import type { Draft } from '~/lib/schemas/draft';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Team } from '~/lib/schemas/team';
import { ARCHETYPES, type Archetype } from './archetypes';
import type { BuildFit, FitBand, Reason } from './types';

type Pos = 'QB' | 'RB' | 'WR' | 'TE';
const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE'];

const SUPPLY_WEIGHTS = [3, 3, 2, 2, 1, 1, 1, 1];

/**
 * The four components sum to 100. valueEdge carries the most weight of the
 * market-derived pieces because the superflex premium is the single largest
 * measured effect in this data — QBs price at roughly 3x their one-QB value
 * while WRs price below theirs — and a scoring model for a superflex league
 * that does not let that dominate is not describing this league.
 */
const FORMAT_FIT_MAX = 30;
const SUPPLY_FIT_MAX = 25;
const VALUE_EDGE_MAX = 30;
const AGE_FIT_MAX = 15;

/** Dynasty's dividing line: 25 and under is an appreciating asset. */
const YOUNG_AGE = 25;

/**
 * Band thresholds are calibrated against the achievable range, not a tidy 0–100
 * intuition. No archetype can score near 100: `valueEdge` is a weighted mean of
 * normalized position edges, so only a build that wanted nothing but QBs could
 * max it, and no real build does. Against the live board the field lands roughly
 * 57–76, so a 78 cutoff would leave the top band permanently empty and render
 * the leading recommendation as merely "FITS".
 */
export const BAND_THRESHOLDS: { min: number; band: FitBand }[] = [
  { min: 74, band: 'BEST FIT' },
  { min: 58, band: 'FITS' },
  { min: 42, band: 'STRETCH' },
  { min: -Infinity, band: 'FIGHTS THE FORMAT' },
];

export function bandFor(score: number): FitBand {
  return (BAND_THRESHOLDS.find((t) => score >= t.min) as { band: FitBand }).band;
}

/** Startable slots a position gets, counting FLEX at 1/3 and SUPERFLEX at 1/4. */
function startableSlots(pos: Pos, format: Team['format']): number {
  let count = 0;
  for (const slot of format.rosterSlots) {
    if (slot.kind === pos) count += 1;
    else if (slot.kind === 'FLEX' && pos !== 'QB') count += 1 / 3;
    else if (slot.kind === 'SUPERFLEX') count += 1 / 4;
  }
  return count;
}

function totalStartingSlots(format: Team['format']): number {
  return format.rosterSlots.filter((s) =>
    (['QB', 'RB', 'WR', 'TE', 'FLEX', 'SUPERFLEX'] as const).includes(
      s.kind as 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'SUPERFLEX',
    ),
  ).length;
}

/**
 * How well an archetype's position mix lines up with the slots this format
 * actually starts, as the cosine of the two vectors.
 *
 * Cosine rather than a weighted sum on purpose. A weighted sum normalized by
 * the largest weight rewards *breadth*: a build that says "I want all four
 * positions equally" can never be badly served, so the vaguest archetypes win
 * by construction and a sharp, correct thesis like superflex-QB-heavy scores
 * below "balanced". Cosine measures alignment, which is the thing actually
 * being asked — a concentrated build scores high when it is concentrated on
 * what the format rewards, and low when it is not.
 *
 * Note this component deliberately knows nothing about scarcity: three WR slots
 * really do mean the format starts more receivers than anything else. Whether a
 * position is *hard to acquire* is what `valueEdgeScore` measures from market
 * prices, and keeping the two apart is what stops one effect being counted twice.
 */
function formatFit(archetype: Archetype, format: Team['format']): number {
  const total = totalStartingSlots(format);
  let score = 0;
  if (total > 0) {
    const weights = POSITIONS.map((p) => archetype.posWeight[p]);
    const shares = POSITIONS.map((p) => startableSlots(p, format) / total);
    const dot = weights.reduce((sum, w, i) => sum + w * (shares[i] as number), 0);
    const wNorm = Math.sqrt(weights.reduce((sum, w) => sum + w * w, 0));
    const sNorm = Math.sqrt(shares.reduce((sum, s) => sum + s * s, 0));
    const cosine = wNorm > 0 && sNorm > 0 ? dot / (wNorm * sNorm) : 0;
    score = FORMAT_FIT_MAX * cosine;
  }
  if (archetype.needsSuperflex && format.superflex) score += 8;
  if (archetype.needsTePremium && format.tePremium >= 0.5) score += 6;
  if (archetype.needsSuperflex && !format.superflex) score -= 10;
  return score;
}

/**
 * Whether the age thesis this build rests on is supported by the board.
 *
 * `ageBias` is the only thing separating youth-first from win-now — they are
 * deliberate opposites on one axis — so leaving it out of the score made the
 * two archetypes indistinguishable and let both land as the top recommendation
 * at once, which cannot be true.
 *
 * `youthShare` is the fraction of the top of the value board held by players 25
 * and under. A youth build wants that share to be high (the young assets are
 * where the value is); a win-now build wants it low (veterans are going cheap).
 * The blend keeps a neutral archetype at the midpoint rather than punishing it.
 */
function ageFit(archetype: Archetype, market: Market, topN = 60): number {
  const board = [...market.players].sort((a, b) => b.valueSf - a.valueSf).slice(0, topN);
  const totalValue = board.reduce((sum, p) => sum + p.valueSf, 0);
  if (totalValue <= 0) return AGE_FIT_MAX / 2;

  const youngValue = board
    .filter((p) => p.age !== null && p.age <= YOUNG_AGE)
    .reduce((sum, p) => sum + p.valueSf, 0);
  const youthShare = youngValue / totalValue;

  // ageBias +1 -> youthShare, -1 -> its complement, 0 -> the midpoint.
  const align = 0.5 + archetype.ageBias * (youthShare - 0.5);
  return AGE_FIT_MAX * Math.max(0, Math.min(1, align));
}

/** The share of top-board value held by players 25 and under — reported as evidence. */
export function youthShareOfBoard(market: Market, topN = 60): number {
  const board = [...market.players].sort((a, b) => b.valueSf - a.valueSf).slice(0, topN);
  const totalValue = board.reduce((sum, p) => sum + p.valueSf, 0);
  if (totalValue <= 0) return 0;
  return (
    board.filter((p) => p.age !== null && p.age <= YOUNG_AGE).reduce((sum, p) => sum + p.valueSf, 0) /
    totalValue
  );
}

/** Players not already off the board by the given overall pick, per `ecrSf`. */
function playersAvailableAt(players: MarketPlayerRow[], pick: number): MarketPlayerRow[] {
  return players.filter((p) => p.ecrSf !== null && p.ecrSf >= pick - 2 && p.ecrSf <= pick + 10);
}

function supplyFit(archetype: Archetype, market: Market, draft: Draft): number {
  const owned = draft.myPicks.slice(0, 8);
  if (owned.length === 0 || market.players.length === 0) return 0;

  const wanted = new Set(archetype.plan.flatMap((step) => step.want));
  const supplies: number[] = [];
  for (const pick of owned) {
    const available = playersAvailableAt(market.players, pick);
    if (available.length === 0) {
      supplies.push(0);
      continue;
    }
    const maxOverall = Math.max(...available.map((p) => p.valueSf));
    const wantedAvailable = available.filter((p) => wanted.has(p.pos as Pos));
    const maxWanted = wantedAvailable.length > 0 ? Math.max(...wantedAvailable.map((p) => p.valueSf)) : 0;
    supplies.push(maxOverall > 0 ? maxWanted / maxOverall : 0);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  supplies.forEach((s, i) => {
    const w = SUPPLY_WEIGHTS[i] ?? 1;
    weightedSum += s * w;
    weightTotal += w;
  });
  const weightedMean = weightTotal > 0 ? weightedSum / weightTotal : 0;
  return SUPPLY_FIT_MAX * weightedMean;
}

/** mean(valueSf / value1qb) over the top 24 (by valueSf) at a position. */
function sfPremium(players: MarketPlayerRow[], pos: Pos): number {
  const eligible = players
    .filter((p) => p.pos === pos && p.value1qb !== null && p.value1qb > 0)
    .sort((a, b) => b.valueSf - a.valueSf)
    .slice(0, 24);
  if (eligible.length === 0) return 0;
  const ratios = eligible.map((p) => p.valueSf / (p.value1qb as number));
  return ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
}

/** sfPremium per position, normalized 0..1 across the four positions. */
export function computeValueEdges(market: Market): Record<Pos, number> {
  const premiums = Object.fromEntries(POSITIONS.map((pos) => [pos, sfPremium(market.players, pos)])) as Record<
    Pos,
    number
  >;
  const values = POSITIONS.map((p) => premiums[p]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const edges = {} as Record<Pos, number>;
  for (const pos of POSITIONS) {
    edges[pos] = range > 0 ? (premiums[pos] - min) / range : 0;
  }
  return edges;
}

function valueEdgeScore(archetype: Archetype, edges: Record<Pos, number>): number {
  const weightTotal = POSITIONS.reduce((sum, p) => sum + archetype.posWeight[p], 0);
  if (weightTotal === 0) return 0;
  const weighted = POSITIONS.reduce((sum, p) => sum + archetype.posWeight[p] * edges[p], 0);
  return (VALUE_EDGE_MAX * weighted) / weightTotal;
}

/** Largest normalized tier breaks in the value board — evidence for "reach across a tier break." */
export function detectValueCliffs(
  market: Market,
  topN = 60,
): { afterRank: number; before: number; after: number; drop: number }[] {
  const sorted = [...market.players].sort((a, b) => b.valueSf - a.valueSf).slice(0, topN);
  const cliffs: { afterRank: number; before: number; after: number; drop: number }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const before = sorted[i]!.valueSf;
    const after = sorted[i + 1]!.valueSf;
    if (before <= 0) continue;
    const drop = (before - after) / before;
    cliffs.push({ afterRank: i + 1, before, after, drop });
  }
  return cliffs.sort((a, b) => b.drop - a.drop);
}

function buildReasons(
  archetype: Archetype,
  format: Team['format'],
  components: { formatFit: number; supplyFit: number; valueEdge: number; ageFit: number },
  edges: Record<Pos, number>,
  premiums: { qb: number; wr: number },
  youthShare: number,
  archetypeAgeBias: number,
): Reason[] {
  const startableQbs = format.teams * 2;
  const reasons: Reason[] = [
    {
      text: 'Superflex makes the quarterback room the scarcest thing in the draft',
      evidence: `${format.teams} teams x 2 QB-capable slots = ${startableQbs} startable QBs against ~32 NFL starters`,
    },
    {
      text: 'The market prices superflex QBs well above their one-QB value, WRs barely at all',
      evidence: `mean valueSf/value1qb = ${premiums.qb.toFixed(2)} across the top 24 QBs (${premiums.wr.toFixed(2)} for WRs)`,
    },
    {
      text: `${archetype.name} scores ${components.formatFit.toFixed(1)}/${FORMAT_FIT_MAX} on how well its position mix aligns with the slots this format starts`,
      evidence: `formatFit = ${FORMAT_FIT_MAX} x cosine(position weights, slot shares) + bonuses/penalties = ${components.formatFit.toFixed(2)}`,
    },
    {
      text: `From this draft slot, the board is expected to supply this build at ${((components.supplyFit / SUPPLY_FIT_MAX) * 100).toFixed(0)}% of ideal`,
      evidence: `supplyFit = ${components.supplyFit.toFixed(2)} of a possible ${SUPPLY_FIT_MAX}`,
    },
    {
      text: `This build leans on the positions the market currently underprices relative to their superflex value`,
      evidence: `valueEdge = ${components.valueEdge.toFixed(2)} of a possible ${VALUE_EDGE_MAX} (edge weights: ${POSITIONS.map((p) => `${p}=${edges[p].toFixed(2)}`).join(', ')})`,
    },
    {
      text:
        archetypeAgeBias > 0
          ? 'This build wants the young end of the board, and that is where the value sits'
          : archetypeAgeBias < 0
            ? 'This build wants proven veterans, who come at a discount while the room chases youth'
            : 'This build takes no side on age, so the board\'s age skew neither helps nor hurts it',
      evidence: `players 25 and under hold ${(youthShare * 100).toFixed(0)}% of top-60 board value; ageBias ${archetypeAgeBias} -> ageFit = ${components.ageFit.toFixed(2)} of a possible ${AGE_FIT_MAX}`,
    },
  ];
  return reasons;
}

export function scoreArchetypes(input: {
  format: Team['format'];
  market: Market;
  draft: Draft;
  archetypes?: Archetype[];
}): BuildFit[] {
  const archetypes = input.archetypes ?? ARCHETYPES;
  const edges = computeValueEdges(input.market);
  const qbPremium = sfPremium(input.market.players, 'QB');
  const youthShare = youthShareOfBoard(input.market);
  const wrPremium = sfPremium(input.market.players, 'WR');

  const fits: BuildFit[] = archetypes.map((archetype) => {
    const components = {
      formatFit: formatFit(archetype, input.format),
      supplyFit: supplyFit(archetype, input.market, input.draft),
      valueEdge: valueEdgeScore(archetype, edges),
      ageFit: ageFit(archetype, input.market),
    };
    const raw = components.formatFit + components.supplyFit + components.valueEdge + components.ageFit;
    const score = Math.max(0, Math.min(100, raw));
    return {
      id: archetype.id,
      score,
      band: bandFor(score),
      reasons: buildReasons(
        archetype,
        input.format,
        components,
        edges,
        { qb: qbPremium, wr: wrPremium },
        youthShare,
        archetype.ageBias,
      ),
      components,
    };
  });

  return fits.sort((a, b) => b.score - a.score);
}
