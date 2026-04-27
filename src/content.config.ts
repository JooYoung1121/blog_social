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
    // 구매 형태 (lint 룰과 톤이 분기됨)
    // - self-purchased: 직접 구매 (가격 표기 OK)
    // - sponsored: 협찬 (원고료+제품, 가이드 있음, 가격 표기 X)
    // - gifted: 무상 제공만 (가이드 없음, 가격 표기 X)
    // - service-experience: 음식점/시설 체험단
    purchaseType: z
      .enum(['self-purchased', 'sponsored', 'gifted', 'service-experience'])
      .optional(),
    sponsored: z.boolean().default(false), // legacy — purchaseType으로 대체 중
    sponsorInfo: z.string().optional(),
    productLink: z.string().url().optional(),
    naverPostUrl: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
