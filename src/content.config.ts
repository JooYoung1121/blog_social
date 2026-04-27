import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(), // 글 수정 시 신선도 신호 (JSON-LD dateModified)
    category: z.enum([
      'baby-products',
      'parenting',
      'daily-life',
      'food',
      'travel',
    ]),
    tags: z.array(z.string()).default([]),
    mainKeyword: z.string().optional(), // SEO 메인 키워드 (lint 시 빈도 검사 기준)
    intent: z
      .enum(['review', 'compare', 'info', 'location', 'diary'])
      .default('review'), // AiRSearch 검색 의도 분기
    target: z.enum(['search', 'homefeed', 'both']).default('search'), // 노출 채널
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
