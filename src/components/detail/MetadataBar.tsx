import type { Recipe } from '../../lib/recipes/schema';
import { BrutalButton } from '../ui/BrutalButton';
import { BrutalPanel } from '../ui/BrutalPanel';

export type MetadataBarProps = {
  recipe: Recipe;
  saved?: boolean;
  onSaveToggle?: () => void;
  showProTips?: boolean;
  onDisplayToggle?: () => void;
};

export function MetadataBar({
  recipe,
  saved = false,
  onSaveToggle,
  showProTips = true,
  onDisplayToggle,
}: MetadataBarProps) {
  const totalMinutes = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  return (
    <div
      data-testid="metadata-bar"
      className="grid grid-cols-1 gap-4 md:grid-cols-3"
    >
      <BrutalPanel data-testid="metadata-cooking-time">
        <p className="text-xs font-bold uppercase tracking-wide">Cooking Time</p>
        <p className="font-display text-xl font-bold">{totalMinutes} min</p>
        <p className="text-sm">
          Prep {recipe.prepTimeMinutes} min · Cook {recipe.cookTimeMinutes} min ·{' '}
          {recipe.servings} servings
        </p>
      </BrutalPanel>

      <BrutalPanel
        data-testid="metadata-save"
        className="flex items-center justify-center"
      >
        <BrutalButton
          variant={saved ? 'primary' : 'secondary'}
          onClick={onSaveToggle}
          aria-pressed={saved}
        >
          {saved ? 'Saved' : 'Save for later'}
        </BrutalButton>
      </BrutalPanel>

      <BrutalPanel
        data-testid="metadata-display-toggle"
        className="flex items-center justify-center"
      >
        <BrutalButton
          variant="secondary"
          onClick={onDisplayToggle}
          aria-pressed={showProTips}
        >
          {showProTips ? 'Hide pro tips' : 'Show pro tips'}
        </BrutalButton>
      </BrutalPanel>
    </div>
  );
}
