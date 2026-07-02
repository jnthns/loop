import type { GoogleGenAI as GoogleGenAIType } from '@google/genai';
import {
  GEMINI_MODEL,
  createGeminiClient,
  generateJsonContent,
  type GenerateJsonContentOptions,
} from './client';

/** Immutable system instruction cached via Gemini explicit context caching. */
export const RECIPE_SYSTEM_INSTRUCTION = `You are a professional chef and recipe writer for a home-cooking app.

Generate exactly six distinct recipes as a JSON array. Each recipe must include:
- id: unique short slug (kebab-case)
- title, shortDescription
- protein: one of Chicken, Beef, Pork, Fish, Tofu, Lamb, Shrimp, Eggs
- countryOfOrigin: one of Italian, Mexican, Japanese, Indian, Thai, French, Korean, Moroccan, American, Greek
- flavorProfile: one of Spicy, Savory, Sweet, Tangy, Smoky, Herbaceous, Umami, Mild
- prepTimeMinutes, cookTimeMinutes (non-negative integers), servings (positive integer)
- ingredients: array of { item, measurement } with at least one entry
- instructions: clear step-by-step strings (at least one step)
- proChefTips: exactly one professional tip per instruction step (same length as instructions)

Write practical, appetizing recipes suitable for home cooks. Use realistic measurements and times.`;

export const RECIPE_CACHE_DISPLAY_NAME = 'recipe-generator-system-prompt';
export const RECIPE_CACHE_TTL = '3600s';

let recipeSystemCacheName: string | undefined;

/** Reset in-memory cache name — for tests only. */
export function resetRecipeSystemCacheForTests(): void {
  recipeSystemCacheName = undefined;
}

/**
 * Create or return the Gemini explicit context cache for the recipe system prompt.
 * The cache name is held in memory for the process lifetime.
 */
export async function getRecipeSystemCacheName(
  client?: GoogleGenAIType,
): Promise<string> {
  if (recipeSystemCacheName) {
    return recipeSystemCacheName;
  }

  const ai = client ?? createGeminiClient();
  const cache = await ai.caches.create({
    model: GEMINI_MODEL,
    config: {
      displayName: RECIPE_CACHE_DISPLAY_NAME,
      systemInstruction: RECIPE_SYSTEM_INSTRUCTION,
      ttl: RECIPE_CACHE_TTL,
    },
  });

  if (!cache.name) {
    throw new Error('Gemini failed to create recipe system context cache');
  }

  recipeSystemCacheName = cache.name;
  return recipeSystemCacheName;
}

export interface GenerateRecipeJsonOptions {
  contents: string;
  responseJsonSchema?: unknown;
}

/**
 * Generate recipe JSON using the cached system instruction plus a user prompt.
 */
export async function generateRecipeJsonContent(
  options: GenerateRecipeJsonOptions,
  client?: GoogleGenAIType,
): Promise<string> {
  const ai = client ?? createGeminiClient();
  const cachedContent = await getRecipeSystemCacheName(ai);

  const generateOptions: GenerateJsonContentOptions = {
    contents: options.contents,
    cachedContent,
    ...(options.responseJsonSchema
      ? { responseJsonSchema: options.responseJsonSchema }
      : {}),
  };

  return generateJsonContent(generateOptions, ai);
}
