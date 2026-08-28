# Portfolio site design

Static portfolio for a software engineer. Astro 5 + TypeScript + Tailwind v4, deployed as static HTML.

## Pages
- `/` — hero (name, one-line pitch), featured projects, short about, contact links
- `/projects` — grid of all projects; `/projects/[slug]` detail pages
- `/about` — longer bio, experience list

## Content model
`src/content/projects/*.md` with frontmatter: title, summary, tags[], date, featured, repo?, url?. Body is the case study.

## Aesthetic
Dark editorial with light mode via `prefers-color-scheme`. Near-black background, serif display headings (Fraunces), sans body (Inter), single warm accent. Generous spacing, subtle fade-up reveals that respect `prefers-reduced-motion`.

## Out of scope
Blog, CMS, analytics, contact form.
