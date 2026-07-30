import type { Draft } from '~/lib/schemas/draft';
import type { Market, MarketPlayerRow } from '~/lib/schemas/market';
import type { Team } from '~/lib/schemas/team';
import type { Trending } from '~/lib/schemas/trending';
import { sourceLinks } from '~/lib/market/dynastyprocess';
import { defaultTier } from '~/lib/sleeper/map';
import type { Verdict } from '~/lib/nfl/types';
import type { Archetype } from './archetypes';
import type { PickCandidate, PickSuggestion } from './types';

/**
 * The pick engine: for every owned pick, simulates the room drafting between
 * this pick and the last one, scores the top of the remaining board against
 * the chosen archetype's plan, and surfaces a primary plus two alternates.
 *
 * Deterministic by construction — no Math.random(), no Date.now() — because
 * `astro build` runs on every six-hourly CI refresh and a non-reproducible
 * page would produce a spurious diff every time.
 */

type Pos = 'QB' | 'RB' | 'WR' | 'TE';
const POSITIONS: Pos[] = ['QB', 'RB', 'WR', 'TE'];

/** Superflex pulls QBs off the board earlier than their raw ECR reads. */
const SUPERFLEX_QB_ADJUST = 6;
/** TE premium is not enough to overcome TE's shallow draft-capital demand — they still go a bit late. */
const TE_PREMIUM_ADJUST = 4;

/** Top-of-board slice considered at each pick. */
const CANDIDATE_POOL = 40;
/** From this round on, no positional need is left to fill — the objective shifts to age/stash value. */
const STASH_ROUND = 19;

/** How the room actually drafts, not how a ranking sheet reads. Lower = earlier. */
function adjustedEcr(row: MarketPlayerRow, format: Team['format']): number {
  const ecr = row.ecrSf as number;
  if (format.superflex && row.pos === 'QB') return ecr - SUPERFLEX_QB_ADJUST;
  if (format.tePremium >= 0.5 && row.pos === 'TE') return ecr + TE_PREMIUM_ADJUST;
  return ecr;
}

/** Unique key for a market row — fpId is always present, unlike playerId/sleeperId. */
function keyOf(row: MarketPlayerRow): string {
  return row.fpId || `${row.name}|${row.pos}`;
}

/** Percentile rank of `value` within `values`, 0-100. A field of one is a trivial 100. */
function percentileRank(value: number, values: number[]): number {
  if (values.length <= 1) return 100;
  const countAtOrBelow = values.filter((v) => v <= value).length;
  return ((countAtOrBelow - 1) / (values.length - 1)) * 100;
}

/** Starting slots a position can fill, counting FLEX at 1/3 and SUPERFLEX at 1/4. */
function startableSlots(pos: Pos, format: Team['format']): number {
  let startable = 0;
  for (const slot of format.rosterSlots) {
    if (slot.kind === pos) startable += 1;
    else if (slot.kind === 'FLEX' && pos !== 'QB') startable += 1 / 3;
    else if (slot.kind === 'SUPERFLEX') startable += 1 / 4;
  }
  return startable;
}

/** The fewest of a position needed to field a legal lineup every week. */
function startingFloor(pos: Pos, format: Team['format']): number {
  return Math.max(1, Math.ceil(startableSlots(pos, format)));
}

/**
 * How many of a position a roster can actually use.
 *
 * This is what stops the engine drafting a whole quarterback room. In superflex
 * `valueSf` carries the ~3x QB premium, so "highest market value available" is
 * almost always a quarterback — but only two of them can start. Without a
 * capacity ceiling the plan's minimums are satisfied and nothing ever says the
 * roster is full, so the sheet returned seven QBs in eight picks and called it
 * a robust-QB build. Market value a roster cannot deploy is not value.
 */
function positionCapacity(pos: Pos, format: Team['format']): number {
  const startable = startableSlots(pos, format);
  // ceil(startable) + 1 — the starters, rounded up, plus one backup. Doubling
  // the startable count instead left room for four tight ends in a one-TE
  // league, because FLEX credits a third of a slot to each of RB/WR/TE.
  return Math.max(1, Math.ceil(startable) + 1);
}

/**
 * 100 when the position fills an unmet requirement of the *nearest* unmet plan
 * step at this round, 55 when it fills some other step in the plan, 15
 * otherwise — then damped once the roster already holds as many of that
 * position as it can use. Past capacity the signal decays rather than cutting
 * to zero, so a genuinely elite falling asset can still win a pick on value
 * alone, but a sixth quarterback cannot.
 */
type NeedKind = 'required' | 'wanted' | 'value-only';

function needScore(
  pos: Pos,
  round: number,
  archetype: Archetype,
  filled: Record<Pos, number>,
  format: Team['format'],
): { score: number; kind: NeedKind } {
  // The format's own floor, which binds no matter what the archetype prefers.
  // Without it, any build whose plan does not name QB drafted none at all —
  // robust-RB, hero-RB and TE-premium each returned zero quarterbacks across
  // all 30 rounds of a superflex startup, a roster that cannot legally start.
  // An archetype chooses the *order* it fills the lineup, never whether to.
  let urgent = false;
  let kind: NeedKind = 'value-only';
  let base = 15;
  if ((filled[pos] ?? 0) < startingFloor(pos, format)) {
    base = 85;
    urgent = true;
    kind = 'required';
  }
  for (const step of archetype.plan) {
    if (round > step.throughRound) continue;
    const metCount = step.want.reduce((sum, w) => sum + (filled[w] ?? 0), 0);
    if (metCount < step.minCount && step.want.includes(pos)) {
      base = 100;
      urgent = true;
      kind = 'required';
      break;
    }
  }
  if (base === 15 && archetype.plan.some((step) => step.want.includes(pos))) {
    base = 55;
    kind = 'wanted';
  }

  // An archetype's posWeight is its stated preference; without this the plan's
  // explicit steps were the only thing steering the sheet, so a build could
  // stack a position it weights lowest purely on market value.
  //
  // Preference does NOT dilute an unmet plan requirement, though. Zero-RB
  // weights running backs at 0.4, and applying that to an urgent step
  // suppressed them so hard the build never took one at all — which is not the
  // strategy, just a roster that cannot fill two RB slots.
  if (!urgent) base *= archetype.posWeight[pos];

  const held = filled[pos] ?? 0;
  const capacity = positionCapacity(pos, format);
  const damped = held < capacity ? base : base / (1 + 1.5 * (held - capacity + 1));
  return { score: damped, kind };
}

/**
 * Position-aware youth curve from `defaultTier()`'s own age thresholds,
 * scaled by the archetype's `ageBias` the same way `ageFit()` in fit.ts
 * blends `youthShare` — ageBias +1 wants the young end, -1 wants the old end,
 * 0 is indifferent.
 */
function ageScore(pos: Pos, age: number | null, ageBias: number): number {
  if (age === null) return 50;
  const tier = defaultTier(pos, age);
  const youthValue = tier === 'starter' ? 90 : tier === 'win-now' ? 50 : 15;
  const score = 50 + ageBias * (youthValue - 50);
  return Math.max(0, Math.min(100, score));
}

/** Rewards ecrSf > pick (likely to last), penalizes ecrSf << pick (won't be there). */
function availabilityScore(ecrSf: number, pick: number): number {
  const diff = ecrSf - pick;
  return Math.max(0, Math.min(100, 50 + diff * 3));
}

/** Same bucketing idiom as trendingPoints() in nfl/recommend.ts, rescaled to 0-100. */
function marketScore(row: MarketPlayerRow, trending: Trending | undefined): number {
  if (!trending) return 0;
  const entry = [...trending.adds, ...trending.drops].find(
    (t) => (row.sleeperId && t.sleeperId === row.sleeperId) || (row.playerId && t.playerId === row.playerId),
  );
  if (!entry) return 0;
  const count = entry.count;
  const points = count >= 5000 ? 15 : count >= 2000 ? 10 : count >= 500 ? 5 : 0;
  return (points / 15) * 100;
}

interface Weighted {
  value: number;
  need: number;
  age: number;
  availability: number;
  market: number;
}

const MAIN_WEIGHTS = { value: 0.45, need: 0.25, age: 0.15, availability: 0.1, market: 0.05 };
/** Rounds 19+: no positional need is left, so the objective shifts to age/stash value. */
const STASH_WEIGHTS = { value: 0.3, need: 0, age: 0.5, availability: 0.2, market: 0 };

function totalScore(components: Weighted, round: number): number {
  const w = round >= STASH_ROUND ? STASH_WEIGHTS : MAIN_WEIGHTS;
  return (
    w.value * components.value +
    w.need * components.need +
    w.age * components.age +
    w.availability * components.availability +
    w.market * components.market
  );
}

function verdictFor(score: number, surplus: number): Verdict {
  if (score >= 75 && surplus >= 500) return 'STRONG PICK';
  if (score >= 55) return 'PICK';
  if (score >= 35) return 'HOLD';
  return 'AVOID';
}

function toCandidate(row: MarketPlayerRow, score: number): PickCandidate {
  return {
    playerId: row.playerId,
    name: row.name,
    pos: row.pos as Pos,
    valueSf: row.valueSf,
    ecrSf: row.ecrSf,
    score,
  };
}

function buildReason(
  archetype: Archetype,
  primaryRow: MarketPlayerRow,
  pick: number,
  round: number,
  needKind: NeedKind,
  surplus: number,
  nextValueSf: number,
): string {
  const needClause =
    needKind === 'required'
      ? 'fills a starting slot this build has not yet covered'
      : needKind === 'wanted'
        ? 'fills a position this build wants eventually'
        : "is simply the board's best value here";

  // Surplus is routinely negative: the engine trades raw market value for fit,
  // which is the whole point of drafting to a plan. Calling that an "edge" —
  // as an earlier version did, rendering "a -855-point valueSf edge" — states
  // the opposite of what happened.
  const valueClause =
    surplus >= 0
      ? `worth ${surplus.toFixed(0)} more valueSf than the next option at ${nextValueSf}`
      : `costing ${Math.abs(surplus).toFixed(0)} valueSf against the richer option at ${nextValueSf}, a trade this plan makes deliberately`;

  return `${primaryRow.name} (${primaryRow.pos}) is the top-scoring option at pick ${pick} (round ${round}) for a ${archetype.name} build — it ${needClause}, ${valueClause}.`;
}

export function planPicks(input: {
  archetype: Archetype;
  market: Market;
  draft: Draft;
  format: Team['format'];
  trending?: Trending;
}): PickSuggestion[] {
  const { archetype, market, draft, format, trending } = input;

  const board = market.players
    .filter((p) => POSITIONS.includes(p.pos as Pos) && p.ecrSf !== null)
    .map((row) => ({ row, adjustedEcr: adjustedEcr(row, format) }))
    .sort((a, b) => a.adjustedEcr - b.adjustedEcr);

  if (board.length === 0) return [];

  let remaining = board;
  let previousPick = 0;
  const filled: Record<Pos, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const suggested = new Set<string>();
  const results: PickSuggestion[] = [];

  draft.myPicks.forEach((pick, i) => {
    const round = i + 1;

    // Consume opponent picks between the last owned pick and this one.
    const opponentPicks = Math.max(0, pick - previousPick - 1);
    remaining = remaining.slice(Math.min(opponentPicks, remaining.length));
    previousPick = pick;

    const pool = remaining.slice(0, CANDIDATE_POOL).filter((c) => !suggested.has(keyOf(c.row)));
    if (pool.length === 0) return;

    const values = pool.map((c) => c.row.valueSf);

    const scored = pool
      .map((c) => {
        const pos = c.row.pos as Pos;
        const need = needScore(pos, round, archetype, filled, input.format);
        const components: Weighted = {
          value: percentileRank(c.row.valueSf, values),
          need: need.score,
          age: ageScore(pos, c.row.age, archetype.ageBias),
          availability: availabilityScore(c.row.ecrSf as number, pick),
          market: marketScore(c.row, trending),
        };
        return {
          entry: c,
          score: totalScore(components, round),
          needComponent: components.need,
          needKind: need.kind,
        };
      })
      .sort((a, b) => b.score - a.score);

    const winner = scored[0]!;
    const rest = scored.slice(1, 3);

    filled[winner.entry.row.pos as Pos] = (filled[winner.entry.row.pos as Pos] ?? 0) + 1;
    suggested.add(keyOf(winner.entry.row));
    for (const alt of rest) suggested.add(keyOf(alt.entry.row));
    remaining = remaining.filter((c) => keyOf(c.row) !== keyOf(winner.entry.row));

    const nextValueSf = rest[0]?.entry.row.valueSf ?? 0;
    const surplus = winner.entry.row.valueSf - nextValueSf;

    results.push({
      pick,
      round,
      archetypeId: archetype.id,
      verdict: verdictFor(winner.score, surplus),
      primary: toCandidate(winner.entry.row, winner.score),
      alternates: rest.map((r) => toCandidate(r.entry.row, r.score)),
      reason: buildReason(archetype, winner.entry.row, pick, round, winner.needKind, surplus, nextValueSf),
      evidence: [
        `valueSf ${winner.entry.row.valueSf} vs ${nextValueSf} for the next best at pick ${pick}`,
        `adjustedEcr ${winner.entry.adjustedEcr.toFixed(1)} (raw ecrSf ${winner.entry.row.ecrSf}) against a pick at ${pick}`,
        `need score ${winner.needComponent.toFixed(0)}/100 (${winner.needKind}) for ${winner.entry.row.pos} under the ${archetype.name} plan at round ${round}`,
        `total score ${winner.score.toFixed(1)}/100 using the ${round >= STASH_ROUND ? 'stash' : 'main'} weighting`,
      ],
      citations: sourceLinks(winner.entry.row),
    });
  });

  return results;
}
