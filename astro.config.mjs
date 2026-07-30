// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves this repo project-scoped at https://jnthns.github.io/loop/,
// so `base` must be set and every internal link must go through
// `import.meta.env.BASE_URL` (see src/lib/url.ts). Getting this wrong 404s in
// production while working fine in dev.
export default defineConfig({
  site: 'https://jnthns.github.io',
  base: '/loop',
  trailingSlash: 'ignore',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
