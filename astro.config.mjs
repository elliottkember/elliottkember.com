// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://elliottkember.com',
  vite: { plugins: [tailwindcss()] },
  // the homepage is a static page in public/ (the Lumen canvas site), so list it for the sitemap by hand
  integrations: [sitemap({ customPages: ['https://elliottkember.com/'] })],
});
