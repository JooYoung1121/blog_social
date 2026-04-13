// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://blog-social.vercel.app',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
