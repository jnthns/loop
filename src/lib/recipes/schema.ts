import { z } from 'zod';
import { COUNTRIES, FLAVOR_PROFILES, PROTEINS } from './options';

const ingredientSchema = z.object({
  item: z.string().min(1),
  measurement: z.string().min(1),
});

const recipeBaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  shortDescription: z.string().min(1),
  protein: z.enum(PROTEINS),
  countryOfOrigin: z.enum(COUNTRIES),
  flavorProfile: z.enum(FLAVOR_PROFILES),
  prepTimeMinutes: z.number().int().nonnegative(),
  cookTimeMinutes: z.number().int().nonnegative(),
  servings: z.number().int().positive(),
  ingredients: z.array(ingredientSchema).min(1),
  instructions: z.array(z.string().min(1)).min(1),
  proChefTips: z.array(z.string().min(1)),
});

export const recipeSchema = recipeBaseSchema.refine(
  (recipe) => recipe.proChefTips.length === recipe.instructions.length,
  {
    message: 'proChefTips must have one tip per instruction step',
    path: ['proChefTips'],
  },
);

export const recipeArraySchema = z.array(recipeSchema).length(6);

export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
