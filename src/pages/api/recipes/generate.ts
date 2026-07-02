import type { APIRoute } from 'astro';
import { z } from 'zod';
import type { RecipeFilters } from '../../../lib/recipes/cache';
import { generateRecipes } from '../../../lib/recipes/generate';
import {
  COUNTRIES,
  FLAVOR_PROFILES,
  PROTEINS,
} from '../../../lib/recipes/options';
import { recipeArraySchema } from '../../../lib/recipes/schema';

const filteredRequestSchema = z.object({
  protein: z.enum(PROTEINS),
  countryOfOrigin: z.enum(COUNTRIES),
  flavorProfile: z.enum(FLAVOR_PROFILES),
  extraIngredients: z.string().optional(),
});

const generateRequestSchema = z.union([
  z.object({ random: z.literal(true) }),
  filteredRequestSchema,
]);

type GenerateRequest = z.infer<typeof generateRequestSchema>;

function isRandomRequest(body: GenerateRequest): body is { random: true } {
  return 'random' in body && body.random === true;
}

function toRecipeFilters(body: GenerateRequest): RecipeFilters {
  if (isRandomRequest(body)) {
    return { random: true };
  }

  return {
    protein: body.protein,
    countryOfOrigin: body.countryOfOrigin,
    flavorProfile: body.flavorProfile,
    extraIngredients: body.extraIngredients,
  };
}

export const POST: APIRoute = async ({ request }) => {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const parsed = generateRequestSchema.safeParse(json);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request body', details: parsed.error.flatten() }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  try {
    const recipes = await generateRecipes(toRecipeFilters(parsed.data));
    const validated = recipeArraySchema.parse(recipes);

    return new Response(JSON.stringify(validated), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Recipe generation failed';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
