import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Recipe } from '../recipes/schema';
import {
  getSavedRecipe,
  isRecipeSaved,
  MAX_SAVED_RECIPES,
  readSavedRecipes,
  removeSavedRecipe,
  saveRecipe,
} from './saved-recipes';

function makeRecipe(id: string, title = `Recipe ${id}`): Recipe {
  return {
    id,
    title,
    shortDescription: 'A test recipe.',
    protein: 'Chicken',
    countryOfOrigin: 'Italian',
    flavorProfile: 'Herbaceous',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 4,
    ingredients: [{ item: 'chicken', measurement: '1 lb' }],
    instructions: ['Cook it.'],
    proChefTips: ['Season well.'],
  };
}

describe('saved-recipes localStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips save, read, and remove', () => {
    const recipe = makeRecipe('r1');

    saveRecipe(recipe);

    expect(readSavedRecipes()).toEqual([recipe]);
    expect(getSavedRecipe('r1')).toEqual(recipe);
    expect(isRecipeSaved('r1')).toBe(true);
    expect(isRecipeSaved('missing')).toBe(false);

    removeSavedRecipe('r1');

    expect(readSavedRecipes()).toEqual([]);
    expect(getSavedRecipe('r1')).toBeNull();
  });

  it('dedupes by recipe id on save', () => {
    const original = makeRecipe('dup', 'Original title');
    const updated = makeRecipe('dup', 'Updated title');

    saveRecipe(original);
    saveRecipe(updated);

    expect(readSavedRecipes()).toHaveLength(1);
    expect(getSavedRecipe('dup')).toEqual(updated);
  });

  it(`evicts oldest recipes when cap of ${MAX_SAVED_RECIPES} is exceeded`, () => {
    for (let i = 0; i < MAX_SAVED_RECIPES; i++) {
      saveRecipe(makeRecipe(`recipe-${i}`));
    }

    expect(readSavedRecipes()).toHaveLength(MAX_SAVED_RECIPES);
    expect(getSavedRecipe('recipe-0')).not.toBeNull();

    saveRecipe(makeRecipe('recipe-new'));

    const saved = readSavedRecipes();
    expect(saved).toHaveLength(MAX_SAVED_RECIPES);
    expect(getSavedRecipe('recipe-0')).toBeNull();
    expect(getSavedRecipe('recipe-1')).not.toBeNull();
    expect(getSavedRecipe('recipe-new')).not.toBeNull();
    expect(saved[saved.length - 1]?.id).toBe('recipe-new');
  });

  it('re-saving moves recipe to newest slot so it is not evicted next', () => {
    for (let i = 0; i < MAX_SAVED_RECIPES; i++) {
      saveRecipe(makeRecipe(`recipe-${i}`));
    }

    saveRecipe(makeRecipe('recipe-0', 'Re-saved oldest'));

    saveRecipe(makeRecipe('recipe-next'));

    expect(getSavedRecipe('recipe-0')).not.toBeNull();
    expect(getSavedRecipe('recipe-1')).toBeNull();
    expect(getSavedRecipe('recipe-next')).not.toBeNull();
  });

  it('returns empty array when localStorage is missing or invalid', () => {
    expect(readSavedRecipes()).toEqual([]);

    localStorage.setItem('recipe-generator:saved', 'not-json');
    expect(readSavedRecipes()).toEqual([]);
  });
});
