import type { InputHTMLAttributes } from 'react';

type BrutalInputProps = InputHTMLAttributes<HTMLInputElement>;

const baseClass =
  'w-full border-brutal border-brutal-black bg-brutal-white px-3 py-2 font-sans focus:border-brutal-black focus:outline-none focus:ring-0';

export function BrutalInput({ className = '', ...props }: BrutalInputProps) {
  return <input className={`${baseClass} ${className}`.trim()} {...props} />;
}
