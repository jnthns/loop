import { useCallback, useEffect, useState } from 'react';
import type { RecipeFilters } from '../../lib/recipes/cache';
import { getMockRecipes } from '../../lib/recipes/mock';
import type { Recipe } from '../../lib/recipes/schema';
import { writeRecipeSession } from '../../lib/storage/recipe-session';
import { FilterBar, type FilterBarValues } from './FilterBar';
import { RecipeGrid } from './RecipeGrid';

type GenerateBody =
  | { random: true }
  | {
      protein: string;
      countryOfOrigin: string;
      flavorProfile: string;
      extraIngredients?: string;
    };

function isRandomBody(body: GenerateBody): body is { random: true } {
  return 'random' in body;
}

function toRecipeFilters(body: GenerateBody): RecipeFilters {
  if (isRandomBody(body)) {
    return { random: true };
  }

  return {
    protein: body.protein as RecipeFilters['protein'],
    countryOfOrigin: body.countryOfOrigin as RecipeFilters['countryOfOrigin'],
    flavorProfile: body.flavorProfile as RecipeFilters['flavorProfile'],
    extraIngredients: body.extraIngredients,
  };
}

async function fetchRecipes(body: GenerateBody): Promise<Recipe[]> {
  try {
    const response = await fetch('/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch recipes');
    }

    return response.json() as Promise<Recipe[]>;
  } catch {
    return getMockRecipes(toRecipeFilters(body));
  }
}

export function LandingApp() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadRecipes = useCallback(async (body: GenerateBody) => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchRecipes(body);
      writeRecipeSession(data);
      setRecipes(data);
      setRefreshKey((key) => key + 1);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecipes({ random: true });
  }, [loadRecipes]);

  const handleGenerate = (filters: FilterBarValues) => {
    void loadRecipes({
      protein: filters.protein,
      countryOfOrigin: filters.countryOfOrigin,
      flavorProfile: filters.flavorProfile,
      ...(filters.extraIngredients.trim()
        ? { extraIngredients: filters.extraIngredients.trim() }
        : {}),
    });
  };

  const handleCardClick = (recipe: Recipe) => {
    window.location.assign(`/recipe/${recipe.id}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <FilterBar onGenerate={handleGenerate} loading={loading} />

      {error ? (
        <p className="border-brutal border-brutal-black bg-brutal-accent p-4 font-bold" role="alert">
          {error}
        </p>
      ) : null}

      {recipes.length === 0 && loading ? (
        <p aria-busy="true">Loading recipes…</p>
      ) : null}

      {recipes.length > 0 ? (
        <RecipeGrid
          recipes={recipes}
          onCardClick={handleCardClick}
          refreshKey={refreshKey}
        />
      ) : null}
    </div>
  );
}
