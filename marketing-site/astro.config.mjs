import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://fintrack.app',
  integrations: [sitemap()],
  output: 'static',
});
