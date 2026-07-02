import { isGeminiConfigured } from '../gemini/client';
import { generateRecipeJsonContent } from '../gemini/recipe-cache';
import {
  getOrGenerateRecipes,
  type RecipeFilters,
} from './cache';
import { getMockRecipes } from './mock';
import { recipeArraySchema, type Recipe } from './schema';

export { getMockRecipes } from './mock';

/** Build the user prompt sent to Gemini from filter inputs. */
export function buildRecipePrompt(filters: RecipeFilters): string {
  if (filters.random) {
    return 'Generate six random, diverse recipes. Vary proteins, countries, and flavor profiles across the set.';
  }

  const parts: string[] = [
    'Generate exactly six distinct recipes matching these filters:',
  ];

  if (filters.protein) {
    parts.push(`- Protein: ${filters.protein}`);
  }
  if (filters.countryOfOrigin) {
    parts.push(`- Country of origin: ${filters.countryOfOrigin}`);
  }
  if (filters.flavorProfile) {
    parts.push(`- Flavor profile: ${filters.flavorProfile}`);
  }
  if (filters.extraIngredients?.trim()) {
    parts.push(
      `- Incorporate these extra ingredients when possible: ${filters.extraIngredients.trim()}`,
    );
  }

  return parts.join('\n');
}

async function fetchRecipesFromGemini(filters: RecipeFilters): Promise<Recipe[]> {
  const prompt = buildRecipePrompt(filters);
  const json = await generateRecipeJsonContent({ contents: prompt });

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Gemini returned invalid JSON');
  }

  return recipeArraySchema.parse(parsed);
}

async function generateRecipesUncached(filters: RecipeFilters): Promise<Recipe[]> {
  if (!isGeminiConfigured()) {
    return getMockRecipes(filters);
  }

  return fetchRecipesFromGemini(filters);
}

/**
 * Generate six recipes for the given filters.
 * Uses server in-memory cache, Gemini (with context cache), or mock data.
 */
export async function generateRecipes(filters: RecipeFilters): Promise<Recipe[]> {
  return getOrGenerateRecipes(filters, () => generateRecipesUncached(filters));
}
