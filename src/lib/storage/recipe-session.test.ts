import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Recipe } from '../recipes/schema';
import {
  getRecipeFromSession,
  readRecipeSession,
  writeRecipeSession,
} from './recipe-session';

function makeRecipe(id: string, title = `Recipe ${id}`): Recipe {
  return {
    id,
    title,
    shortDescription: 'A test recipe.',
    protein: 'Chicken',
    countryOfOrigin: 'Italian',
    flavorProfile: 'Herbaceous',
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 4,
    ingredients: [{ item: 'chicken', measurement: '1 lb' }],
    instructions: ['Cook it.'],
    proChefTips: ['Season well.'],
  };
}

describe('recipe-session sessionStorage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('writeRecipeSession persists recipes readable by readRecipeSession', () => {
    const recipes = [makeRecipe('r1'), makeRecipe('r2')];

    writeRecipeSession(recipes);

    expect(readRecipeSession()).toEqual(recipes);
  });

  it('readRecipeSession returns null when session is empty', () => {
    expect(readRecipeSession()).toBeNull();
  });

  it('readRecipeSession returns null when stored JSON is invalid', () => {
    sessionStorage.setItem('recipe-generator:session', 'not-json');

    expect(readRecipeSession()).toBeNull();
  });

  it('getRecipeFromSession returns the matching recipe by id', () => {
    const recipes = [makeRecipe('alpha'), makeRecipe('beta')];
    writeRecipeSession(recipes);

    expect(getRecipeFromSession('beta')).toEqual(recipes[1]);
  });

  it('getRecipeFromSession returns null when id is not in the batch', () => {
    writeRecipeSession([makeRecipe('only-one')]);

    expect(getRecipeFromSession('missing')).toBeNull();
  });

  it('getRecipeFromSession returns null when session is empty', () => {
    expect(getRecipeFromSession('any-id')).toBeNull();
  });
});
