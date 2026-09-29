/**
 * jsonld.ts — 구조화 데이터(JSON-LD) 빌더
 *
 * 왜 @graph인가:
 *   한 페이지에 Article / FAQPage / Product 같은 엔티티가 공존할 때,
 *   각각을 별도 <script>로 흩뿌리면 검색엔진·LLM이 관계를 못 읽는다.
 *   @graph로 묶고 안정적인 @id(URL + #fragment)로 서로를 참조하면
 *   "이 글은 이 제품에 대한 이 사람의 리뷰"라는 관계가 명시된다.
 *
 * 절대 규칙 (docs/ai-friendly-guide.md §2.2):
 *   - 시각적으로 보이는 내용만 스키마에 넣는다.
 *     본문에 없는 FAQ를 FAQPage로 내보내면 manual action 위험.
 *   - 협찬 여부는 스키마에 쓰지 않는다. 본문 룰과 동일 (frontmatter 메타 전용).
 *   - 가격/수량/사이즈는 스키마에도 넣지 않는다 (AGENTS.md Hard Rule).
 *
 * 근거:
 *   - Google 구조화 데이터 가이드 https://developers.google.com/search/docs/appearance/structured-data/faqpage
 *   - schema.org Article / Product / FAQPage
 *   - docs/ai-friendly-guide.md §2.1-2.2 (본 파일이 그 제안의 구현체)
 */

export interface PostJsonLdInput {
  siteUrl: string;
  canonical: string;
  title: string;
  description: string;
  image: string;
  publishedDate?: Date;
  updatedDate?: Date;
  tags?: string[];
  categoryLabel?: string;
  /** AI 친화 레이어 (전부 optional) */
  tldr?: string;
  faq?: { q: string; a: string }[];
  brand?: string;
  product?: string;
  certifications?: string[];
  productLink?: string;
}

const AUTHOR = {
  '@type': 'Person',
  '@id': 'https://jinas-holiday.vercel.app/#author',
  name: '지나',
  alternateName: '지나의 휴일',
  url: 'https://blog.naver.com/snf00467',
  description:
    '용인 죽전에 사는 육아맘. 아기 봄이와 반려견 나니·스리를 키우며 직접 써본 것만 기록합니다.',
} as const;

/** 블로그 글 페이지의 @graph */
export function buildPostGraph(input: PostJsonLdInput): object {
  const {
    siteUrl,
    canonical,
    title,
    description,
    image,
    publishedDate,
    updatedDate,
    tags = [],
    categoryLabel,
    tldr,
    faq,
    brand,
    product,
    certifications,
    productLink,
  } = input;

  const graph: Record<string, unknown>[] = [];

  // ── 1. BlogPosting (primary entity) ──────────────────────────
  const article: Record<string, unknown> = {
    '@type': 'BlogPosting',
    '@id': `${canonical}#article`,
    headline: title,
    description,
    image: { '@type': 'ImageObject', '@id': `${canonical}#primaryimage`, url: image },
    datePublished: publishedDate?.toISOString(),
    dateModified: (updatedDate ?? publishedDate)?.toISOString(),
    author: { '@id': AUTHOR['@id'] },
    publisher: {
      '@type': 'Organization',
      '@id': `${siteUrl}/#publisher`,
      name: '지나의 휴일',
      logo: { '@type': 'ImageObject', url: `${siteUrl}/favicon.svg` },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
    inLanguage: 'ko-KR',
  };
  if (tags.length > 0) article.keywords = tags.join(', ');
  if (categoryLabel) article.articleSection = categoryLabel;
  // TL;DR은 AI가 요약 후보로 집어가기 좋은 필드다.
  if (tldr) article.abstract = tldr;
  graph.push(article);

  // ── 2. Person (저자) ─────────────────────────────────────────
  graph.push({ ...AUTHOR });

  // ── 3. ImageObject (대표 이미지) ─────────────────────────────
  graph.push({
    '@type': 'ImageObject',
    '@id': `${canonical}#primaryimage`,
    url: image,
    contentUrl: image,
    caption: title,
  });

  // ── 4. FAQPage — 본문에 실제로 보이는 FAQ만 ──────────────────
  if (faq && faq.length > 0) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faq.map((item, i) => ({
        '@type': 'Question',
        '@id': `${canonical}#faq-${i + 1}`,
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }

  // ── 5. Product + Review — 제품 리뷰 글일 때만 ────────────────
  // 가격/재고(Offer)는 넣지 않는다. 본문 가격 표기 금지 룰과 동일.
  if (product) {
    const productNode: Record<string, unknown> = {
      '@type': 'Product',
      '@id': `${canonical}#product`,
      name: product,
      image,
    };
    if (brand) productNode.brand = { '@type': 'Brand', name: brand };
    if (productLink) productNode.url = productLink;
    if (certifications && certifications.length > 0) {
      productNode.additionalProperty = certifications.map((c) => ({
        '@type': 'PropertyValue',
        name: '인증',
        value: c,
      }));
    }
    // 별점을 매기지 않으므로 reviewRating은 넣지 않는다 (없는 평점을 지어내지 않음).
    productNode.review = {
      '@type': 'Review',
      '@id': `${canonical}#review`,
      author: { '@id': AUTHOR['@id'] },
      datePublished: publishedDate?.toISOString(),
      reviewBody: tldr || description,
      itemReviewed: { '@id': `${canonical}#product` },
    };
    graph.push(productNode);
  }

  // ── 6. BreadcrumbList ────────────────────────────────────────
  graph.push({
    '@type': 'BreadcrumbList',
    '@id': `${canonical}#breadcrumb`,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '홈', item: siteUrl },
      ...(categoryLabel
        ? [{ '@type': 'ListItem', position: 2, name: categoryLabel }]
        : []),
      { '@type': 'ListItem', position: categoryLabel ? 3 : 2, name: title },
    ],
  });

  return { '@context': 'https://schema.org', '@graph': graph };
}

/** 사이트 루트/목록 페이지의 @graph */
export function buildSiteGraph(siteUrl: string): object {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        name: '지나의 휴일',
        description: '육아, 일상, 솔직한 리뷰를 기록합니다',
        url: siteUrl,
        inLanguage: 'ko-KR',
        publisher: { '@id': `${siteUrl}/#publisher` },
      },
      {
        '@type': 'Blog',
        '@id': `${siteUrl}/#blog`,
        name: '지나의 휴일',
        url: siteUrl,
        author: { '@id': AUTHOR['@id'] },
      },
      { ...AUTHOR },
    ],
  };
}
