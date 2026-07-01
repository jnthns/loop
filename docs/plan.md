# Recipe Generator — Build Plan

Full implementation plan for the loop-engineered recipe generator app. The
canonical product contract lives in [`specs/spec.md`](../specs/spec.md); the
ordered task checklist lives in [`specs/PLAN.md`](../specs/PLAN.md).

## Stack

- **Astro 5** with `output: 'static'` (GitHub Pages)
- **React islands** (`@astrojs/react`) for interactive UI + Framer Motion
- **Tailwind CSS** via `@astrojs/tailwind`
- **Gemini 3.1 Flash-Lite** via `@google/genai` (server-only)
- **Zod** for structured output validation
- **Vitest** + Testing Library for tests

## Why Astro

| Concern | Astro approach |
| ------- | -------------- |
| Landing performance | `.astro` pages ship minimal JS; only islands hydrate |
| Framer Motion / filters / grid | React island (`client:load`) wraps `LandingApp` |
| Gemini API | Server endpoint at `src/pages/api/recipes/generate.ts` |
| Detail page | Astro shell + `DetailApp` React island |
| Deploy | GitHub Pages (`main` push → `.github/workflows/pages.yml`); Astro `output: 'static'` for the built site |

## Design — Framer-style brutalist

| Token | Value |
| ----- | ----- |
| Geometry | `border-radius: 0`; rectangular panels only |
| Borders | 2–4px solid black on cards, inputs, panels |
| Typography | **Syne** via `@fontsource/syne`; weight 700–800 for titles |
| Palette | Black/white base + one accent (electric yellow or raw red) |
| Grid | CSS Grid, 3 columns desktop / 1 column mobile |
| Motion | Framer Motion — staggered card entrance, layout refresh animations |
| Images (v1) | Brutalist CSS gradient placeholders keyed by dish title hash |

### Motion patterns

- **Grid refresh:** `AnimatePresence` + `layout`; stagger `0.08s` per card.
- **Filter confirm:** scale pulse on Generate; grid cross-fade.
- **Detail page:** hero slides up; instruction panels stagger in.
- **Save toggle:** sharp border-color flip (no soft bounce).

## Screen 1 — Landing (`src/pages/index.astro`)

```
┌─────────────────────────────────────────────────────────┐
│ [Protein ▼]  [Country of Origin ▼]  [Flavor Profile ▼]  │
│ [Extra ingredients on hand — full width text input    ] │
│ [ Generate ]                                            │
│ Randomly Generated Dishes Below based on previous...    │
├──────────────┬──────────────┬──────────────┤
│  [ image ]   │  text block  │  [ image ]   │  row 1
│  text block  │  [ image ]   │  text block  │
│  [ image ]   │  text block  │  [ image ]   │  row 2
│  text block  │  [ image ]   │  text block  │
└──────────────┴──────────────┴──────────────┘
         (page scrolls — 6 cards total)
```

- **On mount:** fetch 6 random recipes.
- **On Generate:** POST filters + extra ingredients; animate grid refresh.
- **Card click:** navigate to `/recipe/[id]`.

## Screen 2 — Detail (`src/pages/recipe/[id].astro`)

```
┌─────────────────────────────────────────────────────────┐
│              [ Hero — image placeholder ]               │
├─────────────────────────────────────────────────────────┤
│         Ingredients and measurements panel              │
├──────────────┬──────────────┬──────────────────────────┤
│ cooking time │ save for     │ display toggle           │
│  (read-only) │ later        │ (show/hide pro tips)     │
├──────────────────────────┬──────────────────────────────┤
│ Step-by-step instructions│ Pro chef tips per step     │
└──────────────────────────┴──────────────────────────────┘
```

## Architecture

```
src/pages/index.astro + LandingApp.tsx
        │ POST
        ▼
src/pages/api/recipes/generate.ts
        │
        ├─► server cache (input hash → recipes, 1h TTL)
        └─► Gemini gemini-3.1-flash-lite (@google/genai)
              └─► explicit context cache (system prompt)

DetailApp.tsx ──► localStorage (saved recipes)
LandingApp.tsx ──► sessionStorage (current batch for routing)
```

## Directory layout

```
astro.config.mjs
src/
  layouts/BaseLayout.astro
  pages/
    index.astro
    recipe/[id].astro
    api/recipes/generate.ts
  components/
    landing/   LandingApp, FilterBar, RecipeGrid, RecipeCard
    detail/    DetailApp, RecipeHero, IngredientsPanel, MetadataBar, ...
    ui/        BrutalPanel, BrutalButton, BrutalSelect, BrutalInput
  lib/
    gemini/    client.ts, recipe-cache.ts
    recipes/   schema.ts, options.ts, cache.ts, generate.ts, placeholders.ts
    storage/   saved-recipes.ts, recipe-session.ts
  styles/global.css
```

## Gemini integration

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY });

const response = await ai.models.generateContent({
  model: "gemini-3.1-flash-lite",
  contents: userPrompt,
  config: {
    cachedContent: recipeSystemCacheName,
    responseMimeType: "application/json",
    responseJsonSchema: recipeArraySchema,
  },
});
```

Server-only code in `src/lib/` must never be imported from `.tsx` islands.

## Dependencies

```json
{
  "dependencies": {
    "astro": "^5",
    "@astrojs/react": "^4",
    "@astrojs/tailwind": "^6",
    "@astrojs/node": "^9",
    "react": "^19",
    "react-dom": "^19",
    "@google/genai": "latest",
    "zod": "^3",
    "framer-motion": "^12",
    "@fontsource/syne": "^5"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^3",
    "@testing-library/react": "latest",
    "tailwindcss": "^4"
  }
}
```

## Out of scope (v1)

- Real dish photography / Gemini image generation
- User accounts / cloud sync
- Shopping lists / nutrition facts
- Production deploy config

## Risks

- **Island hydration:** one `LandingApp` + one `DetailApp` to minimize JS.
- **Server-only imports:** enforce `@google/genai` only in api/ + lib/.
- **Empty API key:** UI banner + mock responses in CI.
- **Detail routing:** sessionStorage primary; localStorage fallback for saved items.
