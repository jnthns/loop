import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { FACET_IDS } from '~/lib/knowledge/facets';

/**
 * Knowledge articles live at src/content/knowledge/<facet>/<slug>.md.
 *
 * `sources` is required and non-empty by design: the curator loop writes into
 * this collection unattended, and a schema that refuses uncited articles is the
 * cheapest possible guard against invented claims.
 */
const knowledge = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/knowledge' }),
  schema: z.object({
    title: z.string(),
    facet: z.enum(FACET_IDS),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    confidence: z.enum(['low', 'medium', 'high']),
    updated: z.coerce.date(),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: z.url(),
        }),
      )
      .min(1, 'every knowledge article must cite at least one source'),
  }),
});

export const collections = { knowledge };
