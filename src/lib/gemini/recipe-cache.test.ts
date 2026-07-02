import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GEMINI_MODEL } from './client';
import {
  RECIPE_CACHE_DISPLAY_NAME,
  RECIPE_CACHE_TTL,
  RECIPE_SYSTEM_INSTRUCTION,
  generateRecipeJsonContent,
  getRecipeSystemCacheName,
  resetRecipeSystemCacheForTests,
} from './recipe-cache';

const mockCreateCache = vi.fn();
const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    caches: {
      create: mockCreateCache,
    },
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('recipe-cache', () => {
  beforeEach(() => {
    mockCreateCache.mockReset();
    mockGenerateContent.mockReset();
    resetRecipeSystemCacheForTests();
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetRecipeSystemCacheForTests();
  });

  it('creates explicit context cache and returns cache name', async () => {
    mockCreateCache.mockResolvedValue({ name: 'cachedContents/recipe-abc' });

    const { createGeminiClient } = await import('./client');
    const client = createGeminiClient('test-key');
    const cacheName = await getRecipeSystemCacheName(client);

    expect(mockCreateCache).toHaveBeenCalledWith({
      model: GEMINI_MODEL,
      config: {
        displayName: RECIPE_CACHE_DISPLAY_NAME,
        systemInstruction: RECIPE_SYSTEM_INSTRUCTION,
        ttl: RECIPE_CACHE_TTL,
      },
    });
    expect(cacheName).toBe('cachedContents/recipe-abc');
  });

  it('reuses in-memory cache name without second caches.create call', async () => {
    mockCreateCache.mockResolvedValue({ name: 'cachedContents/recipe-abc' });

    const { createGeminiClient } = await import('./client');
    const client = createGeminiClient('test-key');

    await getRecipeSystemCacheName(client);
    await getRecipeSystemCacheName(client);

    expect(mockCreateCache).toHaveBeenCalledTimes(1);
  });

  it('passes cache name to generateContent via generateRecipeJsonContent', async () => {
    mockCreateCache.mockResolvedValue({ name: 'cachedContents/recipe-xyz' });
    mockGenerateContent.mockResolvedValue({ text: '[{"id":"r1"}]' });

    const { createGeminiClient } = await import('./client');
    const client = createGeminiClient('test-key');
    const schema = { type: 'array' };

    const result = await generateRecipeJsonContent(
      {
        contents: 'Generate six chicken recipes from Italy',
        responseJsonSchema: schema,
      },
      client,
    );

    expect(mockCreateCache).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: GEMINI_MODEL,
      contents: 'Generate six chicken recipes from Italy',
      config: {
        cachedContent: 'cachedContents/recipe-xyz',
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });
    expect(result).toBe('[{"id":"r1"}]');
  });

  it('throws when caches.create returns no name', async () => {
    mockCreateCache.mockResolvedValue({ name: undefined });

    const { createGeminiClient } = await import('./client');
    const client = createGeminiClient('test-key');

    await expect(getRecipeSystemCacheName(client)).rejects.toThrow(
      /failed to create recipe system context cache/i,
    );
  });
});
