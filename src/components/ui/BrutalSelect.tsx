import type { SelectHTMLAttributes } from 'react';

type BrutalSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

const baseClass =
  'w-full border-brutal border-brutal-black bg-brutal-white px-3 py-2 font-bold focus:border-brutal-black focus:outline-none focus:ring-0';

export function BrutalSelect({
  className = '',
  children,
  ...props
}: BrutalSelectProps) {
  return (
    <select className={`${baseClass} ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
