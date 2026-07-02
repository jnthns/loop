import { motion } from 'framer-motion';
import { placeholderGradient } from '../../lib/recipes/placeholders';
import type { Recipe } from '../../lib/recipes/schema';

export type RecipeCardProps = {
  recipe: Recipe;
  columnIndex: number;
  onClick?: (recipe: Recipe) => void;
};

export function RecipeCard({ recipe, columnIndex, onClick }: RecipeCardProps) {
  const flipped = columnIndex % 3 === 1;
  const totalMinutes = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  const imageBlock = (
    <div
      data-testid="recipe-card-image"
      className={`aspect-[4/3] w-full border-brutal-black ${
        flipped ? 'border-t-brutal' : 'border-b-brutal'
      }`}
      style={{ background: placeholderGradient(recipe.title) }}
      aria-hidden
    />
  );

  const textBlock = (
    <div data-testid="recipe-card-text" className="flex flex-col gap-2 p-4">
      <h3 className="font-display text-lg font-bold leading-tight">
        {recipe.title}
      </h3>
      <p className="text-sm leading-snug">{recipe.shortDescription}</p>
      <p className="text-xs font-bold uppercase tracking-wide">
        {recipe.protein} · {recipe.countryOfOrigin} · {totalMinutes} min
      </p>
    </div>
  );

  return (
    <motion.article
      layout
      variants={{
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 },
      }}
      data-testid="recipe-card"
      data-flipped={flipped ? 'true' : 'false'}
      className="cursor-pointer border-brutal border-brutal-black bg-brutal-white"
      onClick={() => onClick?.(recipe)}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.(recipe);
        }
      }}
    >
      {flipped ? (
        <>
          {textBlock}
          {imageBlock}
        </>
      ) : (
        <>
          {imageBlock}
          {textBlock}
        </>
      )}
    </motion.article>
  );
}
