import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getMockRecipes } from '../../lib/recipes/generate';
import { RecipeGrid } from './RecipeGrid';

function childOrder(card: HTMLElement) {
  const image = card.querySelector('[data-testid="recipe-card-image"]');
  const text = card.querySelector('[data-testid="recipe-card-text"]');
  expect(image).not.toBeNull();
  expect(text).not.toBeNull();

  const children = Array.from(card.children);
  const imageIndex = children.indexOf(image!);
  const textIndex = children.indexOf(text!);
  return { imageIndex, textIndex };
}

describe('RecipeGrid', () => {
  it('renders 6 cards with column flip layout', () => {
    const recipes = getMockRecipes({ random: true });
    render(<RecipeGrid recipes={recipes} />);

    const cards = screen.getAllByTestId('recipe-card');
    expect(cards).toHaveLength(6);

    cards.forEach((card, index) => {
      const flipped = index % 3 === 1;
      expect(card).toHaveAttribute('data-flipped', flipped ? 'true' : 'false');

      const { imageIndex, textIndex } = childOrder(card);

      if (flipped) {
        expect(textIndex).toBeLessThan(imageIndex);
      } else {
        expect(imageIndex).toBeLessThan(textIndex);
      }
    });
  });

  it('remounts grid on refreshKey change for stagger re-entry', () => {
    const recipes = getMockRecipes({ random: true });
    const { rerender } = render(
      <RecipeGrid recipes={recipes} refreshKey={0} />,
    );

    expect(screen.getAllByTestId('recipe-card')).toHaveLength(6);

    rerender(<RecipeGrid recipes={recipes} refreshKey={1} />);

    expect(screen.getByTestId('recipe-grid')).toBeInTheDocument();
    expect(screen.getAllByTestId('recipe-card')).toHaveLength(6);
  });
});
