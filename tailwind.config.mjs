/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    borderRadius: {
      none: '0',
      DEFAULT: '0',
    },
    extend: {
      colors: {
        brutal: {
          black: 'var(--brutal-black)',
          white: 'var(--brutal-white)',
          accent: 'var(--brutal-accent)',
        },
      },
      borderWidth: {
        brutal: '3px',
        'brutal-heavy': '4px',
      },
      fontFamily: {
        sans: ['Syne', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        display: '800',
      },
    },
  },
  plugins: [],
};
