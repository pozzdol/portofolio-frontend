// @ts-check
import { defineConfig, envField } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';

// https://astro.build/config
export default defineConfig({
  integrations: [icon()],

  env: {
    schema: {
      // Read-only role. Only ever read at build time, never shipped to the browser.
      DATABASE_URL: envField.string({ context: 'server', access: 'secret' }),
    },
  },

  image: {
    // Certificate scans and project screenshots live on R2, referenced by
    // absolute URL from the database.
    domains: ['cdn.fkriachmd.qzz.io'],
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
