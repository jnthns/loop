import { describe, expect, it } from 'vitest';
import {
  COUNTRIES,
  COUNTRY_OPTIONS,
  FLAVOR_PROFILE_OPTIONS,
  FLAVOR_PROFILES,
  PROTEIN_OPTIONS,
  PROTEINS,
} from './options';
import { recipeArraySchema, recipeSchema, type Recipe } from './schema';

const validRecipe: Recipe = {
  id: 'recipe-1',
  title: 'Spicy Chicken Tikka',
  shortDescription: 'A bold Indian-inspired chicken dish.',
  protein: 'Chicken',
  countryOfOrigin: 'Indian',
  flavorProfile: 'Spicy',
  prepTimeMinutes: 15,
  cookTimeMinutes: 30,
  servings: 4,
  ingredients: [
    { item: 'chicken thighs', measurement: '1 lb' },
    { item: 'yogurt', measurement: '1/2 cup' },
  ],
  instructions: ['Marinate the chicken.', 'Grill until charred.'],
  proChefTips: ['Use full-fat yogurt for better adhesion.', 'Rest before slicing.'],
};

describe('recipe dropdown options', () => {
  it('exports expected protein values', () => {
    expect(PROTEINS).toEqual([
      'Chicken',
      'Beef',
      'Pork',
      'Fish',
      'Tofu',
      'Lamb',
      'Shrimp',
      'Eggs',
    ]);
    expect(PROTEIN_OPTIONS).toHaveLength(PROTEINS.length);
    expect(PROTEIN_OPTIONS.map((o) => o.value)).toEqual([...PROTEINS]);
  });

  it('exports expected country values', () => {
    expect(COUNTRIES).toEqual([
      'Italian',
      'Mexican',
      'Japanese',
      'Indian',
      'Thai',
      'French',
      'Korean',
      'Moroccan',
      'American',
      'Greek',
    ]);
    expect(COUNTRY_OPTIONS).toHaveLength(COUNTRIES.length);
    expect(COUNTRY_OPTIONS.map((o) => o.value)).toEqual([...COUNTRIES]);
  });

  it('exports expected flavor profile values', () => {
    expect(FLAVOR_PROFILES).toEqual([
      'Spicy',
      'Savory',
      'Sweet',
      'Tangy',
      'Smoky',
      'Herbaceous',
      'Umami',
      'Mild',
    ]);
    expect(FLAVOR_PROFILE_OPTIONS).toHaveLength(FLAVOR_PROFILES.length);
    expect(FLAVOR_PROFILE_OPTIONS.map((o) => o.value)).toEqual([
      ...FLAVOR_PROFILES,
    ]);
  });
});

describe('recipe schema', () => {
  it('parses a valid recipe', () => {
    const parsed = recipeSchema.parse(validRecipe);
    expect(parsed).toEqual(validRecipe);
  });

  it('rejects invalid enum values', () => {
    expect(() =>
      recipeSchema.parse({ ...validRecipe, protein: 'Turkey' }),
    ).toThrow();
    expect(() =>
      recipeSchema.parse({ ...validRecipe, countryOfOrigin: 'Spanish' }),
    ).toThrow();
    expect(() =>
      recipeSchema.parse({ ...validRecipe, flavorProfile: 'Bitter' }),
    ).toThrow();
  });

  it('requires proChefTips length to match instructions length', () => {
    expect(() =>
      recipeSchema.parse({
        ...validRecipe,
        proChefTips: ['Only one tip'],
      }),
    ).toThrow(/one tip per instruction step/);
  });

  it('parses an array of six recipes', () => {
    const recipes = Array.from({ length: 6 }, (_, index) => ({
      ...validRecipe,
      id: `recipe-${index + 1}`,
      title: `Recipe ${index + 1}`,
    }));
    expect(recipeArraySchema.parse(recipes)).toHaveLength(6);
  });
});
