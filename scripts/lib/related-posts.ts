/**
 * related-posts.ts
 *
 * 내부 링크 추천 — "어떤 기존 글을 이 글 본문에 링크로 걸면 자연스러운가"를 점수로 뽑는다.
 *
 * 왜 필요한가:
 *   STRUCTURE_RULES.internal_links 는 2~3개를 요구하는데 실제 발행된 글에는 0개였다.
 *   내부 링크는 (1) 체류시간, (2) 같은 주제 문서 묶음(C-rank 맥락) 양쪽에 쓰이므로
 *   2026 기준에서도 버릴 카드가 아니다.
 *
 * 사용처:
 *   1. scripts/suggest-links.ts (CLI 추천)
 *   2. src/pages/srv/admin/generate.ts (AI가 초안 쓸 때 후보를 프롬프트로 전달)
 */

export interface PostMeta {
  slug: string;
  title: string;
  category: string;
  tags: string[];
  mainKeyword?: string;
  date?: string;
}

export interface RelatedSuggestion extends PostMeta {
  score: number;
  reasons: string[];
  /** 본문에 그대로 붙일 수 있는 마크다운 링크 */
  markdown: string;
}

const WEIGHT = {
  sharedTag: 3,
  sameCategory: 2,
  keywordOverlap: 2,
  titleTokenOverlap: 1,
};

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[\s,·/()[\]]+/)
    .map((t) => t.replace(/[^0-9a-z가-힣]/g, ''))
    .filter((t) => t.length >= 2);
}

export function scoreRelated(target: PostMeta, candidate: PostMeta): RelatedSuggestion {
  const reasons: string[] = [];
  let score = 0;

  const sharedTags = candidate.tags.filter((t) => target.tags.includes(t));
  if (sharedTags.length > 0) {
    score += sharedTags.length * WEIGHT.sharedTag;
    reasons.push(`공통 태그 ${sharedTags.join(', ')}`);
  }

  if (candidate.category === target.category) {
    score += WEIGHT.sameCategory;
    reasons.push(`같은 카테고리(${candidate.category})`);
  }

  if (
    target.mainKeyword &&
    candidate.mainKeyword &&
    tokens(target.mainKeyword).some((t) => tokens(candidate.mainKeyword!).includes(t))
  ) {
    score += WEIGHT.keywordOverlap;
    reasons.push('메인 키워드 겹침');
  }

  const targetTokens = new Set(tokens(target.title));
  const overlap = tokens(candidate.title).filter((t) => targetTokens.has(t));
  if (overlap.length > 0) {
    score += Math.min(overlap.length, 3) * WEIGHT.titleTokenOverlap;
    reasons.push(`제목 공통어 ${overlap.slice(0, 3).join(', ')}`);
  }

  return {
    ...candidate,
    score,
    reasons,
    markdown: `[${candidate.title}](/posts/${candidate.slug})`,
  };
}

export function suggestRelated(
  target: PostMeta,
  all: PostMeta[],
  limit = 3,
): RelatedSuggestion[] {
  return all
    .filter((p) => p.slug !== target.slug)
    .map((p) => scoreRelated(target, p))
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score || (b.date || '').localeCompare(a.date || ''))
    .slice(0, limit);
}

/**
 * 아직 글이 없는 상태(신규 작성)에서 주제/키워드/태그만으로 후보를 뽑을 때 사용.
 */
export function suggestForDraft(
  draft: { title?: string; category: string; tags?: string[]; mainKeyword?: string },
  all: PostMeta[],
  limit = 3,
): RelatedSuggestion[] {
  return suggestRelated(
    {
      slug: '__draft__',
      title: draft.title || draft.mainKeyword || '',
      category: draft.category,
      tags: draft.tags || [],
      mainKeyword: draft.mainKeyword,
    },
    all,
    limit,
  );
}
