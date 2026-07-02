import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  BrutalButton,
  BrutalInput,
  BrutalPanel,
  BrutalSelect,
} from './index';

describe('brutalist UI primitives', () => {
  it('BrutalPanel renders children with brutalist border class', () => {
    const { container } = render(<BrutalPanel>Panel content</BrutalPanel>);
    expect(screen.getByText('Panel content')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('border-brutal');
  });

  it('BrutalButton renders as a button with label', () => {
    render(<BrutalButton>Generate</BrutalButton>);
    const button = screen.getByRole('button', { name: 'Generate' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('bg-brutal-accent');
  });

  it('BrutalSelect renders options', () => {
    render(
      <BrutalSelect aria-label="Protein">
        <option value="chicken">Chicken</option>
        <option value="beef">Beef</option>
      </BrutalSelect>,
    );
    expect(screen.getByRole('combobox', { name: 'Protein' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Chicken' })).toBeInTheDocument();
  });

  it('BrutalInput renders with placeholder', () => {
    render(<BrutalInput placeholder="Extra ingredients on hand" />);
    expect(
      screen.getByPlaceholderText('Extra ingredients on hand'),
    ).toBeInTheDocument();
  });
});
