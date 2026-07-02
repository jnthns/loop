import type { Recipe } from '../recipes/schema';

const STORAGE_KEY = 'recipe-generator:saved';

export const MAX_SAVED_RECIPES = 50;

/** Read all saved recipes from localStorage (oldest first). */
export function readSavedRecipes(): Recipe[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as Recipe[];
  } catch {
    return [];
  }
}

function writeSavedRecipes(recipes: Recipe[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

export function getSavedRecipe(id: string): Recipe | null {
  return readSavedRecipes().find((recipe) => recipe.id === id) ?? null;
}

export function isRecipeSaved(id: string): boolean {
  return getSavedRecipe(id) !== null;
}

export function saveRecipe(recipe: Recipe): void {
  const recipes = readSavedRecipes().filter((item) => item.id !== recipe.id);
  recipes.push(recipe);

  while (recipes.length > MAX_SAVED_RECIPES) {
    recipes.shift();
  }

  writeSavedRecipes(recipes);
}

export function removeSavedRecipe(id: string): void {
  writeSavedRecipes(readSavedRecipes().filter((recipe) => recipe.id !== id));
}
