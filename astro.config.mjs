// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import icon from 'astro-icon';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // Absolute URLs are the addressing primitive for canonical tags, the sitemap,
  // og:image and every JSON-LD @id. Nothing downstream works without this line.
  site: 'https://fikriachmad.dev',
  trailingSlash: 'never',

  integrations: [icon(), sitemap()],

  // Self-hosted, latin subset only, cut to the weights the design actually
  // renders: 211KB across two Google origins (one render-blocking) became 113KB
  // same-origin. The files are committed and the provider is `local`, so the
  // build never depends on fonts.gstatic.com being reachable from CI.
  // Re-download with the URLs from fonts.googleapis.com/css2 if a face changes.
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Bricolage Grotesque',
      cssVariable: '--font-bricolage',
      fallbacks: ['ui-sans-serif', 'sans-serif'],
      options: {
        variants: [
          {
            // The display face is only ever semibold or bold; the 400-599 span
            // of the variable axis is never rendered and was most of the file.
            weight: '600 800',
            style: 'normal',
            src: ['./src/assets/fonts/bricolage-grotesque-latin-var.woff2'],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist',
      cssVariable: '--font-geist',
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
      // 500 dropped deliberately: it was 29KB for two words. Everything that
      // was font-medium is now font-semibold.
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/geist-latin-400.woff2'] },
          { weight: 600, style: 'normal', src: ['./src/assets/fonts/geist-latin-600.woff2'] },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Geist Mono',
      cssVariable: '--font-geist-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          { weight: 400, style: 'normal', src: ['./src/assets/fonts/geist-mono-latin-400.woff2'] },
        ],
      },
    },
  ],

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

  build: {
    // Measured, not assumed: 'always' inlined ~30KB of CSS into every page
    // (42KB raw / 10.5KB gzipped each) and gave up the cross-page cache to save
    // one round trip. 'auto' inlines only what is genuinely small.
    inlineStylesheets: 'auto',
  },

  vite: {
    plugins: [tailwindcss()]
  }
});
