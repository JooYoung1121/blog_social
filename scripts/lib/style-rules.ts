/**
 * style-rules.ts
 *
 * "지나의 휴일" 블로그 글쓰기 룰 단일 소스(SSOT).
 * 메모리(/Users/user/.ccs/.../memory/)에 누적된 룰을 코드 상수로 명시화.
 *
 * 사용처:
 *   1. AI 글 생성 시 시스템 프롬프트로 자동 주입 (buildSystemPrompt)
 *   2. 빌드/lint 시 본문 검증 (lintPost)
 *   3. CLI 템플릿(new-post.ts)이 인사말/마무리/카테고리 구조 참조
 *
 * 메모리 룰을 추가/수정할 때는 이 파일도 함께 업데이트할 것.
 */

// ──────────────────────────────────────────────
// 운영자 페르소나 (memory: user_blog_owner.md, user_has_dogs.md, user_formula_feeding.md)
// ──────────────────────────────────────────────
export const BLOG_OWNER = {
  blogName: '지나의 휴일',
  realName: '주영',
  childName: '봄이',
  childNickname: '김뽐이',
  location: '용인시 기흥구 죽전/보정동',
  feedingType: '분유 수유 중', // 모유수유 표현 절대 금지
  pets: {
    nani: '난이 — 폼피츠 약 5kg, 피부 약함, 양쪽 쓸개골 수술 완료. 급하면 눈을 감았다 떴다 반복.',
    seuli: '슬이 — 갈색 곱슬 소형견, 쓸개골 2기 관리 중. 입이 까다로움.',
  },
  naverBlog: 'https://blog.naver.com/snf00467',
  siteUrl: 'https://jinas-holiday.vercel.app',
  parentalLeave: '육아휴직 중 (2025.11.1~)',
} as const;

// ──────────────────────────────────────────────
// 인사말 / 마무리 (memory: project_blog_style_guide.md)
// ──────────────────────────────────────────────
export const INTRO = '안녕하세요!\n지나의 휴일 지나입니다 :)';
export const OUTRO =
  '오늘 포스팅은 여기서 마무리!\n궁금한 점은 댓글로 남겨주세요 😊\n그럼 안녕! 👋';

// ──────────────────────────────────────────────
// 글쓰기 톤 — "찐 엄마 톡" (memory: feedback_writing_tone.md, project_blog_style_guide.md)
// ──────────────────────────────────────────────
export const TONE_RULES = {
  endings: ['~거든요', '~더라구요', '~하더라고요', '~있잖아요', '~하쥬'],
  emphasis: ['진짜', '완전', '딱', '너무', '정말', '확실히', '바아아아로'],
  abbreviations: ['ㄱㄱㄱ', '찐', '맴찢', '가오리 웃음', '초보 맘', '뽕 뽑다'],
  emotions: ['😭', '😂', '🥹', 'ㅋㅋㅋ', 'ㅠㅠ', '👍', '❤️', 'ㅎㅎㅎ'],
  reader_engagement: ['~아시나요?', '~하셨나요?', '~해보세요!', '~추천드려요!'],
} as const;

// ──────────────────────────────────────────────
// 구매 형태 (협찬 vs 직구매 vs 무상제공 vs 체험단)
// ──────────────────────────────────────────────
export type PurchaseType =
  | 'self-purchased' // 직접 구매한 제품/서비스
  | 'sponsored' // 협찬 (원고료 + 제품, 가이드 있음)
  | 'gifted' // 무상 제공만 (가이드 없음)
  | 'service-experience'; // 음식점/시설 등 서비스 체험단

export const PURCHASE_TYPE_META: Record<
  PurchaseType,
  {
    label: string;
    allowPriceInfo: boolean; // 본문에 가격 표기 허용
    toneNote: string;
    guidePriority: boolean; // 체험단 가이드를 최우선 반영
  }
> = {
  'self-purchased': {
    label: '직접 구매',
    allowPriceInfo: false,
    toneNote:
      '솔직 후기, 단점도 가감없이. "당근에서 샀어요", "직접 구매했어요" 등 구매 경로는 자연스럽게 쓰되 금액은 본문에 쓰지 않음.',
    guidePriority: false,
  },
  sponsored: {
    label: '협찬 (원고료 포함)',
    allowPriceInfo: false,
    toneNote: '솔직하되 완곡하게. 가이드 키워드 필수. 본문에 협찬 언급 금지.',
    guidePriority: true,
  },
  gifted: {
    label: '무상 제공',
    allowPriceInfo: false,
    toneNote: '솔직 후기. 가이드 없으니 자유롭게 단점도 표현 OK.',
    guidePriority: false,
  },
  'service-experience': {
    label: '체험단 (서비스/장소)',
    allowPriceInfo: false,
    toneNote: '방문 경험 위주. 가이드 키워드 필수.',
    guidePriority: true,
  },
};

// ──────────────────────────────────────────────
// 절대 금지 패턴 — purchaseType별로 분기
// ──────────────────────────────────────────────
export function getForbiddenPatterns(
  purchaseType: PurchaseType = 'self-purchased',
): { pattern: RegExp; reason: string }[] {
  const patterns: { pattern: RegExp; reason: string }[] = [];

  // 가격 정보는 모든 타입에서 금지 (memory: feedback_no_sponsorship_no_specs.md)
  patterns.push({
    pattern: /[\d,]{3,}\s*원/,
    reason: `가격 정보 표기 금지 (purchaseType: ${purchaseType})`,
  });
  patterns.push({
    pattern: /\d+\s*만\s*원/,
    reason: `가격 정보 표기 금지 (purchaseType: ${purchaseType})`,
  });

  // 수량/사이즈는 모든 타입에서 금지 유지 (사용자 룰)
  patterns.push({ pattern: /\d+\s*개입/, reason: '수량 표기 금지' });
  patterns.push({ pattern: /\d+\s*mm/i, reason: '사이즈(mm) 표기 금지' });

  // 모유수유 금지 (memory: user_formula_feeding.md)
  patterns.push({
    pattern: /모유\s*수유/,
    reason: '분유 수유 중 — 모유수유 표현 금지',
  });
  patterns.push({
    pattern: /직수/,
    reason: '분유 수유 중 — 직수 표현 금지',
  });
  patterns.push({
    pattern: /젖(?!병|꼭지)/,
    reason: '분유 수유 중 — 젖 표현 금지 (젖병/젖꼭지는 OK)',
  });

  // AI 티 나는 필러 섹션 (memory: feedback_no_filler_sections.md)
  patterns.push({ pattern: /감성\s*한?\s*컷/, reason: '감성컷 섹션 금지 (AI 티)' });
  patterns.push({ pattern: /감성샷/, reason: '감성샷 섹션 금지 (AI 티)' });

  // AI 패턴 표현 (memory: feedback_writing_tone.md)
  patterns.push({
    pattern: /고민되시는\s*분들\s*많으시죠/,
    reason: 'AI식 일반적 도입 — 본인 구체 에피소드로 시작',
  });
  patterns.push({
    pattern: /도움이\s*됩니다\s*[.。]/,
    reason: 'AI식 설명체 금지 — "~해서 좋더라구요" 같은 구어체로',
  });
  patterns.push({
    pattern: /다양한\s*감각\s*자극/,
    reason: 'AI식 교과서 표현 — 봄이 반응 묘사로 대체',
  });

  return patterns;
}

/** @deprecated purchaseType 인자 없는 버전 — getForbiddenPatterns(purchaseType) 사용 권장 */
export const FORBIDDEN_PATTERNS = getForbiddenPatterns();

// ──────────────────────────────────────────────
// 분량 / 구조 룰 (memory: project_blog_style_guide.md, project_top_blogger_structure.md)
// ──────────────────────────────────────────────
export const STRUCTURE_RULES = {
  body_min_chars: 1500, // 공백 제외 (기본값 — 카테고리 차등은 BODY_CHARS_BY_CATEGORY)
  body_max_chars: 2000,
  main_keyword_count: { min: 5, max: 7 },
  subheadings: { min: 4, max: 6 },
  keyword_subheadings: { min: 2 },
  paragraph_max_lines: 3,
  consecutive_photos_max: 2, // 사진 3장 이상 연속 금지
  internal_links: { min: 2, max: 3 },
} as const;

// ──────────────────────────────────────────────
// 글자수 카테고리 차등 (2026 통합검색 대응)
//
// 근거: 2026년 네이버는 블로그·카페·웹을 한 영역에서 경쟁시키는 통합 랭킹으로
// 전환되며, 경쟁 키워드일수록 더 길고 구조화된 문서가 상위에 노출되는 경향이
// 보고됨 (업계 분석, 확정된 공식 수치 아님):
//   - 로카포스팅 "네이버 블로그 상위노출 체크리스트 2026"
//     https://locaposting.com/blog/naver-seo-checklist
//   - adsensefarm "네이버 블로그 검색 로직 변화 2026"
//     https://adsensefarm.kr/naver-blog-search-algorithm-2026-ai-strategy/
//
// 운영 판단: 경쟁이 치열한 리뷰/여행은 상향, 감성·일기형(홈피드)은 기존 유지.
// target === 'homefeed'면 감성 흐름 우선이라 길이를 강제하지 않고 기본값으로 둠.
// ──────────────────────────────────────────────
export const BODY_CHARS_BY_CATEGORY: Record<
  string,
  { min: number; max: number }
> = {
  'baby-products': { min: 2000, max: 2500 }, // 경쟁 키워드 多
  travel: { min: 2000, max: 2500 },
  food: { min: 1700, max: 2200 },
  parenting: { min: 1500, max: 2000 }, // 일기형 — 기존 유지
  'daily-life': { min: 1500, max: 2000 },
};

/**
 * 카테고리·타깃별 본문 글자수 권장 범위.
 * homefeed 타깃은 감성/스토리 우선이라 기본값(1500~2000)을 쓴다.
 */
export function getBodyCharRange(
  category?: string,
  target?: 'search' | 'homefeed' | 'both',
): { min: number; max: number } {
  if (target === 'homefeed') {
    return {
      min: STRUCTURE_RULES.body_min_chars,
      max: STRUCTURE_RULES.body_max_chars,
    };
  }
  return (
    (category && BODY_CHARS_BY_CATEGORY[category]) || {
      min: STRUCTURE_RULES.body_min_chars,
      max: STRUCTURE_RULES.body_max_chars,
    }
  );
}

// ──────────────────────────────────────────────
// AI 친화 레이어 — Phase 1 (docs/ai-friendly-guide.md)
// target === 'search' | 'info' 일 때만 활성. homefeed에선 비활성(감성 흐름 우선).
// 현재는 buildSystemPrompt 권장사항으로만 사용. lint 검사는 추후 Phase 3에서 도입 검토.
// ──────────────────────────────────────────────
export const AI_FRIENDLY_RULES = {
  enabled_targets: ['search', 'info', 'both'] as const,
  tldr: {
    required: false, // Phase 1에선 권장만
    bullets: { min: 2, max: 4 },
    one_liner_max_chars: 80,
  },
  faq: {
    required: false, // Phase 1에선 권장만
    count: { min: 3, max: 5 },
    answer_chars: { min: 30, max: 80 },
    heading_exception: true, // 명사형 소제목 금지 룰의 예외 (FAQ 섹션 H2 1개)
  },
  description_chars: { min: 80, max: 150 }, // frontmatter description
  alt_chars: { min: 50, max: 125 }, // 이미지 alt 풀어쓰기
} as const;

// ──────────────────────────────────────────────
// 사진 보정 톤 (memory: feedback_photo_tone.md)
// iPhone 편집 기준 -100~+100 스케일
// ──────────────────────────────────────────────
export const PHOTO_TONE = {
  exposure: 17,
  brilliance: 35,
  highlights: -25,
  shadows: 35,
  contrast: -25,
  brightness: 10,
  warmth: 10,
  tint: 12,
  reference: '@haedal_home (인스타) — 밝고 화사하면서 따뜻한 톤',
} as const;

// ──────────────────────────────────────────────
// 사진 처리 룰
// ──────────────────────────────────────────────
export const PHOTO_RULES = {
  skip_video: true, // MP4 등 영상 파일 자체는 본문에 임베드하지 않음 (사용자가 네이버에서 직접 주입)
  use_all_photos: true, // 제공 사진 전부 사용 (memory: feedback_use_all_photos.md)
  preserve_order: true, // 원본 파일 순서 유지 (memory: feedback_photo_order.md)
  consecutive_max: 2,
  must_have_text_after: true, // 사진 뒤에 반드시 텍스트
  // 영상 삽입 마커 (2026 DIA 영상 가점 대응)
  // MP4는 여전히 스킵하지만, 영상이 어울리는 지점에 아래 HTML 주석 마커를 남겨
  // 네이버 업로드 모드(/naver/[slug]) 페이지가 "🎬 여기 영상 삽입"으로 안내한다.
  // 마커는 웹 렌더링에는 보이지 않음(HTML 주석). 예: <!-- video: 봄이 반응 영상 -->
  video_marker: '<!-- video: {설명} -->',
} as const;

// ──────────────────────────────────────────────
// 저자 전문성 / 출처 신호 (2026 통합 랭킹 신뢰도 대응)
//
// 근거: 2026 네이버는 AI로 출처 신뢰도(공신력·전문성·실제 경험·출처 투명성)를
// 판별해 통합 랭킹에 반영한다고 안내 (네이버 공식 방향).
//   - The Egg "How Naver AI search is reshaping the Korean digital landscape"
//     https://www.theegg.com/ko/insights/how-naver-ai-search-is-reshaping-the-korean-digital-landscape/
//   - adsensefarm 2026 검색 로직 변화 (위 링크)
// AI가 "실제 경험"을 높게 평가하므로 구체적 경험 신호가 핵심.
//
// 우리 룰과의 충돌 주의: "구체적 금액/수량"은 신뢰 신호이지만, 본 블로그는
// 가격·수량·사이즈 본문 표기를 금지(getForbiddenPatterns)하므로 금액은 쓰지 않는다.
// 대신 날짜·기간·사용 횟수·과정 같은 비(非)가격 경험 신호로 대체한다.
// ──────────────────────────────────────────────
export const AUTHORITY_SIGNALS = {
  // 본문에 자연스럽게 녹일 경험 신호 (가격/수량 제외)
  experience_signals: [
    '사용 기간·시점 ("2주 정도 써보니", "한 달 가까이")',
    '구체적 상황·과정 ("새벽 수유 끝나고", "외출할 때마다")',
    '봄이의 실제 반응·변화 (전/후 비교)',
    '반복 사용으로 알게 된 디테일 (꿀팁 섹션)',
  ],
  // 외부 공식 출처 링크 — 본문 1~2개 권장 (협찬 표현과 무관, 정보 신뢰도용)
  external_sources: {
    recommended: { min: 1, max: 2 },
    examples: [
      '브랜드 공식몰/공식 제품 페이지 (productLink)',
      '공공·공식 정보 페이지 (성분·안전 기준 등)',
    ],
    note: '협찬/제공 표현은 본문에 쓰지 않되, 정보 출처 링크는 신뢰 신호로 허용',
  },
} as const;

// ──────────────────────────────────────────────
// 2026 하반기 네이버 변화 대응 (AI 브리핑 인용 / 메이트 / 클립)
//
// 타임라인 (확인된 사실):
//   - 2026-04-30 연관검색어 서비스 종료 (20년 만에 폐지)
//   - 2026-04    AI 브리핑 이용자 3,000만 돌파, 전체 검색 쿼리 약 20% 처리
//   - 2026-06-04 "네이버 메이트" 베타 시작 — 선정 핵심 지표가 **AI 브리핑 인용수**
//                (인용수는 2026-01부터 누적 집계, 크리에이터 어드바이저에서 확인)
//   - 2026-06-26 AI탭(대화형 검색) 출시 — 쇼핑·플레이스·예약까지 한 흐름으로 연결
//   출처:
//     - 코드잇 "2026년 확 바뀐 네이버 알고리즘"
//       https://sprint.codeit.kr/blog/naver-blog-algorithm-change-ai-briefing-clip-mate
//     - SEO NEWS "네이버, AI 브리핑 인용 창작자에 최대 1천만 원 지원"
//       https://seonews.co.kr/naver-mate-ai-briefing-citation/
//
// 운영 판단(추론): 목표 지표가 "검색 상위노출/클릭률" 단독에서
// "홈피드 노출 + AI 인용 + 체류시간"으로 넓어졌다. 인용되려면 AI가 잘라 쓰기 좋은
// **질문 → 자기완결 답변** 덩어리가 본문에 있어야 한다.
// ──────────────────────────────────────────────
export const AI_BRIEFING_RULES = {
  /** 소제목(질문) 바로 아래 첫 문단은 그 질문의 답을 그 문단만 읽어도 알 수 있게 쓴다 */
  self_contained_answer: {
    enabled: true,
    sentences: { min: 2, max: 3 },
    note:
      '대명사("이건", "그게")로 시작하지 말고 주어(제품명/상황)를 문단 안에 한 번 더 명시 — RAG 청크 단위로 잘려도 의미가 유지되도록',
  },
  /** 최신성 신호 — AI는 "언제 기준 정보인지"가 명시된 문서를 선호 */
  recency_signal: {
    recommended: true,
    examples: ['"2026년 8월 기준으로는~"', '"○주 정도 써본 시점 기준"'],
  },
  /** 인용 측정 지표 (수동 확인) */
  metrics: [
    '크리에이터 어드바이저 → AI 브리핑 인용수 (2026-01부터 누적)',
    '메인 키워드 검색 시 AI 브리핑 출처 카드에 내 글이 뜨는지',
    'AI탭에서 같은 질문 시 인용 여부',
  ],
} as const;

/**
 * 클립(숏폼) 연계 — 2026 블로그 글에 클립을 직접 삽입할 수 있고,
 * 영상 포함 문서에 검색·홈피드 가점이 보고됨(업계 분석, 공식 수치 아님).
 * 우리 파이프라인은 MP4를 임베드하지 않으므로 "마커"만 남기고 네이버에서 직접 삽입한다.
 */
export const CLIP_RULES = {
  recommended_per_post: { min: 1, max: 2 },
  marker: PHOTO_RULES.video_marker,
  note:
    '제품 사용 시연·아이 반응처럼 움직임이 정보가 되는 지점에 마커. 네이버 업로드 시 클립 또는 동영상으로 삽입',
} as const;

/**
 * 발행 리듬 — AI 대량생산 저품질 글에 대한 제재가 강화되는 흐름.
 * (뉴스버스 탐사보도: 하루 100건 자동 발행 블로그 → 네이버 제재 강화 방침
 *  https://www.newsverse.kr/news/articleView.html?idxno=9959)
 * 우리는 소량·고품질이므로 문제 없지만, 자동화를 붙일 때 이 상한을 넘기지 않는다.
 */
export const PUBLISHING_RHYTHM = {
  per_day_max: 2,
  per_week_recommended: { min: 2, max: 4 },
  min_interval_minutes: 60,
  note: '같은 키워드/구조의 글을 연속 발행하지 않기 — 유사문서 판정 위험',
} as const;

// ──────────────────────────────────────────────
// 발행 룰
// ──────────────────────────────────────────────
export const PUBLISHING_RULES = {
  draft: false, // 새 글 바로 발행 (memory: feedback_draft_false.md)
  generate_naver_guide: false, // 정적 export(generate-naver.ts) X. 네이버 업로드는 라이브 페이지 /naver/[slug] 사용

  auto_commit_push: true, // 작업 후 자동 커밋+푸시 (memory: feedback_auto_commit_push.md)
  client_guide_priority: true, // 체험단 가이드 > SEO 룰 (memory: feedback_client_guide_priority.md)
} as const;

// ──────────────────────────────────────────────
// 스토리텔링 구조 (memory: project_blog_style_guide.md)
// ──────────────────────────────────────────────
export const STORY_STRUCTURE = {
  review: [
    '1. 공감 도입 (내 고민/문제, 구체적 에피소드)',
    '2. 계기 (누군가의 추천/검색/우연한 발견)',
    '3. 이 제품을 선택한 이유 (2~3가지)',
    '4. 실사용 경험 (기능별로 사진+짧은 텍스트 반복)',
    '5. 꿀팁/노하우 (필수)',
    '6. 총평/추천 (누구에게 좋은지)',
  ],
  info: [
    '1. 이걸 왜 정리하게 됐는지 (내 실수/경험)',
    '2. Step by step 가이드',
    '3. 핵심 정보 표로 정리',
    '4. 주의점/팁',
  ],
} as const;

// ──────────────────────────────────────────────
// 소제목 패턴 (서술형/감정형 — 명사형 금지)
// ──────────────────────────────────────────────
export const SUBHEADING_PATTERNS = {
  good_examples: [
    "제가 왜 이걸 샀냐고요? (고민의 시작)",
    '사용 추천 꿀팁!! :: 헤드쪽 솜을 2/3 정도 빼주세요!',
    '가장 좋은 건 변비&녹변이 사라졌어요!',
    '27일 신생아인데 써도 될까요? 고민의 시작',
    '앱솔루트 명작 vs 아이엠마더 비교 결과!',
  ],
  bad_examples: ['## 성분', '## 디자인', '## 결론', '## 실제 사용 후기'],
} as const;

// ──────────────────────────────────────────────
// 홈피드 vs 검색 상위노출 (memory: project_homefeed_strategy.md)
// ──────────────────────────────────────────────
export const HOMEFEED_VS_SEARCH = {
  search_optimized: {
    title_pattern: 'OO 추천, OO 후기 (가격/위치 정리)',
    style: '정보형, 단답형, 정리형',
    kpi: '키워드 밀도, 구조화, 내부 링크',
  },
  homefeed_optimized: {
    title_pattern: 'OO 갔는데... 친구들이 미쳤대요ㅋㅋ 후기 갑니다',
    style: '이야기형, 감성형, 일기형',
    kpi: '체류시간, CTR, 댓글/공감',
    rules: [
      '첫 3줄에 공감/질문/반전/감성 담기',
      '제목과 본문 일치 (낚시 X)',
      '사람 말투처럼 일기 형식',
    ],
  },
} as const;

// ──────────────────────────────────────────────
// 카테고리 메타데이터
// ──────────────────────────────────────────────
export const CATEGORY_META: Record<
  string,
  { label: string; description: string }
> = {
  'baby-products': {
    label: '육아용품 리뷰',
    description: '봄이가 직접 쓴 솔직한 후기. 협찬과 직구매 모두.',
  },
  parenting: {
    label: '육아일기',
    description: '봄이의 성장 일기, 초보 엄마의 진심 공유.',
  },
  'daily-life': {
    label: '일상',
    description: '용인 죽전 일상, 정보 공유, 출산휴가 가이드 등.',
  },
  food: {
    label: '맛집/요리',
    description: '아이와 함께 가는 맛집, 집밥 레시피.',
  },
  travel: {
    label: '여행/나들이',
    description: '아기와 함께한 나들이, 키즈 카페, 여행 후기.',
  },
};

// ──────────────────────────────────────────────
// AI 시스템 프롬프트 빌더
// ──────────────────────────────────────────────
export interface PromptOptions {
  category: string;
  purchaseType?: PurchaseType;
  intent?: 'review' | 'compare' | 'info' | 'location' | 'diary';
  target?: 'search' | 'homefeed' | 'both';
  productName?: string;
  mainKeyword?: string;
  subKeywords?: string[];
  notes?: string;
  clientGuide?: string; // 체험단 가이드 (최우선 반영, purchaseType 가이드 있을 때)
}

export function buildSystemPrompt(opts: PromptOptions): string {
  const {
    category,
    purchaseType = 'self-purchased',
    intent = 'review',
    target = 'search',
    productName,
    mainKeyword,
    subKeywords,
    notes,
    clientGuide,
  } = opts;

  const purchaseMeta = PURCHASE_TYPE_META[purchaseType];
  const forbiddenPatterns = getForbiddenPatterns(purchaseType);

  const targetRules =
    target === 'homefeed'
      ? HOMEFEED_VS_SEARCH.homefeed_optimized
      : HOMEFEED_VS_SEARCH.search_optimized;

  const structureFlow =
    intent === 'info' ? STORY_STRUCTURE.info : STORY_STRUCTURE.review;

  const categoryDesc = CATEGORY_META[category]?.description || '';
  const bodyRange = getBodyCharRange(category, target);

  return [
    `당신은 "${BLOG_OWNER.blogName}" 블로그(${BLOG_OWNER.naverBlog})의 글을 ${BLOG_OWNER.realName}님 톤으로 작성하는 어시스턴트입니다.`,
    '',
    '# 페르소나',
    `- 블로그 운영자: ${BLOG_OWNER.realName}님 (육아맘, 아이 ${BLOG_OWNER.childName} 한 명, ${BLOG_OWNER.location} 거주)`,
    `- ${BLOG_OWNER.feedingType} (모유수유 표현 절대 금지)`,
    `- 반려견: ${BLOG_OWNER.pets.nani} / ${BLOG_OWNER.pets.seuli}`,
    '',
    '# 글쓰기 톤 (찐 엄마 톡)',
    `- 끝맺음: ${TONE_RULES.endings.join(', ')}`,
    `- 강조: ${TONE_RULES.emphasis.join(', ')}`,
    `- 감정 표현 적극 (이모지 자연스럽게: ${TONE_RULES.emotions.join(' ')})`,
    `- 독자에게 말 걸기: ${TONE_RULES.reader_engagement.join(', ')}`,
    `- 문단 1~${STRUCTURE_RULES.paragraph_max_lines}줄 짧게 끊고 빈 줄 자주`,
    '- AI 티 나는 깔끔한 문장 ❌, 구어체 자연스러움 ✅',
    '',
    `# 구매 형태: ${purchaseMeta.label} (${purchaseType})`,
    `- ${purchaseMeta.toneNote}`,
    '- 가격 표기 금지 (직구매 포함, 수량/사이즈도 본문에 X)',
    purchaseMeta.guidePriority
      ? '- ⚠️ 체험단 가이드가 있으면 위 모든 룰보다 가이드가 최우선'
      : '',
    '',
    '# 인사말 / 마무리 (정확히 이 문구 사용)',
    `인사: ${INTRO}`,
    `마무리: ${OUTRO}`,
    '',
    '# 절대 금지',
    ...forbiddenPatterns.map((p) => `- ${p.reason}`),
    '- 협찬/제공 표현은 고객 가이드나 법정 고지로 요구된 상단 1회만 허용. 그 외 본문 반복 언급 금지',
    '- "감성 한 컷", "감성샷" 같은 의미 없는 사진 나열 섹션',
    '- 명사형 소제목 ("성분", "디자인", "결론" 등)',
    '',
    '# 사진 배치',
    `- 사진 ${PHOTO_RULES.consecutive_max}장까지만 연속 (3장 이상 금지)`,
    `- 사진 뒤에 반드시 텍스트 1~${STRUCTURE_RULES.paragraph_max_lines}줄`,
    '- 제공된 사진은 영상(MP4) 제외 전부 사용, 원본 순서 유지',
    `- 영상이 어울리는 핵심 장면(반응/사용 시연 등)에 영상 삽입 마커 \`${PHOTO_RULES.video_marker}\`를 ${CLIP_RULES.recommended_per_post.min}~${CLIP_RULES.recommended_per_post.max}개 남김 (MP4는 임베드하지 않음 — 네이버 업로드 시 클립/동영상으로 직접 삽입, 영상 포함 글에 가점)`,
    '',
    '# 소제목',
    '- 인용블록(>) 또는 H2 사용',
    '- 서술형 / 감정형 / 질문형 (명사형 금지)',
    `- ${STRUCTURE_RULES.subheadings.min}~${STRUCTURE_RULES.subheadings.max}개`,
    mainKeyword
      ? `- 첫 소제목 또는 두 번째 소제목에 메인 키워드 "${mainKeyword}"를 자연스럽게 1회 포함`
      : '- 첫 소제목 또는 두 번째 소제목에 메인 키워드를 자연스럽게 1회 포함',
    `- 전체 소제목 중 최소 ${STRUCTURE_RULES.keyword_subheadings.min}개는 메인/서브 키워드, 브랜드명, 제품명 중 하나를 자연스럽게 포함`,
    '- 각 소제목은 검색자가 궁금해할 한 가지 상황/질문에 답하는 문장으로 작성',
    '- 모든 소제목에 같은 키워드를 반복하지 않기 (키워드 스터핑 금지)',
    '- 좋은 예: ' + SUBHEADING_PATTERNS.good_examples.slice(0, 2).join(' / '),
    '',
    '# 글 구조',
    ...structureFlow,
    '',
    '# 분량 (검색 상위노출 기준 — 2026 통합검색 카테고리 차등)',
    `- 본문 ${bodyRange.min}~${bodyRange.max}자 (공백 제외, 카테고리 "${category}"${target === 'homefeed' ? ' · 홈피드' : ''} 기준)`,
    mainKeyword
      ? `- 메인 키워드 "${mainKeyword}" ${STRUCTURE_RULES.main_keyword_count.min}~${STRUCTURE_RULES.main_keyword_count.max}회 자연 반복`
      : `- 메인 키워드 ${STRUCTURE_RULES.main_keyword_count.min}~${STRUCTURE_RULES.main_keyword_count.max}회 자연 반복`,
    subKeywords && subKeywords.length > 0
      ? `- 서브 키워드 (자연스럽게 1~2회씩): ${subKeywords.join(', ')}`
      : '',
    `- 내부 링크 ${STRUCTURE_RULES.internal_links.min}~${STRUCTURE_RULES.internal_links.max}개`,
    '',
    '# 저자 전문성 / 출처 신호 (2026 통합 랭킹 신뢰도)',
    '- AI가 "실제 경험"을 높게 평가하므로 일반론 대신 구체적 경험 신호를 녹임:',
    ...AUTHORITY_SIGNALS.experience_signals.map((s) => `  - ${s}`),
    '- 단, 가격/수량/사이즈는 본문 금지 — 금액 대신 날짜·기간·과정·반응으로 신뢰도를 만든다',
    `- 신뢰 가능한 외부 공식 출처 링크 ${AUTHORITY_SIGNALS.external_sources.recommended.min}~${AUTHORITY_SIGNALS.external_sources.recommended.max}개를 자연스럽게 (${AUTHORITY_SIGNALS.external_sources.note})`,
    '',
    // 2026 하반기: AI 브리핑 인용수가 노출·보상(네이버 메이트)의 핵심 지표가 됨
    target !== 'homefeed'
      ? [
          '# AI 브리핑 인용 최적화 (2026 하반기 — 가장 중요)',
          `- 소제목(질문) 바로 다음 문단은 그 질문의 답만 읽어도 이해되게 ${AI_BRIEFING_RULES.self_contained_answer.sentences.min}~${AI_BRIEFING_RULES.self_contained_answer.sentences.max}문장으로 먼저 결론을 준다`,
          `- ${AI_BRIEFING_RULES.self_contained_answer.note}`,
          `- 최신성 신호를 1회 정도 자연스럽게: ${AI_BRIEFING_RULES.recency_signal.examples.join(' / ')}`,
          '- 일반론 요약(어디서나 볼 수 있는 설명)은 넣지 않는다. AI가 못 만드는 건 "직접 겪은 것"뿐',
        ].join('\n')
      : '',
    '',
    `# 타겟: ${target}`,
    `- ${targetRules.style}`,
    `- KPI: ${targetRules.kpi}`,
    target === 'homefeed' && 'rules' in targetRules
      ? targetRules.rules.map((r) => `- ${r}`).join('\n')
      : '',
    '',
    // AI 친화 레이어 — Phase 1 (docs/ai-friendly-guide.md)
    // homefeed 타깃은 비활성 (감성/스토리 흐름 우선). 그 외 타깃에서만 권장.
    target !== 'homefeed'
      ? [
          '# AI 친화 레이어 (선택 권장 — Phase 1)',
          '네이버 AI 탭 / GPT / Gemini / Perplexity 같은 AI 검색이 우리 글을 인용하기 쉽도록 다음 두 블록을 본문에 덧붙임. 본문 톤은 위 룰 그대로 유지.',
          '',
          '## 1) TL;DR 박스 — 인사말 직후 위치',
          '- 인사말 → 빈 줄 → 인용블록(>) 안에 한 줄 요약 + bullet',
          `- 한 줄 요약 ${AI_FRIENDLY_RULES.tldr.one_liner_max_chars}자 이내, bullet ${AI_FRIENDLY_RULES.tldr.bullets.min}~${AI_FRIENDLY_RULES.tldr.bullets.max}개`,
          '- 형식:',
          '  > **한 줄 요약**: <핵심 결론 한 문장>',
          '  > - <포인트 1 (사실 위주)>',
          '  > - <포인트 2>',
          '  > - <포인트 3>',
          '- 톤: bullet은 짧은 사실문 OK, 한 줄 요약은 본문 구어체와 자연스럽게 어울리게',
          '',
          '## 2) FAQ 섹션 — 마무리 인사 직전 위치',
          `- "## 자주 묻는 질문 정리해드려요" H2 1개 + Q&A ${AI_FRIENDLY_RULES.faq.count.min}~${AI_FRIENDLY_RULES.faq.count.max}개`,
          '- 형식:',
          '  ## 자주 묻는 질문 정리해드려요',
          '  > **Q. <질문>**',
          `  > <답변 — 구어체 유지, ${AI_FRIENDLY_RULES.faq.answer_chars.min}~${AI_FRIENDLY_RULES.faq.answer_chars.max}자>`,
          '- 답변은 반드시 구어체 ("~했어요", "~더라구요"). AI 정답체("~합니다", "~을 권장합니다") 금지',
          '- 이 H2 헤딩 1개는 "명사형 소제목 금지" 룰의 예외 (위 형식 그대로 사용)',
          `- 본문 일반 소제목을 1개 줄여서 전체 소제목 수 ${STRUCTURE_RULES.subheadings.min}~${STRUCTURE_RULES.subheadings.max}개 룰 유지`,
          '',
          '## 분량 / 우선순위',
          `- TL;DR + FAQ 추가로 길어지면 본문 줄여서 ${bodyRange.min}~${bodyRange.max}자 유지`,
          '- 체험단 가이드(client-guide.md)와 충돌 시 가이드가 우선 — AI 친화 레이어는 항상 양보',
          '- getForbiddenPatterns 룰(가격/협찬/모유수유/필러 등) 위반은 절대 X',
        ].join('\n')
      : '# AI 친화 레이어 (비활성)\n- 홈피드 타깃 글이므로 TL;DR/FAQ 추가하지 않음. 첫 3줄 감성 후킹 + 일기 흐름 우선.',
    '',
    `# 카테고리: ${category} (${categoryDesc})`,
    productName ? `# 제품/장소: ${productName}` : '',
    notes ? `# 추가 메모 (사용자가 적어준 핵심 포인트)\n${notes}` : '',
    clientGuide && purchaseMeta.guidePriority
      ? `# 체험단 가이드 (최우선 반영 — 위 룰과 충돌 시 가이드 우선)\n${clientGuide}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ──────────────────────────────────────────────
// 본문 lint (빌드/CI 시 검증)
// ──────────────────────────────────────────────
export interface LintIssue {
  level: 'error' | 'warning';
  code: string;
  message: string;
}

export interface LintOptions {
  mainKeyword?: string;
  purchaseType?: PurchaseType;
  category?: string; // 글자수 카테고리 차등 (BODY_CHARS_BY_CATEGORY)
  target?: 'search' | 'homefeed' | 'both';
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function lintPostBody(
  body: string,
  optsOrKeyword?: LintOptions | string,
): LintIssue[] {
  // 호환성: 이전 시그니처 lintPostBody(body, mainKeyword) 도 지원
  const opts: LintOptions =
    typeof optsOrKeyword === 'string'
      ? { mainKeyword: optsOrKeyword }
      : optsOrKeyword || {};

  const { mainKeyword, purchaseType = 'self-purchased', category, target } =
    opts;
  const bodyRange = getBodyCharRange(category, target);

  const issues: LintIssue[] = [];
  const forbiddenPatterns = getForbiddenPatterns(purchaseType);

  // frontmatter 분리
  const bodyOnly = body.replace(/^---[\s\S]*?---\s*/m, '').trim();

  // 0. 협찬/제공 표현은 고객 가이드나 법정 고지로 요구된 상단 1회만 허용
  const canHaveDisclosure = purchaseType !== 'self-purchased';
  const disclosurePattern = /제품을\s*무상으로\s*제공\s*받았음/;
  const disclosureMatch = bodyOnly.match(disclosurePattern);
  const disclosureInHeader =
    !!disclosureMatch && bodyOnly.indexOf(disclosureMatch[0]) <= 120;
  const bodyWithoutAllowedDisclosure =
    canHaveDisclosure && disclosureInHeader
      ? bodyOnly.replace(disclosurePattern, '')
      : bodyOnly;

  if (/협찬\s*받|제공\s*받/.test(bodyWithoutAllowedDisclosure)) {
    issues.push({
      level: 'error',
      code: 'sponsorship-disclosure',
      message:
        '협찬/제공 표현은 고객 가이드나 법정 고지로 요구된 상단 1회만 허용',
    });
  }
  if (!canHaveDisclosure && disclosureMatch) {
    issues.push({
      level: 'error',
      code: 'sponsorship-disclosure',
      message: '직접 구매 글에는 무상 제공 고지 문구를 넣지 않음',
    });
  }

  // 1. 금지 패턴 (purchaseType별 분기)
  for (const { pattern, reason } of forbiddenPatterns) {
    if (pattern.test(bodyOnly)) {
      issues.push({
        level: 'error',
        code: 'forbidden-pattern',
        message: `${reason} (정규식: ${pattern.source})`,
      });
    }
  }

  // 2. 글자수
  const charCount = bodyOnly.replace(/!\[.*?\]\(.*?\)/g, '').replace(/\s/g, '')
    .length;
  if (charCount < bodyRange.min) {
    issues.push({
      level: 'warning',
      code: 'too-short',
      message: `본문 ${charCount}자 (이미지 제외, 공백 제외) — 최소 ${bodyRange.min}자 권장${category ? ` (카테고리 ${category})` : ''}`,
    });
  }
  if (charCount > bodyRange.max) {
    issues.push({
      level: 'warning',
      code: 'too-long',
      message: `본문 ${charCount}자 — 권장 ${bodyRange.max}자 이내${category ? ` (카테고리 ${category})` : ''}`,
    });
  }

  // 3. 사진 연속 검사
  const lines = bodyOnly.split('\n');
  let consecutivePhotos = 0;
  for (const line of lines) {
    if (/!\[.*?\]\(.*?\)/.test(line)) {
      consecutivePhotos++;
      if (consecutivePhotos > STRUCTURE_RULES.consecutive_photos_max) {
        issues.push({
          level: 'warning',
          code: 'photos-consecutive',
          message: `사진 ${consecutivePhotos}장 연속 — 최대 ${STRUCTURE_RULES.consecutive_photos_max}장까지`,
        });
        break; // 한 번만 보고
      }
    } else if (line.trim() && !line.startsWith('<!--')) {
      consecutivePhotos = 0;
    }
  }

  // 4. 인사말/마무리
  if (!bodyOnly.includes('지나의 휴일')) {
    issues.push({
      level: 'warning',
      code: 'no-intro',
      message: '"지나의 휴일" 인사말이 본문에 없음',
    });
  }
  if (
    !bodyOnly.includes('오늘 포스팅은 여기서 마무리') &&
    !bodyOnly.includes('그럼 안녕')
  ) {
    issues.push({
      level: 'warning',
      code: 'no-outro',
      message: '마무리 멘트가 없음',
    });
  }

  // 5. 메인 키워드 빈도
  if (mainKeyword) {
    const matches = bodyOnly.match(new RegExp(mainKeyword, 'g'));
    const count = matches?.length || 0;
    const { min, max } = STRUCTURE_RULES.main_keyword_count;
    if (count < min) {
      issues.push({
        level: 'warning',
        code: 'keyword-low',
        message: `메인 키워드 "${mainKeyword}" ${count}회 — 권장 ${min}~${max}회`,
      });
    } else if (count > max) {
      issues.push({
        level: 'warning',
        code: 'keyword-high',
        message: `메인 키워드 "${mainKeyword}" ${count}회 — 권장 ${min}~${max}회 (과도하면 키워드 스터핑)`,
      });
    }
  }

  // 6. 소제목 개수
  //    인용블록은 "연속된 > 줄 = 하나"로 묶어서 센다. (줄 단위로 세면
  //    TL;DR 박스나 FAQ Q&A가 소제목 수십 개로 잡힘)
  //    TL;DR / FAQ 블록 자체는 소제목이 아니므로 제외.
  const subheadingTexts: string[] = [];
  let quoteBuf: string[] = [];

  const pushQuote = () => {
    if (quoteBuf.length === 0) return;
    const text = quoteBuf.join(' ').trim();
    quoteBuf = [];
    const isAiFriendlyBlock =
      /한\s*줄\s*요약/.test(text) || /^\*{0,2}Q[.．]/.test(text);
    if (text && !isAiFriendlyBlock) subheadingTexts.push(text);
  };

  for (const line of bodyOnly.split('\n')) {
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      quoteBuf.push(quote[1]);
      continue;
    }
    pushQuote();
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) subheadingTexts.push(heading[1].trim());
  }
  pushQuote();

  // FAQ 섹션 H2는 명사형 금지 룰의 예외이자 소제목 카운트에서도 제외
  const faqHeadingIdx = subheadingTexts.findIndex((h) => /자주\s*묻는\s*질문/.test(h));
  if (faqHeadingIdx >= 0) subheadingTexts.splice(faqHeadingIdx, 1);

  const totalSubheadings = subheadingTexts.length;
  if (
    totalSubheadings < STRUCTURE_RULES.subheadings.min ||
    totalSubheadings > STRUCTURE_RULES.subheadings.max
  ) {
    issues.push({
      level: 'warning',
      code: 'subheading-count',
      message: `소제목(##/인용) ${totalSubheadings}개 — 권장 ${STRUCTURE_RULES.subheadings.min}~${STRUCTURE_RULES.subheadings.max}개`,
    });
  }

  // 7. 검색 의도형 소제목에 메인 키워드가 최소 1회 들어갔는지 확인
  if (mainKeyword && subheadingTexts.length > 0) {
    const keywordPattern = new RegExp(escapeRegExp(mainKeyword));
    const keywordSubheadingCount = subheadingTexts.filter((heading) =>
      keywordPattern.test(heading),
    ).length;

    if (keywordSubheadingCount < 1) {
      issues.push({
        level: 'warning',
        code: 'subheading-keyword-missing',
        message: `소제목에 메인 키워드 "${mainKeyword}"가 없음 — 첫/두 번째 소제목에 자연스럽게 1회 포함 권장`,
      });
    }
  }

  // 8. 명사형 소제목 검출
  //    부분일치로 보면 "## 성분 꼼꼼히 따져봤어요" 같은 정상 소제목까지 걸리므로
  //    소제목 전체가 명사형과 정확히 같을 때만 에러.
  const badHeadings = new Set(
    SUBHEADING_PATTERNS.bad_examples.map((b) => b.replace(/^##\s*/, '').trim()),
  );
  for (const heading of subheadingTexts) {
    if (badHeadings.has(heading)) {
      issues.push({
        level: 'error',
        code: 'noun-subheading',
        message: `명사형 소제목 발견: "${heading}" — 서술형/감정형으로 변경`,
      });
    }
  }

  // ── 9~12. 2026 하반기 룰 (AI 브리핑 인용 / 클립 / 링크)
  // homefeed 타깃은 감성 흐름 우선이라 검사에서 제외
  if (target !== 'homefeed') {
    // 9. TL;DR 박스 (인사말 직후 한 줄 요약)
    if (!/한\s*줄\s*요약/.test(bodyOnly)) {
      issues.push({
        level: 'warning',
        code: 'no-tldr',
        message:
          'TL;DR(한 줄 요약) 블록이 없음 — AI 브리핑 인용 확률을 높이려면 인사말 직후 권장',
      });
    }

    // 10. FAQ 섹션
    if (!/자주\s*묻는\s*질문/.test(bodyOnly)) {
      issues.push({
        level: 'warning',
        code: 'no-faq',
        message:
          'FAQ 섹션이 없음 — 질문/답변 덩어리가 AI 인용에 가장 잘 잡힘 (마무리 인사 직전 권장)',
      });
    }

    // 11. 영상/클립 마커
    const videoMarkers = bodyOnly.match(/<!--\s*video:/gi) || [];
    if (videoMarkers.length < CLIP_RULES.recommended_per_post.min) {
      issues.push({
        level: 'warning',
        code: 'no-video-marker',
        message: `영상(클립) 삽입 마커가 ${videoMarkers.length}개 — ${CLIP_RULES.recommended_per_post.min}~${CLIP_RULES.recommended_per_post.max}개 권장 (영상 포함 문서 가점)`,
      });
    }
  }

  // 12. 링크 — 내부(2~3개) / 외부 공식 출처(1~2개)
  const links = [...bodyOnly.matchAll(/\[[^\]]+\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g)]
    .map((m) => m[1]);
  const internalLinks = links.filter(
    (href) => href.startsWith('/') || href.includes('jinas-holiday'),
  );
  const externalLinks = links.filter((href) => !internalLinks.includes(href));

  if (internalLinks.length < STRUCTURE_RULES.internal_links.min) {
    issues.push({
      level: 'warning',
      code: 'internal-links-low',
      message: `내부 링크 ${internalLinks.length}개 — 권장 ${STRUCTURE_RULES.internal_links.min}~${STRUCTURE_RULES.internal_links.max}개`,
    });
  }
  if (externalLinks.length < AUTHORITY_SIGNALS.external_sources.recommended.min) {
    issues.push({
      level: 'warning',
      code: 'external-source-missing',
      message:
        '외부 공식 출처 링크가 없음 — 신뢰도(공식성) 신호로 1~2개 권장 (브랜드 공식몰/공식 정보 페이지)',
    });
  }

  return issues;
}
