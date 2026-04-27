// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://jinas-holiday.vercel.app',
  output: 'server',
  adapter: vercel(),

  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },

  integrations: [sitemap()],
});