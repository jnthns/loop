import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECIPE_CACHE_TTL_MS,
  getCachedRecipes,
  getOrGenerateRecipes,
  hashRecipeFilters,
  resetRecipeCacheForTests,
  setCachedRecipes,
} from './cache';
import type { Recipe } from './schema';

const sampleRecipes: Recipe[] = Array.from({ length: 6 }, (_, index) => ({
  id: `recipe-${index + 1}`,
  title: `Recipe ${index + 1}`,
  shortDescription: 'A tasty dish.',
  protein: 'Chicken',
  countryOfOrigin: 'Italian',
  flavorProfile: 'Savory',
  prepTimeMinutes: 10,
  cookTimeMinutes: 20,
  servings: 4,
  ingredients: [{ item: 'chicken', measurement: '1 lb' }],
  instructions: ['Cook it.'],
  proChefTips: ['Season well.'],
}));

describe('recipe cache', () => {
  beforeEach(() => {
    resetRecipeCacheForTests();
    vi.useFakeTimers();
  });

  afterEach(() => {
    resetRecipeCacheForTests();
    vi.useRealTimers();
  });

  it('hashes filter fields including random flag', () => {
    const filtered = hashRecipeFilters({
      protein: 'Chicken',
      countryOfOrigin: 'Italian',
      flavorProfile: 'Savory',
      extraIngredients: '  Garlic, Lemon  ',
    });
    const equivalent = hashRecipeFilters({
      protein: 'Chicken',
      countryOfOrigin: 'Italian',
      flavorProfile: 'Savory',
      extraIngredients: 'garlic, lemon',
    });
    const random = hashRecipeFilters({ random: true });
    const different = hashRecipeFilters({
      protein: 'Beef',
      countryOfOrigin: 'Italian',
      flavorProfile: 'Savory',
    });

    expect(filtered).toBe(equivalent);
    expect(random).not.toBe(filtered);
    expect(different).not.toBe(filtered);
  });

  it('returns cached recipes for duplicate key without second generate call', async () => {
    const generate = vi.fn().mockResolvedValue(sampleRecipes);
    const filters = {
      protein: 'Chicken' as const,
      countryOfOrigin: 'Italian' as const,
      flavorProfile: 'Savory' as const,
      extraIngredients: 'basil',
    };

    const first = await getOrGenerateRecipes(filters, generate);
    const second = await getOrGenerateRecipes(filters, generate);

    expect(generate).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(second).toEqual(sampleRecipes);
  });

  it('invokes generate again when cache entry expires', async () => {
    const generate = vi
      .fn()
      .mockResolvedValueOnce(sampleRecipes)
      .mockResolvedValueOnce(
        sampleRecipes.map((recipe, index) => ({
          ...recipe,
          id: `fresh-${index + 1}`,
        })),
      );

    const filters = { random: true };

    const first = await getOrGenerateRecipes(filters, generate);
    vi.advanceTimersByTime(RECIPE_CACHE_TTL_MS + 1);
    const second = await getOrGenerateRecipes(filters, generate);

    expect(generate).toHaveBeenCalledTimes(2);
    expect(first[0]?.id).toBe('recipe-1');
    expect(second[0]?.id).toBe('fresh-1');
  });

  it('stores and reads recipes via get/set helpers', () => {
    const filters = {
      protein: 'Fish' as const,
      countryOfOrigin: 'Japanese' as const,
      flavorProfile: 'Umami' as const,
    };

    expect(getCachedRecipes(filters)).toBeUndefined();
    setCachedRecipes(filters, sampleRecipes);
    expect(getCachedRecipes(filters)).toEqual(sampleRecipes);
  });
});
