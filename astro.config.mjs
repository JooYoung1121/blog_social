// @ts-check
import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://jinas-holiday.vercel.app',
  // Astro 5+ "static" with adapter: 정적 페이지는 prerender, /admin과 /api는 page-level prerender:false 로 SSR
  output: 'static',
  adapter: vercel(),

  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },

  integrations: [sitemap()],
});