import { GoogleGenAI, type GoogleGenAI as GoogleGenAIType } from '@google/genai';

export const GEMINI_MODEL = 'gemini-3.1-flash-lite' as const;

export interface GenerateJsonContentOptions {
  contents: string;
  cachedContent?: string;
  responseJsonSchema?: unknown;
}

function readServerEnv(name: string): string | undefined {
  if (typeof process !== 'undefined' && process.env[name]) {
    return process.env[name];
  }

  const env = import.meta.env as Record<string, string | undefined>;
  return env[name];
}

/** Server-only: returns GEMINI_API_KEY when set in the environment. */
export function getGeminiApiKey(): string | undefined {
  return readServerEnv('GEMINI_API_KEY');
}

export function isGeminiConfigured(): boolean {
  return Boolean(getGeminiApiKey());
}

export function createGeminiClient(apiKey?: string): GoogleGenAIType {
  const key = apiKey ?? getGeminiApiKey();
  if (!key) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  return new GoogleGenAI({ apiKey: key });
}

/**
 * Generate structured JSON from Gemini using the recipe model.
 * Pass an explicit client in tests; production code uses env-backed defaults.
 */
export async function generateJsonContent(
  options: GenerateJsonContentOptions,
  client?: GoogleGenAIType,
): Promise<string> {
  const ai = client ?? createGeminiClient();

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: options.contents,
    config: {
      ...(options.cachedContent ? { cachedContent: options.cachedContent } : {}),
      responseMimeType: 'application/json',
      ...(options.responseJsonSchema
        ? { responseJsonSchema: options.responseJsonSchema }
        : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini returned an empty response');
  }

  return text;
}
