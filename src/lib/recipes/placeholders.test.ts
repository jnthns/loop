import { describe, expect, it } from 'vitest';
import { placeholderGradient } from './placeholders';

describe('placeholderGradient', () => {
  it('returns the same gradient for the same title', () => {
    const title = 'Spicy Chicken Tikka';
    expect(placeholderGradient(title)).toBe(placeholderGradient(title));
  });

  it('returns different gradients for different titles', () => {
    expect(placeholderGradient('Spicy Chicken Tikka')).not.toBe(
      placeholderGradient('Mild Beef Stew'),
    );
  });

  it('returns a linear-gradient CSS value', () => {
    expect(placeholderGradient('Test Dish')).toMatch(
      /^linear-gradient\(135deg, hsl\(\d+ 70% 45%\), hsl\(\d+ 80% 35%\)\)$/,
    );
  });
});
