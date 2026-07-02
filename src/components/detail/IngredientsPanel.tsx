import type { Recipe } from '../../lib/recipes/schema';
import { BrutalPanel } from '../ui/BrutalPanel';

export type IngredientsPanelProps = {
  recipe: Recipe;
};

export function IngredientsPanel({ recipe }: IngredientsPanelProps) {
  return (
    <BrutalPanel data-testid="ingredients-panel">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">
        Ingredients &amp; Measurements
      </h2>
      <ul className="mt-4 flex flex-col gap-2">
        {recipe.ingredients.map((ingredient, index) => (
          <li
            key={`${ingredient.item}-${index}`}
            data-testid="ingredient-item"
            className="flex justify-between gap-4 border-b border-brutal-black py-2 last:border-b-0"
          >
            <span>{ingredient.item}</span>
            <span className="shrink-0 font-bold">{ingredient.measurement}</span>
          </li>
        ))}
      </ul>
    </BrutalPanel>
  );
}
