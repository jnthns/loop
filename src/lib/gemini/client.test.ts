import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GEMINI_MODEL,
  createGeminiClient,
  generateJsonContent,
  getGeminiApiKey,
  isGeminiConfigured,
} from './client';

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
  })),
}));

describe('gemini client', () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads GEMINI_API_KEY from process.env', () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    expect(getGeminiApiKey()).toBe('test-key');
    expect(isGeminiConfigured()).toBe(true);
  });

  it('reports unconfigured when GEMINI_API_KEY is unset', () => {
    delete process.env.GEMINI_API_KEY;
    expect(getGeminiApiKey()).toBeUndefined();
    expect(isGeminiConfigured()).toBe(false);
  });

  it('createGeminiClient throws when no API key is available', () => {
    delete process.env.GEMINI_API_KEY;
    expect(() => createGeminiClient()).toThrow(/GEMINI_API_KEY/);
  });

  it('createGeminiClient passes apiKey to GoogleGenAI', async () => {
    const { GoogleGenAI } = await import('@google/genai');
    createGeminiClient('explicit-key');
    expect(GoogleGenAI).toHaveBeenCalledWith({ apiKey: 'explicit-key' });
  });

  it('generateJsonContent calls SDK with model and JSON config', async () => {
    mockGenerateContent.mockResolvedValue({ text: '[{"id":"1"}]' });

    const client = createGeminiClient('test-key');
    const schema = { type: 'array' };

    const result = await generateJsonContent(
      {
        contents: 'Generate six recipes',
        cachedContent: 'cache-name-123',
        responseJsonSchema: schema,
      },
      client,
    );

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: GEMINI_MODEL,
      contents: 'Generate six recipes',
      config: {
        cachedContent: 'cache-name-123',
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });
    expect(result).toBe('[{"id":"1"}]');
  });

  it('generateJsonContent omits optional cache and schema when unset', async () => {
    mockGenerateContent.mockResolvedValue({ text: '{}' });

    await generateJsonContent({ contents: 'prompt only' }, createGeminiClient('key'));

    expect(mockGenerateContent).toHaveBeenCalledWith({
      model: GEMINI_MODEL,
      contents: 'prompt only',
      config: {
        responseMimeType: 'application/json',
      },
    });
  });

  it('generateJsonContent throws when response text is empty', async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    await expect(
      generateJsonContent({ contents: 'test' }, createGeminiClient('key')),
    ).rejects.toThrow(/empty response/i);
  });
});
