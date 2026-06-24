/**
 * PostCSS configuration for Tailwind CSS v4.
 *
 * @remarks Tailwind v4 uses @tailwindcss/postcss instead of the v3 plugin.
 * There is no tailwind.config.js — all tokens are defined in globals.css via @theme.
 */
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
