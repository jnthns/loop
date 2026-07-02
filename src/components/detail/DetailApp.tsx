import { useEffect, useState } from 'react';
import type { Recipe } from '../../lib/recipes/schema';
import { getRecipeFromSession } from '../../lib/storage/recipe-session';
import {
  getSavedRecipe,
  isRecipeSaved,
  removeSavedRecipe,
  saveRecipe,
} from '../../lib/storage/saved-recipes';
import { IngredientsPanel } from './IngredientsPanel';
import { InstructionsPanel } from './InstructionsPanel';
import { MetadataBar } from './MetadataBar';
import { ProChefTipsPanel } from './ProChefTipsPanel';
import { RecipeHero } from './RecipeHero';

export type DetailAppProps = {
  recipeId: string;
};

function loadRecipe(id: string): Recipe | null {
  return getRecipeFromSession(id) ?? getSavedRecipe(id);
}

export function DetailApp({ recipeId }: DetailAppProps) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [saved, setSaved] = useState(false);
  const [showProTips, setShowProTips] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loaded = loadRecipe(recipeId);
    setRecipe(loaded);
    setSaved(loaded ? isRecipeSaved(recipeId) : false);
    setLoading(false);
  }, [recipeId]);

  const handleSaveToggle = () => {
    if (!recipe) return;

    if (saved) {
      removeSavedRecipe(recipe.id);
      setSaved(false);
    } else {
      saveRecipe(recipe);
      setSaved(true);
    }
  };

  const handleDisplayToggle = () => {
    setShowProTips((visible) => !visible);
  };

  if (loading) {
    return <p aria-busy="true">Loading recipe…</p>;
  }

  if (!recipe) {
    return (
      <p
        role="alert"
        className="border-brutal border-brutal-black bg-brutal-accent p-4 font-bold"
      >
        Recipe not found. Generate recipes from the home page first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8" data-testid="detail-app">
      <RecipeHero recipe={recipe} />
      <IngredientsPanel recipe={recipe} />
      <MetadataBar
        recipe={recipe}
        saved={saved}
        onSaveToggle={handleSaveToggle}
        showProTips={showProTips}
        onDisplayToggle={handleDisplayToggle}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <InstructionsPanel instructions={recipe.instructions} />
        <ProChefTipsPanel
          proChefTips={recipe.proChefTips}
          visible={showProTips}
        />
      </div>
    </div>
  );
}
