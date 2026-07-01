# Product Spec — SOURCE OF TRUTH

> This is the single most important file in the repo. The loop reads it fresh on
> every pass. If a fact isn't here (or in a file this links to), the agent does
> not know it. Keep it precise, current, and free of secrets.

---

## 1. One-line summary

An AI-powered recipe generator with a brutalist Framer-style landing page — home cooks pick protein, country of origin, flavor profile, and optional extra ingredients; the app generates tailored recipes in an alternating grid and lets them save favorites locally.

## 2. Problem & users

- **Problem:** Deciding what to cook is slow — browsing recipe sites means filtering manually, and inspiration rarely matches what's in the pantry.
- **Primary user(s):** Home cooks who want quick, personalized recipe ideas without signing up or managing a recipe library in the cloud.
- **What they can do today without it:** Search recipe sites, use ChatGPT manually, or browse cookbooks — all require more effort and no structured save-for-later flow.

## 3. Goals (measurable)

1. Landing page loads with **6 AI-generated random recipes** in a **3-column alternating grid** without user input.
2. Three **dropdowns** (protein, country, flavor profile) + **extra ingredients text input** + **Generate** button refresh recipes with **fluid grid animation** (Framer Motion).
3. Clicking a card opens a **detail page** with hero panel, ingredients bar, metadata row (cooking time | save | display toggle), and split instructions / pro-chef-tips panels.
4. All recipe text is produced by **Gemini `gemini-3.1-flash-lite`** via `@google/genai` on the server (never exposed to the client).
5. **Caching** reduces duplicate API calls: server in-memory cache keyed by filter hash + Gemini explicit context cache for the system prompt.
6. **Save for later** on the detail page persists to **`localStorage`** (dedupe, max 50 recipes FIFO).
7. UI matches the **brutalist design spec**: sharp geometry (no border-radius), heavy borders, bold display typography, high-contrast palette.
8. `scripts/check.sh` exits 0 (lint + typecheck + test + build).

## 4. Non-goals (explicitly out of scope)

- Real dish photography or Gemini image generation (use brutalist CSS gradient placeholders v1).
- User accounts, auth, or cloud sync of saved recipes.
- Shopping lists, nutrition facts, or meal planning.
- User-managed deploy steps (push to `main` deploys via GitHub Actions).

## 5. Constraints & decisions

- **Tech stack:** Astro 5 (`output: 'static'` for GitHub Pages), `@astrojs/react`
  (React islands), `@astrojs/tailwind`, TypeScript, Vitest, Framer Motion,
  `@fontsource/syne`, Zod, `@google/genai`.
- **Runtime/deploy target:** GitHub Pages (static site from `npm run build` →
  `dist/`). Push to `main` triggers `.github/workflows/pages.yml`. Until the
  Astro app exists, CI deploys the placeholder in `site/`. Server API routes
  need `output: 'static'` plus a compatible adapter or external backend — see
  `memory/handoff.md` for the Pages vs server-API constraint.
- **AI model:** `gemini-3.1-flash-lite` per [Google GenAI docs](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite). SDK: `@google/genai` (not deprecated `@google/generative-ai`).
- **Hard constraints:** `GEMINI_API_KEY` server-only; no secrets in specs/, memory/, or commits.
- **Explicit trade-offs:** React islands for interactivity (minimal JS vs full SPA); sessionStorage for detail-page routing (no re-fetch); placeholder images over image gen for v1.

## 6. Acceptance criteria (the contract the loop grades against)

| # | End state (done means...) | Evidence (how the check proves it) |
| - | ------------------------- | ---------------------------------- |
| 1 | Filter bar renders 3 dropdowns + extra-ingredients input + Generate button | Component test: FilterBar renders expected controls |
| 2 | Grid shows 6 cards in 3-column alternating layout (cols 1 & 3 image-on-top; col 2 flipped) | Component test: RecipeGrid renders 6 RecipeCard elements with correct column flip |
| 3 | Generate triggers animated grid refresh | Component test or integration test: fetch called on Generate; grid updates |
| 4 | Initial page load fetches 6 random recipes | Integration test: POST `/api/recipes/generate` with `{ random: true }` on mount |
| 5 | Detail page shows hero, ingredients panel, metadata row (3 panels), split instructions + pro-chef-tips | Route/component test: DetailApp renders all sections |
| 6 | `proChefTips.length === instructions.length` for every generated recipe | Zod schema + unit test on parsed API response |
| 7 | Save for later persists across reload | Unit test: localStorage write/read round-trip |
| 8 | Server cache hit skips second Gemini call for identical inputs | Unit test: mock Gemini called once for duplicate request |
| 9 | No API key in client bundle | `npm run build` + grep/dist check: no `GEMINI_API_KEY` in client chunks |
| 10 | `scripts/check.sh` exits 0 | CI + local run: lint, test, build all green |

## 7. Definition of done (whole build)

The build is complete when **all** of the following hold:

- Every task in `specs/PLAN.md` is checked `- [x]`.
- Every acceptance criterion in §6 has passing evidence.
- `scripts/check.sh` exits 0 and the `checker` subagent approves.
- `specs/STATUS.md` contains the line `ALL TASKS DONE`.

## 8. Open questions / assumptions

- User will provide `GEMINI_API_KEY` later; app must degrade gracefully (banner + mock data in CI) when unset.
- 6 recipes per generation (2 rows × 3 columns per wireframe).
- Detail page loads recipe from `sessionStorage` (written after generation); falls back to `localStorage` for saved recipes opened directly.
- Placeholder images: deterministic CSS gradient keyed by dish title hash.

## 9. UI reference (wireframe)

See [`docs/plan.md`](docs/plan.md) for full wireframe, design tokens, directory layout, and architecture diagrams.

### Screen 1 — Landing

- Filter bar: Protein | Country of Origin | Flavor Profile dropdowns; full-width "Extra ingredients on hand" input; Generate button.
- Sub-label: "Randomly Generated Dishes Below based on previous matching filters".
- 3-column scrollable grid with alternating image/text layout.

### Screen 2 — Detail (`/recipe/[id]`)

- Hero image panel (placeholder v1).
- Full-width ingredients and measurements panel.
- Metadata row: cooking time estimate | save for later | display toggle (show/hide pro-chef-tips).
- Split panels: step-by-step instructions (left) + pro chef tips per step (right).

### Dropdown options

| Field | Values |
| ----- | ------ |
| Protein | Chicken, Beef, Pork, Fish, Tofu, Lamb, Shrimp, Eggs |
| Country | Italian, Mexican, Japanese, Indian, Thai, French, Korean, Moroccan, American, Greek |
| Flavor profile | Spicy, Savory, Sweet, Tangy, Smoky, Herbaceous, Umami, Mild |

### Recipe JSON schema (Gemini structured output)

```typescript
{
  id: string
  title: string
  shortDescription: string
  protein: string
  countryOfOrigin: string
  flavorProfile: string
  prepTimeMinutes: number
  cookTimeMinutes: number
  servings: number
  ingredients: { item: string; measurement: string }[]
  instructions: string[]
  proChefTips: string[]  // one tip per instruction step
}
```
