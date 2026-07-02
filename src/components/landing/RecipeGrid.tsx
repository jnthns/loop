import { motion } from 'framer-motion';
import type { Recipe } from '../../lib/recipes/schema';
import { RecipeCard } from './RecipeCard';

export type RecipeGridProps = {
  recipes: Recipe[];
  onCardClick?: (recipe: Recipe) => void;
  /** Change to re-trigger stagger entrance on grid refresh. */
  refreshKey?: string | number;
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export function RecipeGrid({
  recipes,
  onCardClick,
  refreshKey = 0,
}: RecipeGridProps) {
  return (
    <motion.div
      key={refreshKey}
      data-testid="recipe-grid"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {recipes.map((recipe, index) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          columnIndex={index % 3}
          onClick={onCardClick}
        />
      ))}
    </motion.div>
  );
}
