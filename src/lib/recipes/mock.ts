import type { RecipeFilters } from './cache';
import {
  COUNTRIES,
  FLAVOR_PROFILES,
  PROTEINS,
  type Country,
  type FlavorProfile,
  type Protein,
} from './options';
import type { Recipe } from './schema';

function pickDefault<T extends string>(values: readonly T[], preferred?: T): T {
  return preferred ?? values[0];
}

function createMockRecipe(
  index: number,
  protein: Protein,
  country: Country,
  flavor: FlavorProfile,
  extraIngredients?: string,
): Recipe {
  const id = `mock-${protein.toLowerCase()}-${country.toLowerCase()}-${index + 1}`;
  const title = `${flavor} ${protein} ${country} Dish ${index + 1}`;
  const extraNote = extraIngredients?.trim()
    ? ` featuring ${extraIngredients.trim()}`
    : '';

  return {
    id,
    title,
    shortDescription: `A ${flavor.toLowerCase()} ${protein.toLowerCase()} recipe inspired by ${country} cuisine${extraNote}.`,
    protein,
    countryOfOrigin: country,
    flavorProfile: flavor,
    prepTimeMinutes: 15 + index * 2,
    cookTimeMinutes: 25 + index * 3,
    servings: 4,
    ingredients: [
      { item: protein.toLowerCase(), measurement: '1 lb' },
      { item: 'olive oil', measurement: '2 tbsp' },
      { item: 'salt', measurement: 'to taste' },
    ],
    instructions: [
      'Prepare and season the main ingredient.',
      'Cook using traditional techniques until done.',
      'Rest briefly, then serve warm.',
    ],
    proChefTips: [
      'Pat dry before seasoning for better browning.',
      'Use medium-high heat for a proper sear.',
      'Let rest 5 minutes before plating.',
    ],
  };
}

/** Deterministic mock recipes for CI/dev when GEMINI_API_KEY is unset or API unavailable. */
export function getMockRecipes(filters: RecipeFilters = {}): Recipe[] {
  if (filters.random) {
    return Array.from({ length: 6 }, (_, index) =>
      createMockRecipe(
        index,
        PROTEINS[index % PROTEINS.length],
        COUNTRIES[index % COUNTRIES.length],
        FLAVOR_PROFILES[index % FLAVOR_PROFILES.length],
      ),
    );
  }

  const protein = pickDefault(PROTEINS, filters.protein);
  const country = pickDefault(COUNTRIES, filters.countryOfOrigin);
  const flavor = pickDefault(FLAVOR_PROFILES, filters.flavorProfile);

  return Array.from({ length: 6 }, (_, index) =>
    createMockRecipe(index, protein, country, flavor, filters.extraIngredients),
  );
}
