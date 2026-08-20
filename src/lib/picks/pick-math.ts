/**
 * Where a manager's picks actually fall.
 *
 * This is arithmetic, not opinion, and it was wrong in a way that mattered: the
 * old version assumed every even round reverses, which is true of a plain snake
 * and false of the format this league actually uses. Sleeper supports a
 * **reversal round** (commonly "3rd round reversal"): the snake turns as usual
 * until that round, that round runs in the same direction as the one before it,
 * and the alternation continues from there. From round three onwards every
 * downstream pick number moves, so "your next pick is #100" was off by four
 * picks and a whole round of planning.
 *
 * Two rules keep this honest:
 *   - Picks already made are the authority on the pattern. `inferReversalRound`
 *     reads the direction of each completed round rather than trusting a
 *     setting that may not be present in the API payload.
 *   - Nothing is guessed. With no evidence either way the answer is 0 — a plain
 *     snake — which is what Sleeper defaults to.
 */

/** A pick's overall number, its round, and its position within that round. */
export interface PickCoordinate {
  overall: number;
  round: number;
  slot: number;
}

interface Shape {
  teams: number;
  type: string;
  /** Round that repeats the previous round's direction. 0 = plain snake. */
  reversalRound?: number;
}

function isSnake(type: string): boolean {
  return !type.includes('linear') && !type.includes('auction');
}

/**
 * Does `round` run from slot N back to slot 1?
 *
 * Without a reversal round this is "every even round". With one, the reversal
 * round repeats its predecessor's direction, so every round from there on flips
 * parity relative to a plain snake.
 */
export function roundIsReversed(round: number, { type, reversalRound = 0 }: Omit<Shape, 'teams'>): boolean {
  if (!isSnake(type)) return false;
  const reversed = round % 2 === 0;
  if (reversalRound >= 2 && round >= reversalRound) return !reversed;
  return reversed;
}

/** Overall pick numbers owned by a draft slot, ascending. */
export function pickNumbersForSlot(
  slot: number,
  teams: number,
  rounds: number,
  type: string,
  reversalRound = 0,
): number[] {
  if (slot < 1 || slot > teams || teams < 1 || rounds < 1) return [];
  if (type.includes('auction')) return [];

  const picks: number[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const positionInRound = roundIsReversed(round, { type, reversalRound }) ? teams - slot + 1 : slot;
    picks.push((round - 1) * teams + positionInRound);
  }
  return picks;
}

/** The round and slot an overall pick number lands on. */
export function pickCoordinate(overall: number, { teams, type, reversalRound = 0 }: Shape): PickCoordinate {
  const round = Math.ceil(overall / teams);
  const indexInRound = ((overall - 1) % teams) + 1;
  const slot = roundIsReversed(round, { type, reversalRound }) ? teams - indexInRound + 1 : indexInRound;
  return { overall, round, slot };
}

/** "3.04 (#33)" — how a draft room says a pick out loud. */
export function formatPickNumber(overall: number, shape: Shape): string {
  const { round, slot } = pickCoordinate(overall, shape);
  return `${round}.${String(slot).padStart(2, '0')} (#${overall})`;
}

/**
 * Read the reversal round out of the picks already made.
 *
 * Each completed round has a direction, readable from the draft slots of its
 * first and last picks. In a plain snake the direction alternates forever; a
 * reversal round is the one round that repeats its predecessor's direction. A
 * round with fewer than two picks has no readable direction and is skipped —
 * which is also why a draft this thin returns 0 rather than a guess.
 */
export function inferReversalRound(
  picks: { pick: number; round: number; slot: number }[],
  teams: number,
): number {
  if (teams < 2) return 0;

  const ends = new Map<number, { first: { pick: number; slot: number }; last: { pick: number; slot: number } }>();
  for (const pick of picks) {
    const seen = ends.get(pick.round);
    if (!seen) {
      ends.set(pick.round, { first: pick, last: pick });
      continue;
    }
    if (pick.pick < seen.first.pick) seen.first = pick;
    if (pick.pick > seen.last.pick) seen.last = pick;
  }

  const directions = new Map<number, 'forward' | 'reverse'>();
  for (const [round, { first, last }] of ends) {
    if (first.pick === last.pick) continue; // One pick tells you nothing.
    directions.set(round, first.slot < last.slot ? 'forward' : 'reverse');
  }

  for (const round of [...directions.keys()].sort((a, b) => a - b)) {
    if (round < 2) continue;
    const previous = directions.get(round - 1);
    if (previous && previous === directions.get(round)) return round;
  }
  return 0;
}
