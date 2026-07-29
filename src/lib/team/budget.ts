import type { Budget } from '~/lib/schemas/team';

/**
 * Budget math. Kept separate from the UI because it is the one place on the team
 * page where being wrong is expensive — an auction cap you have miscounted is
 * how you end a startup draft with an unfillable roster spot.
 */

export function allocated(budget: Budget): number {
  return budget.entries.reduce((sum, entry) => sum + entry.amount, 0);
}

export function remaining(budget: Budget): number {
  return round2(budget.total - allocated(budget));
}

export function percentSpent(budget: Budget): number {
  if (budget.total <= 0) return 0;
  return Math.min(100, Math.max(0, (allocated(budget) / budget.total) * 100));
}

/** True when the ledger is spent past its ceiling — surfaced, never silently clamped. */
export function isOverspent(budget: Budget): boolean {
  return remaining(budget) < 0;
}

/**
 * What is left per still-unfilled roster spot. In an auction this is the number
 * that actually constrains you: it is why "I have $40 left" means something
 * different with two holes than with eight.
 */
export function perSlotRemaining(budget: Budget, openSlots: number): number | null {
  if (openSlots <= 0) return null;
  return round2(remaining(budget) / openSlots);
}

export function formatMoney(amount: number, kind: Budget['kind']): string {
  const rounded = round2(amount);
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return kind === 'faab' ? `$${body}` : `$${body}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
