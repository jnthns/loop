import type { Country, FlavorProfile, Protein } from './options';
import type { Recipe } from './schema';

/** Server in-memory recipe cache TTL — 1 hour per docs/plan.md */
export const RECIPE_CACHE_TTL_MS = 60 * 60 * 1000;

export interface RecipeFilters {
  random?: boolean;
  protein?: Protein;
  countryOfOrigin?: Country;
  flavorProfile?: FlavorProfile;
  extraIngredients?: string;
}

interface CacheEntry {
  recipes: Recipe[];
  expiresAt: number;
}

const recipeCache = new Map<string, CacheEntry>();

/** Reset in-memory cache — for tests only. */
export function resetRecipeCacheForTests(): void {
  recipeCache.clear();
}

function normalizeExtraIngredients(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Stable cache key from filter inputs (protein, country, flavor, extras, random flag).
 * Random requests share one key; filtered requests include all selected fields.
 */
export function hashRecipeFilters(filters: RecipeFilters): string {
  if (filters.random) {
    return JSON.stringify({ random: true });
  }

  return JSON.stringify({
    random: false,
    protein: filters.protein ?? '',
    countryOfOrigin: filters.countryOfOrigin ?? '',
    flavorProfile: filters.flavorProfile ?? '',
    extraIngredients: normalizeExtraIngredients(filters.extraIngredients),
  });
}

export function getCachedRecipes(filters: RecipeFilters): Recipe[] | undefined {
  const key = hashRecipeFilters(filters);
  const entry = recipeCache.get(key);
  if (!entry) {
    return undefined;
  }

  if (Date.now() > entry.expiresAt) {
    recipeCache.delete(key);
    return undefined;
  }

  return entry.recipes;
}

export function setCachedRecipes(
  filters: RecipeFilters,
  recipes: Recipe[],
): void {
  recipeCache.set(hashRecipeFilters(filters), {
    recipes,
    expiresAt: Date.now() + RECIPE_CACHE_TTL_MS,
  });
}

/**
 * Return cached recipes for identical filters, or invoke `generate` once and store.
 */
export async function getOrGenerateRecipes(
  filters: RecipeFilters,
  generate: () => Promise<Recipe[]>,
): Promise<Recipe[]> {
  const cached = getCachedRecipes(filters);
  if (cached) {
    return cached;
  }

  const recipes = await generate();
  setCachedRecipes(filters, recipes);
  return recipes;
}
