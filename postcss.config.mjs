/**
 * POSTCSS_CONFIG
 *
 * Purpose: Enables Tailwind CSS processing through the supported PostCSS integration.
 * Connections: Tailwind CSS and the Next.js stylesheet build pipeline.
 * Risk: Low because this file only configures stylesheet compilation.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
