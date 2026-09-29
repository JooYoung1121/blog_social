import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(), // 글 수정 시 신선도 신호 (JSON-LD dateModified)
    // C-rank 2축(육아/반려견) + 축 밖 3종. 라벨·설명은 style-rules.ts CATEGORY_META가 정본.
    category: z.enum([
      'baby-products',
      'parenting',
      'pet',
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

    // ── AI 친화 레이어 (docs/ai-friendly-guide.md §2.1) ──────────────
    // 전부 optional. 없는 글은 기존대로 빌드되고, 있을 때만 JSON-LD가 확장된다.
    // 규칙: 여기 적는 내용은 반드시 본문에도 보여야 한다.
    //       (시각적 내용과 구조화 데이터의 불일치는 manual action 위험)

    /** 한 줄 요약. 본문 TL;DR 인용블록의 첫 줄과 같은 내용. Review.reviewBody로 나간다. */
    tldr: z.string().optional(),

    /** 본문 FAQ 섹션과 1:1 대응. FAQPage 스키마로 출력된다. */
    faq: z
      .array(z.object({ q: z.string(), a: z.string() }))
      .optional(),

    /** 브랜드 정식명. Product.brand로 나간다. */
    brand: z.string().optional(),

    /** 제품 정식명. Product.name으로 나간다. */
    product: z.string().optional(),

    /** 인증·등급 등 객관 사실. Product.additionalProperty로 나간다. */
    certifications: z.array(z.string()).optional(),
  }),
});

export const collections = { posts };
