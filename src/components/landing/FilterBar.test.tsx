import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  it('renders all filter controls', () => {
    render(<FilterBar onGenerate={vi.fn()} />);

    expect(screen.getByRole('combobox', { name: 'Protein' })).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Country of Origin' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Flavor Profile' }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Extra ingredients on hand'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
  });

  it('calls onGenerate with current filter values', () => {
    const onGenerate = vi.fn();

    render(<FilterBar onGenerate={onGenerate} />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    expect(onGenerate).toHaveBeenCalledWith({
      protein: 'Chicken',
      countryOfOrigin: 'Italian',
      flavorProfile: 'Spicy',
      extraIngredients: '',
    });
  });

  it('disables controls while loading', () => {
    render(<FilterBar onGenerate={vi.fn()} loading />);

    expect(screen.getByRole('combobox', { name: 'Protein' })).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Country of Origin' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: 'Flavor Profile' }),
    ).toBeDisabled();
    expect(
      screen.getByPlaceholderText('Extra ingredients on hand'),
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDisabled();
  });
});
