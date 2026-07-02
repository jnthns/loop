import type { ButtonHTMLAttributes } from 'react';

type BrutalButtonVariant = 'primary' | 'secondary';

type BrutalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BrutalButtonVariant;
};

const baseClass =
  'border-brutal border-brutal-black px-6 py-3 font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const variantClass: Record<BrutalButtonVariant, string> = {
  primary:
    'bg-brutal-accent text-brutal-black hover:bg-brutal-black hover:text-brutal-white',
  secondary:
    'bg-brutal-white text-brutal-black hover:bg-brutal-black hover:text-brutal-white',
};

export function BrutalButton({
  variant = 'primary',
  className = '',
  children,
  type = 'button',
  ...props
}: BrutalButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClass} ${variantClass[variant]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}
