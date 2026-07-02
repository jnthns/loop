import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getMockRecipes } from '../../lib/recipes/mock';
import { readRecipeSession } from '../../lib/storage/recipe-session';
import { LandingApp } from './LandingApp';

describe('LandingApp', () => {
  const randomRecipes = getMockRecipes({ random: true });
  const filteredRecipes = getMockRecipes({
    protein: 'Chicken',
    countryOfOrigin: 'Italian',
    flavorProfile: 'Spicy',
  });

  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('fetches random recipes on mount and re-fetches on Generate', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => randomRecipes,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => filteredRecipes,
      });
    vi.stubGlobal('fetch', fetchMock);

    render(<LandingApp />);

    await waitFor(() => {
      expect(screen.getAllByTestId('recipe-card')).toHaveLength(6);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ random: true }),
    });
    expect(readRecipeSession()).toEqual(randomRecipes);

    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    expect(fetchMock).toHaveBeenLastCalledWith('/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        protein: 'Chicken',
        countryOfOrigin: 'Italian',
        flavorProfile: 'Spicy',
      }),
    });
    expect(readRecipeSession()).toEqual(filteredRecipes);
    expect(screen.getByText(filteredRecipes[0].title)).toBeInTheDocument();
  });

  it('falls back to mock recipes when the API is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    render(<LandingApp />);

    await waitFor(() => {
      expect(screen.getAllByTestId('recipe-card')).toHaveLength(6);
    });

    expect(screen.getByText(randomRecipes[0].title)).toBeInTheDocument();
    expect(readRecipeSession()).toEqual(randomRecipes);
  });

  it('navigates to detail page on card click', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => randomRecipes,
      }),
    );

    render(<LandingApp />);

    await waitFor(() => {
      expect(screen.getAllByTestId('recipe-card')).toHaveLength(6);
    });

    fireEvent.click(screen.getAllByTestId('recipe-card')[0]);

    expect(assign).toHaveBeenCalledWith(`/recipe/${randomRecipes[0].id}`);
  });
});
