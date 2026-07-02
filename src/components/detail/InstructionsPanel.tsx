import { BrutalPanel } from '../ui/BrutalPanel';

export type InstructionsPanelProps = {
  instructions: string[];
};

export function InstructionsPanel({ instructions }: InstructionsPanelProps) {
  return (
    <BrutalPanel data-testid="instructions-panel">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide">
        Step-by-Step Instructions
      </h2>
      <ol className="mt-4 flex flex-col gap-4">
        {instructions.map((step, index) => (
          <li
            key={`step-${index}`}
            data-testid="instruction-step"
            className="flex gap-3"
          >
            <span className="font-display shrink-0 font-bold">{index + 1}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </BrutalPanel>
  );
}
