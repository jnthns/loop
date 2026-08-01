import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { HttpsUrlSchema } from '~/lib/schemas/url';
import { FACET_IDS } from '~/lib/knowledge/facets';
import { ARCHETYPE_IDS } from '~/lib/builds/archetypes';

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
    /**
     * When a `time-sensitive` article (see `tags`) was last checked against
     * current news — distinct from `updated`, which can be bumped by an edit
     * that touches nothing player-specific. Required whenever `tags` includes
     * `time-sensitive`; the content test in `tests/knowledge.test.ts` fails
     * the build once `asOf` is more than 45 days old, so a dated article that
     * quietly rotted into next season is loud instead of silent.
     */
    asOf: z.coerce.date().optional(),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: HttpsUrlSchema,
        }),
      )
      .min(1, 'every knowledge article must cite at least one source'),
  }),
});

/**
 * Build archetypes live at src/content/builds/<archetype-id>.md, one file per
 * `ARCHETYPE_IDS` entry. Using that enum here (rather than a free-string field)
 * is deliberate: it makes prose/math drift between the archetype math in
 * `~/lib/builds/archetypes.ts` and this content a typecheck failure rather
 * than a runtime surprise.
 */
const builds = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/builds' }),
  schema: z.object({
    title: z.string(),
    archetype: z.enum(ARCHETYPE_IDS),
    tagline: z.string(),
    thesis: z.string(),
    worksWhen: z.array(z.string()).min(1),
    failsWhen: z.array(z.string()).min(1),
    updated: z.coerce.date(),
    confidence: z.enum(['low', 'medium', 'high']),
    sources: z
      .array(
        z.object({
          label: z.string(),
          url: HttpsUrlSchema,
        }),
      )
      .min(2, 'every build must cite at least two expert sources'),
  }),
});

export const collections = { knowledge, builds };
