/**
 * naver-api.ts — 네이버 공개 API 클라이언트
 *
 * 두 개의 서로 다른 API를 쓴다 (인증 방식도 다름):
 *
 *  1) 검색광고 API (searchad.naver.com) — 연관키워드 + 월간검색수 + 경쟁정도
 *     인증: HMAC-SHA256 서명 (timestamp + METHOD + URI)
 *     발급: 검색광고 광고주센터 → 도구 → API 사용 관리
 *     문서: https://github.com/naver/searchad-apidoc
 *     ※ 2026-04-30 연관검색어 서비스가 종료되면서, 프로그램으로 키워드를
 *        확장할 수 있는 사실상 유일한 공식 경로가 됐다.
 *
 *  2) 검색 오픈 API (openapi.naver.com) — 블로그 검색 결과 총 문서수
 *     인증: Client ID / Secret 헤더
 *     발급: https://developers.naver.com/apps
 *     용도: 키워드별 경쟁 문서수 → 기회점수 계산
 *
 * 시크릿은 .env 에만 둔다 (.gitignore 확인됨). 절대 커밋하지 않는다.
 */
import crypto from 'crypto';

const AD_BASE = 'https://api.searchad.naver.com';
const OPENAPI_BASE = 'https://openapi.naver.com';

export interface KeywordStat {
  keyword: string;
  /** 월간 검색수 — PC */
  pcSearches: number;
  /** 월간 검색수 — 모바일 */
  mobileSearches: number;
  /** PC + 모바일 */
  totalSearches: number;
  /** 경쟁정도: 낮음 | 중간 | 높음 */
  competition: string;
  /** 월평균 노출 광고수 */
  adDepth: number;
}

/** 검색광고 API는 "10 미만"을 문자열 "< 10"으로 준다 */
function toCount(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    if (v.includes('<')) return 5; // "< 10" → 보수적으로 5
    const n = parseInt(v.replace(/[^0-9]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function adSignature(
  timestamp: string,
  method: string,
  uri: string,
  secretKey: string,
): string {
  const message = `${timestamp}.${method}.${uri}`;
  return crypto.createHmac('sha256', secretKey).update(message).digest('base64');
}

export function hasAdCredentials(): boolean {
  return Boolean(
    process.env.NAVER_AD_CUSTOMER_ID &&
      process.env.NAVER_AD_API_KEY &&
      process.env.NAVER_AD_SECRET_KEY,
  );
}

export function hasOpenApiCredentials(): boolean {
  return Boolean(
    process.env.NAVER_OPENAPI_CLIENT_ID &&
      process.env.NAVER_OPENAPI_CLIENT_SECRET,
  );
}

/**
 * 연관키워드 조회.
 * hintKeywords 는 최대 5개까지, 공백 없이(네이버 규칙) 보낸다.
 */
export async function fetchRelatedKeywords(
  hints: string[],
): Promise<KeywordStat[]> {
  if (!hasAdCredentials()) {
    throw new Error(
      'NAVER_AD_CUSTOMER_ID / NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY 가 .env 에 없습니다.\n' +
        '   발급: 네이버 검색광고 광고주센터 → 도구 → API 사용 관리',
    );
  }

  const uri = '/keywordstool';
  const timestamp = Date.now().toString();
  const signature = adSignature(
    timestamp,
    'GET',
    uri,
    process.env.NAVER_AD_SECRET_KEY!,
  );

  // 네이버 규칙: hintKeywords 는 공백을 제거해서 보낸다
  const params = new URLSearchParams({
    hintKeywords: hints.map((h) => h.replace(/\s+/g, '')).slice(0, 5).join(','),
    showDetail: '1',
  });

  const res = await fetch(`${AD_BASE}${uri}?${params}`, {
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': process.env.NAVER_AD_API_KEY!,
      'X-Customer': process.env.NAVER_AD_CUSTOMER_ID!,
      'X-Signature': signature,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`검색광고 API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    keywordList?: Record<string, unknown>[];
  };

  return (json.keywordList ?? []).map((k) => {
    const pc = toCount(k.monthlyPcQcCnt);
    const mo = toCount(k.monthlyMobileQcCnt);
    return {
      keyword: String(k.relKeyword ?? ''),
      pcSearches: pc,
      mobileSearches: mo,
      totalSearches: pc + mo,
      competition: String(k.compIdx ?? '-'),
      adDepth: toCount(k.plAvgDepth),
    };
  });
}

/** 해당 키워드로 이미 존재하는 블로그 문서수 (= 경쟁 강도) */
export async function fetchBlogDocCount(keyword: string): Promise<number> {
  if (!hasOpenApiCredentials()) {
    throw new Error(
      'NAVER_OPENAPI_CLIENT_ID / NAVER_OPENAPI_CLIENT_SECRET 가 .env 에 없습니다.\n' +
        '   발급: https://developers.naver.com/apps',
    );
  }

  const params = new URLSearchParams({ query: keyword, display: '1' });
  const res = await fetch(`${OPENAPI_BASE}/v1/search/blog.json?${params}`, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_OPENAPI_CLIENT_ID!,
      'X-Naver-Client-Secret': process.env.NAVER_OPENAPI_CLIENT_SECRET!,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`오픈 API ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { total?: number };
  return json.total ?? 0;
}

/** 상위 노출 중인 블로그 글 제목 (차별화 포인트 파악용) */
export async function fetchTopBlogTitles(
  keyword: string,
  count = 5,
): Promise<{ title: string; link: string; description: string }[]> {
  const params = new URLSearchParams({
    query: keyword,
    display: String(count),
    sort: 'sim',
  });
  const res = await fetch(`${OPENAPI_BASE}/v1/search/blog.json?${params}`, {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_OPENAPI_CLIENT_ID!,
      'X-Naver-Client-Secret': process.env.NAVER_OPENAPI_CLIENT_SECRET!,
    },
  });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    items?: { title: string; link: string; description: string }[];
  };
  const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ');
  return (json.items ?? []).map((i) => ({
    title: strip(i.title),
    link: i.link,
    description: strip(i.description),
  }));
}
