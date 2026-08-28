# elliottkember.com

Personal portfolio. Astro 5 + Tailwind v4, static output.

## Develop

Requires Node 22 (`nvm use`).

    npm install
    npm run dev

## Edit content

- Site-wide name, pitch, links: `src/site.ts`
- Projects: add a Markdown file to `src/content/projects/`. Frontmatter schema lives in `src/content.config.ts`. Set `featured: true` to show it on the home page.
- About page and experience: `src/pages/about.astro`

## Deploy

`npm run build` writes static files to `dist/`. Point Vercel, Netlify, or Cloudflare Pages at the repo; they detect Astro automatically. Update `site` in `astro.config.mjs` to your real domain so the sitemap and canonical URLs are correct.
