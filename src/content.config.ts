import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
    featured: z.boolean().default(false),
    repo: z.string().url().optional(),
    url: z.string().url().optional(),
  }),
});

export const collections = { projects };
