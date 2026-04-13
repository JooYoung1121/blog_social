import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    category: z.enum([
      'baby-products',
      'parenting',
      'daily-life',
      'food',
      'travel',
    ]),
    tags: z.array(z.string()).default([]),
    thumbnail: z.string(),
    images: z.array(z.string()).default([]),
    sponsored: z.boolean().default(false),
    sponsorInfo: z.string().optional(),
    productLink: z.string().url().optional(),
    naverPostUrl: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
