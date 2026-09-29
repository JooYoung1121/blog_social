/**
 * model.ts — Claude 모델 설정 단일 소스
 *
 * 모델 ID를 코드 여기저기 하드코딩하면 세대가 바뀔 때마다 누락이 생긴다.
 * (실제로 2026-08까지 generate-draft.ts / srv/admin/generate.ts 두 곳에
 *  claude-opus-4-7이 따로 박혀 있었음)
 *
 * 현행 세대: Claude Opus 5 — 1M 컨텍스트, $5 / $25 per MTok.
 * Opus 4.7과 가격·컨텍스트가 동일하므로 비용 증가 없이 세대만 올라간다.
 *
 * 주의: 모델 ID에 날짜 접미사를 붙이지 않는다. "claude-opus-5"가 완전한 ID다.
 */

/** 글 초안 생성 기본 모델 */
export const DRAFT_MODEL = 'claude-opus-5';

/**
 * 보조 작업용(요약·추출·분류처럼 판단 부담이 낮은 일).
 * 키워드 정리, FAQ 추출 같은 데 쓴다. $1 / $5 per MTok.
 */
export const UTILITY_MODEL = 'claude-haiku-4-5';

/**
 * 출력 토큰 상한.
 * 사진 29장짜리 글이 16000에 근접했던 사례가 있어 여유를 둔다.
 * 스트리밍이므로 HTTP 타임아웃 걱정은 없다.
 */
export const MAX_TOKENS = 32000;

/**
 * effort — thinking 깊이와 전체 토큰 지출을 함께 조절한다.
 * 사진이 많고 구조가 복잡한 글일수록 올린다.
 */
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export function effortFor(imageCount: number): Effort {
  return imageCount >= 20 ? 'xhigh' : 'high';
}

/**
 * 프롬프트 캐시 TTL.
 * 시스템 프롬프트는 2만 자가 넘어서 캐시 효과가 크다(읽기 ~0.1x 비용).
 * 기본 5분이지만, 한 세션에서 여러 편을 뽑거나 재생성을 반복할 땐 1시간이 낫다.
 */
export function cacheControl(longSession = false) {
  return longSession
    ? ({ type: 'ephemeral', ttl: '1h' } as const)
    : ({ type: 'ephemeral' } as const);
}
