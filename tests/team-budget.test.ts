import { describe, expect, it } from 'vitest';
import {
  allocated,
  formatMoney,
  isOverspent,
  perSlotRemaining,
  percentSpent,
  remaining,
} from '~/lib/team/budget';
import type { Budget } from '~/lib/schemas/team';

const budget = (total: number, amounts: number[], kind: Budget['kind'] = 'auction'): Budget => ({
  id: 'b',
  label: 'Ledger',
  kind,
  total,
  entries: amounts.map((amount, i) => ({ id: `e${i}`, label: `e${i}`, amount, date: '' })),
});

describe('budget math', () => {
  it('sums allocations', () => {
    expect(allocated(budget(200, [62, 48, 41]))).toBe(151);
  });

  it('computes remaining as total minus allocated', () => {
    expect(remaining(budget(200, [62, 48, 41]))).toBe(49);
  });

  it('treats an empty ledger as fully unspent', () => {
    expect(allocated(budget(100, []))).toBe(0);
    expect(remaining(budget(100, []))).toBe(100);
  });

  it('avoids floating point noise', () => {
    expect(remaining(budget(100, [33.33, 33.33, 33.33]))).toBe(0.01);
  });

  it('reports overspend rather than clamping it', () => {
    const over = budget(100, [60, 60]);
    expect(remaining(over)).toBe(-20);
    expect(isOverspent(over)).toBe(true);
  });

  it('is not overspent when exactly at the ceiling', () => {
    expect(isOverspent(budget(100, [100]))).toBe(false);
  });
});

describe('percentSpent', () => {
  it('scales to the total', () => {
    expect(percentSpent(budget(200, [50]))).toBe(25);
  });

  it('caps at 100 and floors at 0', () => {
    expect(percentSpent(budget(100, [500]))).toBe(100);
    expect(percentSpent(budget(0, [10]))).toBe(0);
  });
});

describe('perSlotRemaining', () => {
  it('divides what is left across open slots', () => {
    expect(perSlotRemaining(budget(200, [100]), 4)).toBe(25);
  });

  it('is null when the roster is full — there is nothing to divide by', () => {
    expect(perSlotRemaining(budget(200, [100]), 0)).toBeNull();
  });
});

describe('formatMoney', () => {
  it('keeps whole numbers clean and cents explicit', () => {
    expect(formatMoney(49, 'auction')).toBe('$49');
    expect(formatMoney(49.5, 'faab')).toBe('$49.50');
  });
});
