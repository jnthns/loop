import { BrutalPanel } from '../ui/BrutalPanel';

export type ProChefTipsPanelProps = {
  proChefTips: string[];
  visible?: boolean;
};

export function ProChefTipsPanel({
  proChefTips,
  visible = true,
}: ProChefTipsPanelProps) {
  if (!visible) {
    return null;
  }

  return (
    <BrutalPanel data-testid="pro-chef-tips-panel">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">
        Pro Chef Tips
      </h2>
      <ol className="mt-4 flex flex-col gap-4">
        {proChefTips.map((tip, index) => (
          <li
            key={`tip-${index}`}
            data-testid="pro-chef-tip"
            className="flex gap-3"
          >
            <span className="font-display shrink-0 font-bold">
              Step {index + 1}:
            </span>
            <span>{tip}</span>
          </li>
        ))}
      </ol>
    </BrutalPanel>
  );
}
