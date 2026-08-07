# AI 친화 글쓰기 가이드 — "지나의 휴일"

> [`docs/blog-writing-guide.md`](blog-writing-guide.md)(찐 엄마 톡 + 검색 상위노출용)과 [`docs/homefeed-strategy.md`](homefeed-strategy.md)(감성/스토리 홈피드용)와 **공존**하는 가이드입니다.
> 둘 중 무엇도 대체하지 않습니다. 본문은 기존 룰대로 쓰되, 그 위에 "AI가 인용하기 좋은 레이어" 4종(TL;DR, 표, FAQ, 엔티티 명시)을 덧붙이는 게 핵심입니다.
> 단일 소스 코드 룰은 `scripts/lib/style-rules.ts`. 본 문서는 코드 통합 권장사항만 7번 섹션에 기록하며, 실제 코드 수정은 메인 컨텍스트에서 진행합니다.

---

## 0. 왜 필요한가

### 0.1 검색 환경이 바뀌었다

2025~2026년 사이 한국 검색 환경이 결정적으로 변했습니다.

- **네이버**: 2025년 3월 AI 브리핑을 통합검색에 정식 출시했고, 2026년 상반기 별도 **AI 탭**을 통합·뉴스·쇼핑 옆에 배치했습니다. 동시에 실험실 형태였던 Cue:와 Clova X는 2026년 4월 9일자로 종료 (출처: [한국정경신문 2026-02-24](https://kpenews.com/View.aspx?No=3982878), [ZDNet Korea 2026-02-25](https://zdnet.co.kr/view/?no=20260225180559), [옵티플로우 블로그 2026-03-13](https://optiflow.kr/blog/%EB%84%A4%EC%9D%B4%EB%B2%84-%EC%A0%84%EB%9E%B5-%EB%8C%80%EC%A0%84%ED%99%98-ai-%EA%B2%80%EC%83%89-%ED%86%B5%ED%95%A9-%ED%81%B4%EB%A1%9C%EB%B0%94x%ED%81%90-%EC%A2%85%EB%A3%8C%EC%99%80-ai-%EB%B8%8C%EB%A6%AC%ED%95%91ai-%ED%83%AD-206)).
- **글로벌**: Gartner는 2026년까지 상업 웹사이트의 organic 검색 트래픽이 25% 감소할 것으로 전망. 사용자가 ChatGPT, Perplexity, Gemini, Copilot으로 이동하기 때문 (출처: [Frase.io GEO 2026 Guide](https://www.frase.io/blog/what-is-generative-engine-optimization-geo)).
- **공통 메커니즘**: 위 AI들은 모두 **RAG(Retrieval-Augmented Generation)** 방식 — 사용자 질문이 들어오면 웹/내부 인덱스에서 관련 문서를 검색해 청크 단위로 가져오고, 그 청크를 LLM 컨텍스트에 넣어 답변을 만듭니다 (출처: [LLMrefs AEO Guide](https://llmrefs.com/answer-engine-optimization)).

### 0.2 기존 톤은 "사람"한테 좋지만 "RAG 청크"엔 노이즈

`docs/blog-writing-guide.md`의 찐 엄마 톡 — 짧은 문단, 감정 표현, 구어체 — 은 사람의 체류시간을 늘리고 네이버 홈피드 알고리즘에 강합니다 (홈피드 전략 문서 참고). 하지만 RAG 청크화 관점에서는 다음 약점이 있어요.

- 핵심 사실(브랜드명, 인증, 효과)이 감정 묘사 사이에 흩어져 있어 추출 난이도가 높음.
- 구어체 끝맺음("~거든요")이 LLM이 "정의/사실 문장"으로 인식하기 어려움.
- 숫자·스펙·가격을 본문에 안 쓰는 우리 룰 때문에 "객관 정보 밀도"가 자체적으로 낮음.

→ **결론**: 본문 톤은 그대로 두고, **AI가 추출하기 쉬운 영역(TL;DR / 표 / FAQ / 엔티티)을 명시적으로 추가**해서 공존시킵니다. 두 레이어를 한 글에 같이 두는 게 답입니다.

### 0.3 두 레이어 공존 모델

```
┌─────────────────────────────────────────┐
│ 본문 (찐 엄마 톡 + 홈피드 감성)          │ ← 사람이 읽고 머무르고 공감
│  - 인사말, 에피소드, 사진+짧은 텍스트    │
│  - 1500~2000자, 메인 키워드 5~7회       │
└─────────────────────────────────────────┘
       +
┌─────────────────────────────────────────┐
│ AI 친화 레이어 (객관 정보 밀집)          │ ← LLM이 청크로 가져가기 쉬움
│  - TL;DR (3~5줄)                        │
│  - 사실/스펙 표 (필요 시)                │
│  - FAQ 섹션 (3~5개)                     │
│  - 엔티티 풀어쓰기                      │
└─────────────────────────────────────────┘
       +
┌─────────────────────────────────────────┐
│ 메타 레이어 (구조화 데이터)              │ ← 머신리더블 강한 신호
│  - frontmatter 확장 필드                │
│  - JSON-LD (Article/FAQPage/Product)    │
│  - meta description / og:description    │
│  - 이미지 alt                           │
└─────────────────────────────────────────┘
```

---

## 1. AI 친화 레이어 — 본문에 추가할 4가지

### 1.1 TL;DR 박스 (인사말 직후 3~5줄)

**무엇**: 글의 결론을 한 줄로 요약한 뒤, 핵심 근거 2~4줄을 bullet로.
**위치**: 인사말 ("안녕하세요! 지나의 휴일 지나입니다 :)") 바로 다음, 본격 도입 에피소드 직전.
**길이**: 40~80자 한 줄(요약) + bullet 2~4개 (각 30자 이내).

**왜 효과적인가** (근거)
- AI는 "정의된 주제 범위(defined topic scope)"가 글 상단에 명시된 콘텐츠를 선호. TL;DR을 상단에 두면 LLM이 이걸 그대로 추출 후보로 삼음 (출처: [Averi.ai LLM-Optimized Content Structures](https://www.averi.ai/how-to/llm%E2%80%91optimized-content-structures-tables-faqs-snippets)).
- "Lead with the answer" 원칙: 첫 30~60단어 안에 답을 두면 RAG 청크가 그 자리를 가져갈 가능성이 큼 (출처: [LLMrefs AEO](https://llmrefs.com/answer-engine-optimization)).
- 통계(추론 아님): 명확한 포맷팅 요소가 있는 콘텐츠는 그렇지 않은 콘텐츠 대비 인용률이 28~40% 더 높음 (출처: [Averi.ai 2026 Definitive Guide](https://www.averi.ai/breakdowns/the-definitive-guide-to-llm-optimized-content)).

**예시**

```markdown
안녕하세요! 지나의 휴일 지나입니다 :)

> **한 줄 요약**: 신생아 태열 케어로 러베 수딩젤로션 2주 사용해보니, 흡수가 빠르고 촉촉함이 오래가서 자기 전 루틴이 줄었어요.
> - 흡수: 5초 안에 끈적임 사라짐
> - 향: 무향에 가까운 약한 라벤더
> - 사용 시점: 신생아 14일째부터, 하루 2회

(이후 본문은 평소처럼 에피소드부터 시작)
```

**기존 룰과 공존**
- 본문 1500~2000자 카운트에 TL;DR도 포함 (분리 안 함). 분량 룰은 그대로.
- 인용 블록(`>`) 또는 별도 박스 컴포넌트로 시각적으로 분리해 본문 흐름을 끊지 않음.
- 톤은 유지 — "한 줄 요약" 같은 건조한 헤딩은 OK지만 bullet 안 문장은 평소 톤.

---

### 1.2 사실/스펙 표 (본문 중간, 1개 권장)

**무엇**: 제품 정식명, 브랜드, 인증, 사용 시점 등 객관 정보를 표 형식으로 정리.
**위치**: 본문의 "이 제품을 선택한 이유" 또는 "실사용 경험" 섹션 사이. 보통 글 중반.
**금지**: 가격, 수량, 사이즈(mm)는 절대 표에도 쓰지 않음 (`AGENTS.md` Hard Rule + `style-rules.ts` getForbiddenPatterns).

**왜 효과적인가**
- LLM은 표 형식을 "구조화된 사실"로 인식해 추출 우선순위가 높음. Microsoft Copilot은 표/리스트 포맷팅을 우선 처리하도록 설계됨 (출처: [Frase.io GEO 2026 Guide](https://www.frase.io/blog/what-is-generative-engine-optimization-geo) 플랫폼별 전략).
- Schema markup 없이도 표는 머신리더블 신호로 작동 (출처: [Search Engine Land — schema markup AI search](https://searchengineland.com/schema-markup-ai-search-no-hype-472339)).

**예시 (육아용품 리뷰)**

```markdown
| 항목 | 내용 |
|---|---|
| 정식명 | 러베(Rubeb) 수딩젤로션 |
| 카테고리 | 신생아 태열·진정 보습 |
| 인증 | EWG 그린 등급, 알레르기 검증 완료 |
| 사용 시점 | 신생아 14일 이후 (저희 봄이 기준) |
| 향 | 무향 (약한 라벤더 base note) |
```

**기존 룰과 공존**
- 표는 "감성컷 필러 섹션"이 아니라 **객관 정보 압축**이므로 `AGENTS.md` 금지 룰 위반 아님.
- 표 직후 평소 톤("저희는 14일째부터 발랐는데, 봄이가 안 보채더라구요!")으로 자연스럽게 본문 복귀.
- 협찬 제품에도 동일 적용 — 표에 협찬/제공 표기 절대 금지 (`getForbiddenPatterns` 정규식 그대로 작동).

---

### 1.3 FAQ 섹션 (마무리 인사 직전)

**무엇**: 독자가 실제로 궁금해할 질문 3~5개 + 답변 각 40~60자.
**위치**: 마무리 인사("오늘 포스팅은 여기서 마무리...") **직전**.
**형식**: 인용 블록 또는 H3 (`### Q. 신생아 며칠부터 발라도 되나요?`).

**왜 효과적인가** (강한 근거)
- 2025년 Relixir 조사 50개 사이트 분석: **FAQPage 스키마가 있는 페이지 인용률 41% vs 없는 페이지 15%, 약 2.7배 차이** (출처: [Averi.ai LLM-Optimized Content Structures](https://www.averi.ai/how-to/llm%E2%80%91optimized-content-structures-tables-faqs-snippets) 인용).
- 명확한 질문-답변 구조는 인용 가능성을 40% 끌어올림 (같은 출처).
- FAQ 형태가 사용자의 실제 LLM 프롬프트 패턴과 일치 → AI가 "이 질문에 대한 답이 여기 있다"고 정확히 매칭.
- 질문은 H2/H3으로, 답은 첫 줄에 핵심 결론, 이후 1~2문장 부연이 최적 (출처: [LLMrefs AEO Guide](https://llmrefs.com/answer-engine-optimization)).

**예시**

```markdown
## 자주 묻는 질문 정리해드려요

> **Q. 신생아 며칠부터 발라도 되나요?**
> 저희 봄이는 14일차부터 발랐어요. 제품 자체는 신생아용으로 인증이 있어서 출생 직후도 가능하지만, 저는 산후도우미 이모님 추천에 따라 2주 뒤부터 시작했어요.

> **Q. 다른 보습제랑 같이 써도 되나요?**
> 저는 아침엔 베이비오일, 자기 전엔 이 수딩젤로션만 써요. 두 개 겹쳐 바르면 끈적여서 봄이가 짜증을 내더라고요 ㅠㅠ

> **Q. 향이 강한가요?**
> 거의 무향에 가깝고 라벤더가 살짝 나는 정도예요. 신생아 코에 부담 없는 수준.
```

**왜 인용 블록 형식인가**
- 우리 톤(`docs/blog-writing-guide.md` 4번)은 인용 블록을 소제목으로 자주 씀 → 시각적 일관성.
- LLM은 마크다운 인용 블록을 "강조된 답변"으로 인식하는 경향 (추론, 일부 GEO 가이드들이 권장 — 직접 측정된 수치는 못 찾음).

**기존 룰과 공존**
- FAQ 답변은 **구어체 유지** — "발랐어요", "써요", "짜증을 내더라고요". AI식 정답체("~합니다", "~을 권장합니다") 절대 금지.
- 마무리 인사 직전 위치이므로 본문 흐름을 깨지 않고, 오히려 "글을 잘 정리했다"는 인상을 줌.
- 소제목 카운트에 FAQ 섹션 헤딩 1개가 포함됨. `STRUCTURE_RULES.subheadings` 4~6개 룰을 위반하지 않도록 본문 소제목을 1개 줄여서 균형.

---

### 1.4 엔티티 명시 — 정식명·인증명 풀어쓰기

**무엇**: 약어·줄임말로 쓰던 브랜드/제품/인증을 본문에 **최소 1회 풀네임**으로 등장시킨다.

**왜 효과적인가**
- LLM은 "엔티티"를 인식하고 그래프로 저장 — 명확한 사실 문장에서 엔티티 관계를 뽑아냄. 모호하게 쓰면 LLM이 "이 글이 어떤 브랜드/제품을 말하는지 확신 못 함" → 인용에서 탈락 (출처: [Waikay LLM Entities](https://waikay.io/how-to-turn-llm-noise-into-brand-strategy-using-entities-and-citations/), [Search Engine Land schema markup](https://searchengineland.com/schema-markup-ai-search-no-hype-472339)).
- 브랜드 mention vs citation: AI 검색에서 mention 자체가 "엔티티 정체성"을 강화하는 신호. 최소 1회 풀네임이 그 신호 (출처: [Wellows brand mentions vs citation](https://wellows.com/blog/brand-mentions-vs-citation/)).

**규칙**

| 분류 | 본문 첫 등장 시 | 이후 등장 시 |
|---|---|---|
| 제품명 | "러베(Rubeb) 수딩젤로션" | "수딩젤로션" 또는 "러베" |
| 브랜드 | "마베비(Mabebi)" | "마베비" |
| 인증 | "EWG 그린 등급(Skin Deep 0~2)" | "EWG 그린" |
| 카테고리 용어 | "신생아 태열(Infant Heat Rash)" | "태열" |

**예시**
- ❌ "이거 진짜 좋아요!" (LLM이 어떤 제품인지 모름)
- ✅ "러베(Rubeb) 수딩젤로션 진짜 좋더라구요!" (엔티티 명확 + 우리 톤 유지)

**기존 룰과 공존**
- 한국어 풀네임 + 영문 보조 표기는 우리 평소 톤에서도 자연스러움 ("앱솔루트 명작 vs 아이엠마더" 같은 비교 표현 이미 사용 중 — `style-rules.ts` SUBHEADING_PATTERNS).
- 본문에 영문 표기가 너무 많아지면 톤이 딱딱해질 수 있으므로 **첫 1회만** 풀네임. 그 후엔 한국어 약식.
- 메인 키워드는 5~7회 룰 그대로 유지. 풀네임은 그 카운트에 포함.

---

## 2. 메타데이터 / 구조화 데이터

### 2.1 frontmatter 확장 필드 (제안)

기존 frontmatter(`title`, `description`, `tags`, `date`, `category`, `draft`, `sponsored`, `sponsorInfo`)에 다음 필드 **추가 제안**:

```yaml
# 기존 필드 ...
title: "신생아 태열 잡은 러베 수딩젤로션 후기"
description: "신생아 14일차부터 2주 사용한 러베 수딩젤로션 솔직 후기. 흡수, 향, 봄이 반응까지."
tags: ["신생아태열", "수딩젤로션", "육아용품"]

# AI 친화 레이어 추가 필드 (제안)
tldr: "신생아 태열 케어로 러베 수딩젤로션 2주 써보니 흡수 빠르고 촉촉함 오래가서 자기 전 루틴이 줄었어요"
brand: "러베 (Rubeb)"
product: "러베 수딩젤로션"
certifications: ["EWG 그린 등급", "알레르기 검증"]
faq:
  - q: "신생아 며칠부터 발라도 되나요?"
    a: "저희 봄이는 14일차부터 발랐어요. 제품은 신생아용 인증이 있어서 출생 직후도 가능."
  - q: "다른 보습제랑 같이 써도 되나요?"
    a: "겹쳐 바르면 끈적여서 한 가지만 추천드려요."
entities:
  brand: "러베"
  product: "러베 수딩젤로션"
  category: "신생아 보습 케어"
```

이 필드는 **선택적**(optional)이며, 없는 글은 기존처럼 빌드. 있을 때만 JSON-LD가 자동 출력되도록 빌드 파이프라인에 통합.

### 2.2 JSON-LD 자동 출력 (Astro 패턴)

`src/layouts/PostLayout.astro`에 `<script type="application/ld+json">` 블록을 frontmatter 데이터로 채워서 출력.

**기본 패턴** (출처: [johndalesandro.com Astro JSON-LD 가이드](https://johndalesandro.com/blog/astro-add-json-ld-structured-data-to-your-website-for-rich-search-results/), [Schema Pilot JSON-LD 2026 Guide](https://www.schemapilot.app/blog/json-ld-guide/)):

```astro
---
const { post } = Astro.props;
const fm = post.data;

const graph = [
  {
    "@type": "Article",
    "@id": `${siteUrl}${post.slug}#article`,
    "headline": fm.title,
    "description": fm.description,
    "datePublished": fm.date,
    "author": { "@type": "Person", "name": "지나" },
    "image": fm.coverImage,
  },
];

if (fm.faq) {
  graph.push({
    "@type": "FAQPage",
    "mainEntity": fm.faq.map((item) => ({
      "@type": "Question",
      "name": item.q,
      "acceptedAnswer": { "@type": "Answer", "text": item.a },
    })),
  });
}

if (fm.brand && fm.product) {
  graph.push({
    "@type": "Product",
    "name": fm.product,
    "brand": { "@type": "Brand", "name": fm.brand },
    "review": {
      "@type": "Review",
      "author": { "@type": "Person", "name": "지나" },
      "reviewBody": fm.tldr,
    },
  });
}

const jsonLd = { "@context": "https://schema.org", "@graph": graph };
---
<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

**핵심 원칙** (출처: [Schema Pilot 2026](https://www.schemapilot.app/blog/json-ld-guide/), [Google FAQPage 가이드](https://developers.google.com/search/docs/appearance/structured-data/faqpage)):
- **하나의 페이지 = 하나의 primary entity** (블로그 글은 Article, 제품 리뷰면 Product 보조).
- **시각적으로 보이는 내용과 일치** — JSON-LD에 적은 FAQ는 본문에도 보여야 함. 불일치는 manual action 위험.
- **stable @id** — `siteUrl + slug + #fragment` 형태로 안정적인 식별자.

### 2.3 description / og:description 작성 룰

**왜 중요한가** (근거)
- meta description은 AI 답변 엔진(ChatGPT search, Perplexity, AI Overviews)이 페이지 미리보기·인용 시 그대로 가져가는 "신뢰된 요약" (출처: [wearekemb.com — Future of Meta Descriptions](https://wearekemb.com/en/the-future-of-on-page-seo-meta-descriptions-in-a-world-of-ai-search-summary-how-meta-descriptions-are-changing-in-ai/)).
- 첫 문장이 검색 의도에 직접 답하면 AI가 그 문장을 그대로 요약에 끌어다 씀 (같은 출처).

**한 문장 공식**: `[누가] + [무엇을] + [어떻게/얼마나] + [결과]`

| 잘못된 예 | 좋은 예 |
|---|---|
| "신생아 보습제 후기예요!" | "신생아 14일차 봄이가 2주 동안 러베 수딩젤로션을 사용한 솔직 후기 — 흡수, 향, 자기 전 루틴 변화까지." |
| "맛집 다녀왔어요" | "용인 죽전 보정동 한식 맛집 'OO' 가족 점심 — 6개월 봄이 동반 가능, 룸 좌석, 메뉴별 짠맛 후기." |

**길이**: 80~150자. 너무 짧으면 정보량 부족, 길면 AI가 잘라먹음.

**og:description은 동일 또는 더 짧은 버전** — Open Graph는 SNS 공유 미리보기용이라 1줄 길이 제한이 더 빡빡함.

### 2.4 이미지 alt 작성 룰

**왜 중요한가** (강한 근거)
- WebAIM Million 2026 보고서: 전체 사이트 53.1%가 alt 누락. 채우는 것만으로 차별화 (출처: [Alt Audit 2026 Guide](https://altaudit.com/blog/ai-alt-text-generation-guide-trends-seo-2026)).
- **alt는 이미지 GEO(Generative Engine Optimization)의 가장 큰 레버**. 멀티모달 LLM이 이미지를 직접 보긴 하지만, 기본 검색·인용 단계에서는 텍스트 컨텍스트(=alt)가 여전히 결정적 (출처: [AltText.ai 2026 Image SEO](https://alttext.ai/blog/geo-tags-image-seo-best-practices-ai-platforms)).
- 2025~2026 트렌드: "이미지에 무엇이 있나"가 아니라 **"이 이미지가 이 페이지에서 왜 중요한가"**를 alt에 담는 게 핵심 (같은 출처).

**alt 작성 공식**
```
[주체] + [상황/맥락] + [이 페이지에서의 역할]
```

| 잘못된 예 | 좋은 예 |
|---|---|
| `alt="아기 사진"` | `alt="14일차 봄이가 러베 수딩젤로션 바른 직후 — 흡수 5초 후 손으로 만져본 모습"` |
| `alt="제품 패키지"` | `alt="러베 수딩젤로션 본품 패키지 — EWG 그린 등급 표기와 무향 라벨 확인"` |

**글자수**: 50~125자. 너무 짧으면 컨텍스트 부족, 너무 길면 스크린리더가 끊음.
**금지**: "image1.jpg", "사진", "감성컷" 같은 정보 0의 alt.

---

## 3. 본문 구조 룰 (RAG 청크 친화)

### 3.1 단락 첫 줄 = 주제문 원칙

**룰**: 각 단락의 **첫 줄에 그 단락의 결론**을 둔다. 부연·감정 묘사·이모지는 그 다음 줄.

**근거**
- RAG 청크는 보통 400~512 토큰 단위로 잘림 (10~20% 오버랩, 출처: [Firecrawl 2026 chunking](https://www.firecrawl.dev/blog/best-chunking-strategies-rag), Chroma 연구 인용). 한 단락이 한 청크에 들어가는 경우가 많고, 청크 시작 부분의 정보가 임베딩에서 가장 강하게 반영됨.
- "Lead with the answer" 원칙 — 첫 30~60단어 안에 답을 둬야 RAG 검색이 잘 매칭 (출처: [LLMrefs AEO](https://llmrefs.com/answer-engine-optimization)).

**예시**

```markdown
❌ 약함:
저희 봄이가 14일차쯤 됐을 때 갑자기 얼굴이 빨개지는 거예요 ㅠㅠ
처음엔 뭔가 했는데 알고 보니 신생아 태열이었어요. 그래서 러베 수딩젤로션을 발랐어요.
효과가 좋더라구요!

✅ 강함:
**러베 수딩젤로션은 신생아 태열에 흡수 빠른 보습제로 효과 있었어요.**
저희 봄이가 14일차에 얼굴 빨개져서 산후도우미 이모님 추천으로 발랐는데, 5초 안에 끈적임이 사라지고 자기 전 루틴이 한 단계 줄었거든요!
```

→ 첫 줄은 사실문, 두 번째 줄은 평소 톤. 둘 다 우리 글에 자연스럽게 녹아듦.

### 3.2 H2/H3 헤딩 명시 (인용블록과 병행)

기존 룰: 인용 블록(`>`) 또는 H2를 소제목으로 사용 (`docs/blog-writing-guide.md` 4번).

**AI 친화 추가 룰**:
- **FAQ 섹션은 반드시 H2** (`## 자주 묻는 질문` 또는 `## 정리해드릴게요`) — FAQPage 스키마와 매칭.
- TL;DR도 H2 헤딩(`## 한 줄 요약`)을 두면 청크 경계가 명확해짐 (선택).
- 표 직전엔 짧은 H3 또는 인용 블록 1줄로 "이건 객관 정보다"를 표시.

**근거**: RAG 청크화 도구(MarkdownTextSplitter 등)는 헤딩을 청크 경계로 우선 인식 (출처: [Weaviate chunking guide](https://weaviate.io/blog/chunking-strategies-for-rag), [NVIDIA developer chunking](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)). 헤딩이 명확하면 한 청크 = 한 주제로 깔끔히 잘림.

### 3.3 객관 사실 vs 주관 경험 분리 표기 (선택)

본문에서 객관 사실과 주관 경험이 섞여 있을 때, **사실은 표/TL;DR/인용블록에 몰아두고**, 본문 흐름은 주관 경험 위주로.

이 분리만으로 LLM이 "이건 사실, 이건 후기"를 명확히 구분 → 인용 시 정확도 ↑ (추론, 직접 측정 자료 못 찾음. GEO 가이드들이 일반 권고).

### 3.4 한 단락 = 한 정보 단위

기존 룰(1~2줄 짧은 문단)이 이미 RAG 친화적. 추가로:
- **한 단락에 정보 두 개 섞지 않기**: "흡수도 빠르고 향도 좋아요"보다 "흡수가 빠르더라구요" / 빈 줄 / "향도 부담 없어요"로 분리.
- 이유: RAG 검색이 임베딩 기반이라 "한 청크 = 한 의미"여야 매칭 정확도가 높음 (출처: [Unstructured.io chunking best practices](https://unstructured.io/blog/chunking-for-rag-best-practices)).

---

## 4. 기존 룰과의 공존 표 (충돌 해소)

| 기존 룰 (`blog-writing-guide.md`) | AI 친화 룰 | 결합 방법 |
|---|---|---|
| 1~2줄 짧은 문단 + 빈 줄 | 단락 첫 줄 = 주제문 | 짧은 문단을 유지하되 첫 줄에 결론. 두 번째 줄은 평소 감성/구어체. |
| 명사형 소제목 금지, 서술/감정형 권장 | FAQ 섹션은 질문형 H2 권장 | FAQ 섹션 1개만 예외. 다른 소제목은 기존 룰대로 서술/감정형. |
| AI식 깔끔한 설명체 금지 | TL;DR 한 줄 요약은 사실문 톤 OK | TL;DR은 "박스" 안 정보로 인식되므로 본문 톤과 다른 게 자연스러움. bullet 안 텍스트는 평소 톤으로. |
| 본문에 가격/수량/사이즈 금지 | 표에 객관 정보 정리 | 표에도 가격/수량/사이즈 절대 금지. `getForbiddenPatterns` 그대로 작동. |
| 본문에 협찬/제공받음 표기 금지 | JSON-LD에 sponsorship 표기? | **JSON-LD에도 표기 안 함**. 본문 룰과 동일하게 frontmatter `sponsored`는 빌드 메타에만 사용. 단 법정 고지 상단 1회 허용은 동일. |
| 본문 1500~2000자 (공백 제외) | TL;DR + FAQ 추가로 분량 ↑ | 분량 카운트에 모두 포함. 본문 줄여서 균형. 또는 max를 2200까지 일시 허용 (운영자 판단). |
| 메인 키워드 5~7회 | 엔티티 풀네임 1회 추가 | 풀네임도 메인 키워드 카운트에 포함. 약식 표기(러베 수딩젤로션 → 수딩젤로션)도 전부 카운트. |
| 소제목 4~6개 | FAQ 섹션 헤딩 1개 추가 | 본문 일반 소제목을 1개 줄여서 총 5~6개 유지. 또는 max를 7로 일시 허용. |
| 사진 연속 최대 2장 | (변경 없음) | 그대로. AI 친화 레이어와 무관. |
| 홈피드용 글 = 감성/스토리 우선 | TL;DR/FAQ는 검색용 글에 우선 적용 | **홈피드 전용 글에는 TL;DR/FAQ 생략 가능**. 홈피드 알고리즘은 본문 흐름 더 중요. 검색용·정보형 글에 우선 도입. |

### 충돌 우선순위 (Hard)
1. 체험단/협찬 가이드 — 항상 1순위 (`AGENTS.md`).
2. `style-rules.ts` getForbiddenPatterns (가격/수량/모유수유/필러 섹션 등) — 항상 2순위.
3. AI 친화 레이어 — 위 두 룰을 위반하지 않는 한도에서 적용.

---

## 5. 한국어 AI 검색 특수성 (네이버 AI 탭 / AI 브리핑)

### 5.1 변화의 핵심

- **2025년 3월**: 네이버 AI 브리핑 정식 출시. 통합검색 최상단에 AI 요약 노출.
- **2025년 내 목표**: AI 브리핑 노출 비율 전체 검색의 20%까지 (출처: [리드젠랩 GEO 실험실](https://blog.lead-gen.team/naver-ai-briefing-seo-optimal-strategy)).
- **2026년 상반기**: AI 탭 정식 출시. 통합·뉴스·쇼핑과 같은 레벨의 별도 탭. 대화형 인터페이스, 후속 질문 지원, 예약·구매까지 (출처: [한국정경신문 2026-02-24](https://kpenews.com/View.aspx?No=3982878)).
- **2026년 4월 9일**: Cue:, Clova X 종료. 통합검색의 AI 탭으로 일원화.
- **2026년 4월 30일**: 연관검색어 서비스 종료(20년 만). 키워드 확장 도구가 하나 사라짐 — 대신 AI 브리핑/AI탭이 "질문 확장"을 담당.
- **2026년 4월**: AI 브리핑 이용자 3,000만 돌파, 전체 검색 쿼리의 약 20% 처리. **답변 출처의 약 70%가 블로그·카페 등 UGC**, 특히 여행·반려동물 같은 직접 경험 정보의 인용률이 높음.
- **2026년 6월 4일**: **네이버 메이트 베타** 시작. 창작자 선정의 핵심 지표가 **AI 브리핑 인용수**(2026년 1월부터 누적 집계). 월 30만 원 지원(약 3,000명) ~ 최상위 월 1,000만 원, 연 200억 규모.
- **2026년 6월 26일**: **AI탭** 출시. 대화형으로 쇼핑·플레이스·예약까지 한 흐름 연결.

> 요약: 2026년 하반기의 실질 KPI는 "검색 몇 위"가 아니라 **AI가 내 글을 몇 번 인용했나**로 이동했다.
> 출처: [코드잇 2026 네이버 알고리즘 변화](https://sprint.codeit.kr/blog/naver-blog-algorithm-change-ai-briefing-clip-mate) ·
> [SEO NEWS 네이버 메이트](https://seonews.co.kr/naver-mate-ai-briefing-citation/) (2026-08-07 확인)

### 5.2 어떤 글이 출처로 잡히나 (공개 정보 한도)

네이버는 AI 브리핑 출처 선정 기준 전체를 공개하지 않았지만, 다음은 공식·업계 일관 분석에서 추정 가능:

- **C-rank 기반**: 네이버 자체 랭킹 알고리즘 C-rank가 출처 신뢰도 평가. 높은 C-rank를 가진 블로그가 우선 (출처: [리드젠랩 GEO 가이드](https://blog.lead-gen.team/naver-ai-briefing-seo-optimal-strategy), [maily.so 2026 네이버 블로그 전망](https://maily.so/tiyou/posts/10z30w56zlw)).
- **신뢰 가능한 후기 우선**: 2026년 네이버 로직 변화의 핵심은 "키워드 중심 → 사용자 의도·콘텐츠 품질·신뢰 중심" (같은 출처).
- **구조화 콘텐츠 가산점**: FAQ·Q&A 중심, 표·리스트 같은 구조화 포맷이 GEO 차원에서 인용률 높음 (같은 출처).
- **본문에 명시된 사실**: AI 브리핑은 글 전체를 RAG로 끌어가므로, 본문에 명시되지 않은 정보(스펙, 인증)는 인용 후보가 아님.

### 5.3 우리 블로그 적용 (추론 + 공식 정보 결합)

| 글 유형 | 네이버 AI 탭 친화도 | 적용 우선순위 |
|---|---|---|
| 정보형 / 검색 상위노출용 | ★★★ (TL;DR, 표, FAQ 모두) | Phase 1부터 |
| 리뷰형 (직구매 / 협찬) | ★★★ (Product 스키마 + FAQ) | Phase 2 |
| 일기형 / 홈피드용 | ★ (감성 우선, AI 레이어 최소화) | Phase 3 또는 생략 |
| 맛집/장소형 | ★★ (LocalBusiness 스키마 검토) | Phase 3 |

홈피드용 글은 AI 친화 레이어를 최소화 — 홈피드 알고리즘은 체류시간·CTR·완독률에 민감하고, TL;DR이 본문 시작 흐름을 끊어 이탈률을 올릴 수 있음 (`docs/homefeed-strategy.md` "첫 3줄=스크롤 유도력" 룰 참고).

### 5.4 한국어 특수 고려사항

- **한국어 토큰**: 영어 대비 토큰 효율 낮음. 한 청크에 들어가는 글자수가 적으므로 더 짧은 단락이 유리 (추론. RAG 청크 토큰 기반 분할 메커니즘에서 도출).
- **고유명사 한·영 병기**: LLM 학습 데이터에서 한글-영문 매핑이 부족할 수 있음. 첫 등장 시 `한글(English)` 병기로 엔티티 인식 정확도 ↑.
- **존댓말 vs 사실문**: 본문은 존댓말 유지(우리 톤), TL;DR/표는 명사형/사실문 OK. LLM은 둘 다 처리 가능.

---

## 6. 측정 지표 — 효과 검증 방법

GEO 측정은 아직 SEO만큼 표준화 안 됐지만, 2026 기준 추적할 수 있는 지표는 다음 (출처: [Frase.io GEO 2026 Guide](https://www.frase.io/blog/what-is-generative-engine-optimization-geo), [Stormy.ai 2026 GEO Guide](https://stormy.ai/blog/generative-engine-optimization-guide-2026)):

### 6.1 직접 측정 가능 (수동)

| 지표 | 방법 | 빈도 |
|---|---|---|
| ChatGPT/Claude/Gemini 인용 | 메인 키워드로 직접 질문 → 출처에 우리 글 URL 떴는지 | 글 발행 후 2주, 1달 |
| Perplexity 인용 | 같은 방법, "Sources" 영역 확인 | 동일 |
| 네이버 AI 브리핑 노출 | 메인 키워드 검색 → AI 브리핑 출처 카드 확인 | 동일 |
| 네이버 AI 탭 노출 | AI 탭 진입 후 동일 질문 시도 | 동일 |
| **AI 브리핑 인용수** | 크리에이터 어드바이저 → AI 브리핑 인용수 (2026-01부터 누적) | **매주** — 네이버 메이트 선정 기준이라 가장 중요 |

### 6.2 간접 지표

| 지표 | 의미 |
|---|---|
| 검색 노출 (Search Console) | 글로벌 SEO 변화 |
| 평균 체류시간 | 사람 친화도 (홈피드 KPI) |
| 직접 유입 비율 ↑ | AI 답변 출처로 노출 → 클릭 |
| 브랜드 mention (수동 검색) | "지나의 휴일" 검색 시 AI가 어떻게 설명하는지 |

### 6.3 권장 운영

- **글 발행 후 2주, 1달, 3달 시점에 위 지표 점검**.
- 점검 결과는 별도 시트(예: `docs/geo-tracker.md`)에 누적 — 어떤 글이 어떤 AI에 인용됐는지.
- 정량 추적 솔루션은 LLMrefs, Profound, AthenaHQ 등 (출처: [LLMrefs](https://llmrefs.com/generative-engine-optimization)). 우리 규모에선 수동 점검으로 충분.

---

## 7. style-rules.ts 코드 반영 권장사항 (메인 컨텍스트에서 통합)

> **이 가이드는 권장사항만 기록.** 실제 코드 수정은 메인 컨텍스트에서 진행. 아래 변경은 "선택적 도입" — Phase 로드맵(8번)에 따라 단계적으로.

### 7.1 STRUCTURE_RULES 확장 제안

```typescript
export const STRUCTURE_RULES = {
  // 기존 ...
  body_min_chars: 1500,
  body_max_chars: 2000,
  
  // AI 친화 레이어 (선택적)
  tldr_required: false,           // Phase 1에선 권장만, Phase 2부터 true 검토
  tldr_max_chars: 80,             // 한 줄 요약 길이
  faq_min: 3,                     // FAQ 도입 시 최소 개수
  faq_max: 5,
  faq_answer_chars: { min: 30, max: 80 }, // 답변 길이
  entity_explicit_min: 1,         // 풀네임 최소 1회
  meta_description_chars: { min: 80, max: 150 },
  alt_text_chars: { min: 50, max: 125 },
} as const;
```

### 7.2 buildSystemPrompt 추가 섹션

`# AI 친화 레이어 (선택)` 섹션 추가:
- target이 `search` 또는 `info`일 때만 활성화.
- target이 `homefeed`면 비활성화 (홈피드 흐름 깨지 않도록).
- 시스템 프롬프트 내용:
  - "본문 시작에 TL;DR 한 줄 요약 + bullet 2~4개를 추가"
  - "마무리 인사 직전 FAQ 3~5개 추가 (구어체 유지)"
  - "브랜드/제품/인증은 첫 등장 시 풀네임"
  - "본문 단락 첫 줄에 결론, 두 번째 줄에 감정 묘사"

### 7.3 lintPostBody 검사 항목 추가 제안

```typescript
// 9. AI 친화 레이어 검사 (frontmatter에 ai_friendly: true 일 때)
if (frontmatter.ai_friendly) {
  // TL;DR 검사
  if (!/^>\s*\*\*한 줄 요약/m.test(bodyOnly) && !frontmatter.tldr) {
    issues.push({ level: 'warning', code: 'no-tldr', message: 'TL;DR이 없음' });
  }
  
  // FAQ 검사
  const faqCount = (bodyOnly.match(/^>\s*\*\*Q\./gm) || []).length;
  if (faqCount < STRUCTURE_RULES.faq_min) {
    issues.push({ level: 'warning', code: 'faq-too-few', message: `FAQ ${faqCount}개 — 권장 ${STRUCTURE_RULES.faq_min}~${STRUCTURE_RULES.faq_max}개` });
  }
}

// 10. meta description 길이 검사
const desc = frontmatter.description;
if (desc && (desc.length < 80 || desc.length > 150)) {
  issues.push({ level: 'warning', code: 'description-length', message: `description ${desc.length}자 — 권장 80~150자` });
}

// 11. 이미지 alt 비어있음 검사
const emptyAlts = bodyOnly.match(/!\[\]\(/g);
if (emptyAlts) {
  issues.push({ level: 'warning', code: 'empty-alt', message: `빈 alt 텍스트 ${emptyAlts.length}개 — 50~125자로 작성` });
}
```

### 7.4 새 파일 제안 (선택)

- `src/lib/jsonld.ts`: frontmatter → JSON-LD `@graph` 빌더 함수.
- `src/components/JsonLd.astro`: PostLayout에서 사용할 JSON-LD 컴포넌트.

---

## 8. 점진 도입 로드맵

한 번에 다 바꾸지 말고 단계적으로. 효과를 측정하면서 진행.

### Phase 1 — 가벼운 도입 (글 1~5편)
**기간**: 첫 1개월
**도입**:
- TL;DR 박스 (인용 블록 형태로 본문에 직접)
- FAQ 섹션 (마무리 직전)
- meta description 80~150자 가이드 적용
- 이미지 alt 풀어쓰기

**도입 안 함**:
- frontmatter 확장 필드
- JSON-LD
- lint 룰

**측정**: 글 발행 후 2주차에 ChatGPT/Perplexity/네이버 AI 브리핑에서 메인 키워드로 검색 → 인용 여부 확인.

### Phase 2 — 표 + 엔티티 (글 6~10편)
**기간**: 2~3개월차
**추가 도입**:
- 사실/스펙 표 (객관 정보 압축)
- 엔티티 풀네임 1회 룰
- frontmatter `tldr`, `faq`, `brand`, `product`, `certifications` 필드 추가
- 단락 첫 줄 = 주제문 룰 본격 적용

**측정**: Phase 1 글들과 인용률 비교 → 효과 검증.

### Phase 3 — 자동화 (글 11편 이후)
**기간**: 4개월차 이후
**추가 도입**:
- JSON-LD 자동 출력 (`PostLayout.astro`에서 frontmatter → schema.org graph)
- Article + FAQPage + Product/Review 스키마 자동 빌드
- `style-rules.ts`에 STRUCTURE_RULES 확장
- `lintPostBody`에 AI 친화 레이어 검사 추가
- `buildSystemPrompt`에 AI 친화 섹션 추가 (target=search/info일 때만)

**측정**: Search Console + 수동 인용 추적 + Schema.org Validator + Google Rich Results Test.

### 도입하지 않을 것
- **홈피드 전용 글에 강제 적용**: 홈피드는 감성 우선. AI 친화 레이어가 흐름을 끊으면 역효과.
- **체험단 가이드와 충돌 시 강행**: 가이드 룰이 항상 우선.
- **분량 무시한 추가**: TL;DR + FAQ가 길어져 본문 흐름 망가지면 의미 없음. 본문 분량을 조정해서 균형.

---

## 9. 한 줄 요약 (이 가이드의 TL;DR)

> **본문 톤은 그대로, 그 위에 TL;DR / 표 / FAQ / 엔티티 명시 4개 레이어를 덧붙이고, 메타데이터·JSON-LD로 머신 신호를 강화한다. 검색·정보형 글부터 점진 도입, 홈피드 글은 최소화.**

---

## 출처

### GEO / AEO 베스트 프랙티스
- Frase.io. ["What is Generative Engine Optimization (GEO)? 2026 Guide"](https://www.frase.io/blog/what-is-generative-engine-optimization-geo)
- LLMrefs. ["Generative Engine Optimization (GEO): The 2026 Guide to AI Search Visibility"](https://llmrefs.com/generative-engine-optimization)
- LLMrefs. ["Answer Engine Optimization (AEO): The Complete Guide for 2026"](https://llmrefs.com/answer-engine-optimization)
- Stormy AI. ["The 2026 Guide to GEO: How to Rank in Perplexity and SearchGPT"](https://stormy.ai/blog/generative-engine-optimization-guide-2026)
- Averi.ai. ["The Definitive Guide to LLM-Optimized Content (2026)"](https://www.averi.ai/breakdowns/the-definitive-guide-to-llm-optimized-content)
- Averi.ai. ["LLM-Optimized Content Structures: Tables, FAQs & Snippets"](https://www.averi.ai/how-to/llm%E2%80%91optimized-content-structures-tables-faqs-snippets)

### RAG 청크화 / LLM 콘텐츠 구조
- Weaviate. ["Chunking Strategies to Improve LLM RAG Pipeline Performance"](https://weaviate.io/blog/chunking-strategies-for-rag)
- Unstructured.io. ["Chunking Strategies for RAG: Best Practices and Key Methods"](https://unstructured.io/blog/chunking-for-rag-best-practices)
- Firecrawl. ["Best Chunking Strategies for RAG (and LLMs) in 2026"](https://www.firecrawl.dev/blog/best-chunking-strategies-rag)
- NVIDIA Developer Blog. ["Finding the Best Chunking Strategy for Accurate AI Responses"](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)

### 구조화 데이터 / JSON-LD
- Google Search Central. ["FAQ (FAQPage, Question, Answer) structured data"](https://developers.google.com/search/docs/appearance/structured-data/faqpage)
- Schema Pilot. ["JSON-LD: The Complete Guide to Structured Data in 2026"](https://www.schemapilot.app/blog/json-ld-guide/)
- Search Engine Land. ["How schema markup fits into AI search — without the hype"](https://searchengineland.com/schema-markup-ai-search-no-hype-472339)
- John Dalesandro. ["Add JSON-LD Structured Data in Astro for Rich Search Results"](https://johndalesandro.com/blog/astro-add-json-ld-structured-data-to-your-website-for-rich-search-results/)

### 네이버 AI 탭 / Cue: / Clova X / AI 브리핑
- 한국정경신문. "네이버, 클로바X·큐 베타 내리고 'AI탭'에 승부수" (2026-02-24). [기사](https://kpenews.com/View.aspx?No=3982878)
- ZDNet Korea. "네이버, 생성형 AI 실험 마침표…클로바X·큐 4월 종료" (2026-02-25). [기사](https://zdnet.co.kr/view/?no=20260225180559)
- 옵티플로우 블로그. "네이버 전략 대전환 — AI 검색 통합" (2026-03-13). [글](https://optiflow.kr/blog/%EB%84%A4%EC%9D%B4%EB%B2%84-%EC%A0%84%EB%9E%B5-%EB%8C%80%EC%A0%84%ED%99%98-ai-%EA%B2%80%EC%83%89-%ED%86%B5%ED%95%A9-%ED%81%B4%EB%A1%9C%EB%B0%94x%ED%81%90-%EC%A2%85%EB%A3%8C%EC%99%80-ai-%EB%B8%8C%EB%A6%AC%ED%95%91ai-%ED%83%AD-206)
- 리드젠랩 GEO 실험실. "네이버 AI 브리핑 노출 방법은? C-rank·AEO 최적화 가이드 (2025)". [글](https://blog.lead-gen.team/naver-ai-briefing-seo-optimal-strategy)
- maily.so. "[2026 네이버 블로그 전망] AI 브리핑 시대". [글](https://maily.so/tiyou/posts/10z30w56zlw)
- 나무위키. ["Cue:"](https://namu.wiki/w/Cue:), ["CLOVA X"](https://namu.wiki/w/CLOVA%20X)

### 메타 / og:description / 이미지 alt
- wearekemb. ["The Future of On-Page SEO: Meta Descriptions in a World of AI Search"](https://wearekemb.com/en/the-future-of-on-page-seo-meta-descriptions-in-a-world-of-ai-search-summary-how-meta-descriptions-are-changing-in-ai/)
- Alt Audit. ["Alt Text in 2026: SEO, Accessibility & AI Best Practices Guide"](https://altaudit.com/blog/ai-alt-text-generation-guide-trends-seo-2026)
- AltText.ai. ["Image SEO for AI Search (GEO): 2026 Best Practices"](https://alttext.ai/blog/geo-tags-image-seo-best-practices-ai-platforms)

### 엔티티 / 브랜드 인용
- Waikay. ["How to Turn LLM Noise into Brand Strategy Using Entities and Citations"](https://waikay.io/how-to-turn-llm-noise-into-brand-strategy-using-entities-and-citations/)
- Wellows. ["Brand Mentions vs. Citations: What Drives AI Search Visibility?"](https://wellows.com/blog/brand-mentions-vs-citation/)
- AirOps. ["Tracking LLM Brand Citations: A Complete Guide for 2026"](https://www.airops.com/blog/llm-brand-citation-tracking)

### 내부 정합성 (코드베이스 참조)
- `/Users/user/Desktop/jy/blog_social/AGENTS.md` (Hard Rules)
- `/Users/user/Desktop/jy/blog_social/docs/blog-writing-guide.md` (톤·구조·SEO·금지 룰)
- `/Users/user/Desktop/jy/blog_social/docs/homefeed-strategy.md` (홈피드 전략)
- `/Users/user/Desktop/jy/blog_social/scripts/lib/style-rules.ts` (단일 소스 코드 룰)

---

> 본 가이드는 2026-04-29 기준 공개 정보 및 업계 베스트 프랙티스를 토대로 작성. 네이버 AI 탭 출처 선정 알고리즘 등 비공개 영역은 추정으로 표기. 6개월 단위로 출처 갱신·재검토 권장.
