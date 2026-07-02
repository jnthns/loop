import type { Recipe } from '../recipes/schema';

const SESSION_KEY = 'recipe-generator:session';

/** Persist the current recipe batch for detail-page routing. */
export function writeRecipeSession(recipes: Recipe[]): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(recipes));
}

export function readRecipeSession(): Recipe[] | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Recipe[];
  } catch {
    return null;
  }
}

export function getRecipeFromSession(id: string): Recipe | null {
  const recipes = readRecipeSession();
  return recipes?.find((recipe) => recipe.id === id) ?? null;
}
