import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getMockRecipes } from '../../lib/recipes/generate';
import { IngredientsPanel } from './IngredientsPanel';
import { InstructionsPanel } from './InstructionsPanel';
import { MetadataBar } from './MetadataBar';
import { ProChefTipsPanel } from './ProChefTipsPanel';
import { RecipeHero } from './RecipeHero';

const recipe = getMockRecipes({ random: true })[0]!;

describe('RecipeHero', () => {
  it('renders hero image placeholder and title', () => {
    render(<RecipeHero recipe={recipe} />);

    expect(screen.getByTestId('recipe-hero')).toBeInTheDocument();
    expect(screen.getByTestId('recipe-hero-image')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      recipe.title,
    );
    expect(screen.getByText(recipe.shortDescription)).toBeInTheDocument();
  });
});

describe('IngredientsPanel', () => {
  it('renders all ingredients with measurements', () => {
    render(<IngredientsPanel recipe={recipe} />);

    expect(screen.getByTestId('ingredients-panel')).toBeInTheDocument();
    expect(screen.getByText(/ingredients & measurements/i)).toBeInTheDocument();

    const items = screen.getAllByTestId('ingredient-item');
    expect(items).toHaveLength(recipe.ingredients.length);

    recipe.ingredients.forEach((ingredient) => {
      expect(screen.getByText(ingredient.item)).toBeInTheDocument();
      expect(screen.getByText(ingredient.measurement)).toBeInTheDocument();
    });
  });
});

describe('MetadataBar', () => {
  it('renders cooking time, save, and display toggle sections', () => {
    const onSaveToggle = vi.fn();
    const onDisplayToggle = vi.fn();

    render(
      <MetadataBar
        recipe={recipe}
        onSaveToggle={onSaveToggle}
        onDisplayToggle={onDisplayToggle}
      />,
    );

    expect(screen.getByTestId('metadata-bar')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-cooking-time')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-save')).toBeInTheDocument();
    expect(screen.getByTestId('metadata-display-toggle')).toBeInTheDocument();

    const totalMinutes = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
    expect(screen.getByText(`${totalMinutes} min`)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Save for later' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Hide pro tips' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));
    expect(onSaveToggle).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Hide pro tips' }));
    expect(onDisplayToggle).toHaveBeenCalledOnce();
  });

  it('shows saved state when recipe is saved', () => {
    render(<MetadataBar recipe={recipe} saved />);

    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

describe('InstructionsPanel', () => {
  it('renders numbered instruction steps', () => {
    render(<InstructionsPanel instructions={recipe.instructions} />);

    expect(screen.getByTestId('instructions-panel')).toBeInTheDocument();
    expect(
      screen.getByText(/step-by-step instructions/i),
    ).toBeInTheDocument();

    const steps = screen.getAllByTestId('instruction-step');
    expect(steps).toHaveLength(recipe.instructions.length);

    recipe.instructions.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });
});

describe('ProChefTipsPanel', () => {
  it('renders one tip per step when visible', () => {
    render(<ProChefTipsPanel proChefTips={recipe.proChefTips} visible />);

    expect(screen.getByTestId('pro-chef-tips-panel')).toBeInTheDocument();
    expect(screen.getByText(/pro chef tips/i)).toBeInTheDocument();

    const tips = screen.getAllByTestId('pro-chef-tip');
    expect(tips).toHaveLength(recipe.proChefTips.length);

    recipe.proChefTips.forEach((tip) => {
      expect(screen.getByText(tip)).toBeInTheDocument();
    });
  });

  it('hides panel when visible is false', () => {
    render(<ProChefTipsPanel proChefTips={recipe.proChefTips} visible={false} />);

    expect(screen.queryByTestId('pro-chef-tips-panel')).not.toBeInTheDocument();
  });
});
