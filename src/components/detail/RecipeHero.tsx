import { placeholderGradient } from '../../lib/recipes/placeholders';
import type { Recipe } from '../../lib/recipes/schema';
import { BrutalPanel } from '../ui/BrutalPanel';

export type RecipeHeroProps = {
  recipe: Recipe;
};

export function RecipeHero({ recipe }: RecipeHeroProps) {
  return (
    <BrutalPanel data-testid="recipe-hero" className="p-0">
      <div
        data-testid="recipe-hero-image"
        className="aspect-[21/9] w-full border-b-brutal border-brutal-black"
        style={{ background: placeholderGradient(recipe.title) }}
        role="img"
        aria-label={`Placeholder image for ${recipe.title}`}
      />
      <div className="p-4">
        <h1 className="font-display text-2xl font-bold">{recipe.title}</h1>
        <p className="mt-2 leading-snug">{recipe.shortDescription}</p>
      </div>
    </BrutalPanel>
  );
}
