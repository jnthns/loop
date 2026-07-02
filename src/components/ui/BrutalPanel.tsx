import type { HTMLAttributes, ReactNode } from 'react';

type BrutalPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

const baseClass =
  'border-brutal border-brutal-black bg-brutal-white p-4';

export function BrutalPanel({
  children,
  className = '',
  ...props
}: BrutalPanelProps) {
  return (
    <div className={`${baseClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
