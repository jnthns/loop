import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRecipeCacheForTests } from './cache';
import {
  buildRecipePrompt,
  generateRecipes,
  getMockRecipes,
} from './generate';
import { recipeArraySchema } from './schema';

const mockGenerateRecipeJsonContent = vi.fn();

vi.mock('../gemini/recipe-cache', () => ({
  generateRecipeJsonContent: (...args: unknown[]) =>
    mockGenerateRecipeJsonContent(...args),
}));

const geminiRecipe = {
  id: 'gemini-1',
  title: 'Grilled Lemon Chicken',
  shortDescription: 'Bright Italian-style chicken.',
  protein: 'Chicken',
  countryOfOrigin: 'Italian',
  flavorProfile: 'Herbaceous',
  prepTimeMinutes: 10,
  cookTimeMinutes: 25,
  servings: 4,
  ingredients: [{ item: 'chicken breast', measurement: '1 lb' }],
  instructions: ['Season chicken.', 'Grill until done.'],
  proChefTips: ['Use fresh lemon zest.', 'Rest before slicing.'],
};

function sixGeminiRecipes() {
  return Array.from({ length: 6 }, (_, index) => ({
    ...geminiRecipe,
    id: `gemini-${index + 1}`,
    title: `Gemini Recipe ${index + 1}`,
  }));
}

describe('recipe generation', () => {
  beforeEach(() => {
    mockGenerateRecipeJsonContent.mockReset();
    resetRecipeCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    resetRecipeCacheForTests();
    vi.unstubAllEnvs();
  });

  it('returns 6 valid recipes via mock fallback when GEMINI_API_KEY is unset', async () => {
    const recipes = await generateRecipes({ random: true });

    expect(recipeArraySchema.parse(recipes)).toHaveLength(6);
    expect(mockGenerateRecipeJsonContent).not.toHaveBeenCalled();
    expect(recipes[0]?.id).toMatch(/^mock-/);
  });

  it('getMockRecipes returns 6 schema-valid recipes for filtered inputs', () => {
    const recipes = getMockRecipes({
      protein: 'Beef',
      countryOfOrigin: 'Mexican',
      flavorProfile: 'Spicy',
      extraIngredients: 'cilantro, lime',
    });

    expect(recipeArraySchema.parse(recipes)).toHaveLength(6);
    expect(recipes.every((r) => r.protein === 'Beef')).toBe(true);
    expect(recipes.every((r) => r.countryOfOrigin === 'Mexican')).toBe(true);
    expect(recipes.every((r) => r.flavorProfile === 'Spicy')).toBe(true);
  });

  it('buildRecipePrompt includes filter fields and extras', () => {
    const prompt = buildRecipePrompt({
      protein: 'Fish',
      countryOfOrigin: 'Japanese',
      flavorProfile: 'Umami',
      extraIngredients: 'miso, ginger',
    });

    expect(prompt).toContain('Fish');
    expect(prompt).toContain('Japanese');
    expect(prompt).toContain('Umami');
    expect(prompt).toContain('miso, ginger');
  });

  it('calls Gemini and validates response when API key is set', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    mockGenerateRecipeJsonContent.mockResolvedValue(
      JSON.stringify(sixGeminiRecipes()),
    );

    const recipes = await generateRecipes({
      protein: 'Chicken',
      countryOfOrigin: 'Italian',
      flavorProfile: 'Savory',
    });

    expect(mockGenerateRecipeJsonContent).toHaveBeenCalledOnce();
    expect(mockGenerateRecipeJsonContent).toHaveBeenCalledWith({
      contents: expect.stringContaining('Chicken'),
    });
    expect(recipeArraySchema.parse(recipes)).toHaveLength(6);
    expect(recipes[0]?.id).toBe('gemini-1');
  });

  it('reuses server cache for identical filter requests', async () => {
    const filters = {
      protein: 'Pork' as const,
      countryOfOrigin: 'Thai' as const,
      flavorProfile: 'Spicy' as const,
    };

    const first = await generateRecipes(filters);
    const second = await generateRecipes(filters);

    expect(first).toBe(second);
    expect(recipeArraySchema.parse(second)).toHaveLength(6);
  });
});
