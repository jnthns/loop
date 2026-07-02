import type { APIContext } from 'astro';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../../pages/api/recipes/generate';
import { resetRecipeCacheForTests } from './cache';
import { recipeArraySchema } from './schema';

function createPostContext(body: unknown): APIContext {
  return {
    request: new Request('http://localhost/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    params: {},
    locals: {},
    cookies: {
      get: () => undefined,
      has: () => false,
      set: () => {},
      delete: () => {},
      headers: () => new Headers(),
    },
    url: new URL('http://localhost/api/recipes/generate'),
    site: new URL('http://localhost'),
    generator: 'test',
    redirect: () => new Response(null, { status: 302 }),
    clientAddress: '127.0.0.1',
    getActionResult: () => undefined,
    callAction: async () => {
      throw new Error('callAction not implemented in test');
    },
    isPrerendered: false,
    currentLocale: undefined,
    preferredLocale: undefined,
    preferredLocaleList: undefined,
    routing: 'server',
    rewrite: () => new Response(null, { status: 404 }),
  } as unknown as APIContext;
}

describe('POST /api/recipes/generate', () => {
  beforeEach(() => {
    resetRecipeCacheForTests();
    vi.unstubAllEnvs();
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    resetRecipeCacheForTests();
    vi.unstubAllEnvs();
  });

  it('returns JSON array of 6 recipes for { random: true }', async () => {
    const response = await POST(createPostContext({ random: true }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');

    const recipes = recipeArraySchema.parse(await response.json());
    expect(recipes).toHaveLength(6);
    expect(recipes[0]?.id).toMatch(/^mock-/);
  });

  it('returns JSON array of 6 recipes for filtered body', async () => {
    const response = await POST(
      createPostContext({
        protein: 'Beef',
        countryOfOrigin: 'Mexican',
        flavorProfile: 'Spicy',
        extraIngredients: 'cilantro',
      }),
    );

    expect(response.status).toBe(200);

    const recipes = recipeArraySchema.parse(await response.json());
    expect(recipes).toHaveLength(6);
    expect(recipes.every((r) => r.protein === 'Beef')).toBe(true);
  });

  it('returns 400 for invalid request body', async () => {
    const response = await POST(createPostContext({ random: false }));

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Invalid request body');
  });
});
