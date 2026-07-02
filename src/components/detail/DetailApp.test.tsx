import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getMockRecipes } from '../../lib/recipes/generate';
import { writeRecipeSession } from '../../lib/storage/recipe-session';
import { getSavedRecipe } from '../../lib/storage/saved-recipes';
import { DetailApp } from './DetailApp';

describe('DetailApp', () => {
  const recipes = getMockRecipes({ random: true });
  const recipe = recipes[0]!;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('loads recipe from sessionStorage', async () => {
    writeRecipeSession(recipes);
    render(<DetailApp recipeId={recipe.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('detail-app')).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      recipe.title,
    );
  });

  it('save writes recipe to localStorage', async () => {
    writeRecipeSession(recipes);
    render(<DetailApp recipeId={recipe.id} />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Save for later' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save for later' }));

    expect(getSavedRecipe(recipe.id)).toEqual(recipe);
    expect(screen.getByRole('button', { name: 'Saved' })).toBeInTheDocument();
  });

  it('display toggle hides pro tips panel', async () => {
    writeRecipeSession(recipes);
    render(<DetailApp recipeId={recipe.id} />);

    await waitFor(() => {
      expect(screen.getByTestId('pro-chef-tips-panel')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Hide pro tips' }));

    expect(screen.queryByTestId('pro-chef-tips-panel')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Show pro tips' }),
    ).toBeInTheDocument();
  });
});
