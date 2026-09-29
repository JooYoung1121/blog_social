# 리빌딩 계획 — 2026 하반기

> 작성 2026-09-29. 마지막 시스템 작업이 2026-08-08(`314ed93`)이라 약 7주 공백이 있었고, 그 사이 모델 세대와 네이버 검색 환경이 한 번 더 움직였다.
>
> **상태: Phase 0~4 구현 완료 (2026-09-29).** 아래 §1 진단은 작업 전 스냅샷이고, §8에 실제로 무엇이 들어갔는지 정리했다.
> 확정된 룰은 기존대로 `docs/blog-writing-guide.md`와 `scripts/lib/style-rules.ts`가 정본이다.

---

## 1. 현황 진단

### 1.1 잘 돌아가는 것 (건드리지 않는다)

| 자산 | 위치 | 상태 |
|---|---|---|
| 룰 단일 소스 | `scripts/lib/style-rules.ts` (941줄) | 시스템 프롬프트 + lint가 같은 상수를 읽음. 구조적으로 옳음 |
| 룰 문서화 | `AGENTS.md` + `docs/` 8종 | Codex/Claude 공용 진입점. 거버넌스 명확 |
| AI 친화 레이어 | TL;DR / FAQ / 엔티티 / 영상마커 | 기존 15편 소급 적용 완료 (`36606ba`) |
| 사진 파이프라인 | `scripts/upload-images.ts` | HEIC→JPG(sips) → 톤 보정 → Cloudinary. 순서 보존 |
| 네이버 업로드 모드 | `src/pages/naver/[...slug].astro` | 블록 분절 + 복사 진행상태 localStorage |
| 이중 진입 | CLI(무료) + `/admin`(모바일, 종량제) | 역할 분담 명확 |

### 1.2 낡았거나 비어 있는 것

#### (A) 모델 세대가 한 세대 뒤처짐 — 확정 사실

`claude-opus-4-7`이 두 곳에 하드코딩되어 있다.

- `scripts/generate-draft.ts:307`
- `src/pages/srv/admin/generate.ts:48`

현행 세대는 **Claude Opus 5 (`claude-opus-5`)** 이고, 가격은 Opus 4.7과 동일($5 / $25 per MTok), 컨텍스트도 1M로 같다. 즉 **비용 증가 없이 세대만 올라간다.** 위쪽에 Claude Fable 5.1(`claude-fable-5-1`, $10 / $50)이 있지만 블로그 초안 작업엔 과하다.

같이 손볼 API 디테일:

| 항목 | 현재 | 권장 |
|---|---|---|
| 모델 ID | `claude-opus-4-7` 하드코딩 ×2 | `scripts/lib/model.ts`로 중앙화 후 `claude-opus-5` |
| thinking | `{type:'adaptive'}` | 그대로 유효 (Opus 5는 기본 on) |
| effort | `output_config.effort: 'high'` | 사진 20장 이상 장문은 `xhigh` 검토 |
| max_tokens | 16000 | 사진 29장짜리 글은 상한에 근접. 스트리밍이므로 `32000`으로 여유 |
| 캐시 | system 1블록 ephemeral (5분 TTL) | 한 세션에 여러 편 뽑을 땐 `ttl:'1h'` |
| 사진 전달 | Cloudinary URL image block | 재생성이 잦으면 Files API로 `file_id` 재사용 |

> 근거: `claude-api` 스킬 내장 모델 표(캐시 2026-06-24) 및 Anthropic TypeScript SDK 가이드. 모델 ID에 날짜 접미사를 붙이지 않는다.

#### (B) 문서-코드 불일치 — JSON-LD가 반쪽

`docs/ai-friendly-guide.md` §2.1~2.2가 `tldr` / `faq` / `brand` / `product` / `entities` frontmatter 확장과 `@graph` JSON-LD를 제안했는데, **코드에 반영이 안 됐다.**

- `src/content.config.ts` — 해당 필드 없음
- `src/components/SEOHead.astro:31-56` — `BlogPosting` 단일 객체만 출력. `FAQPage` / `Product` / `Review` / `ImageObject` 없음

결과적으로 본문에는 FAQ가 있는데(15편 전부) **기계가 읽는 신호로는 안 나간다.** ai-friendly-guide가 인용한 "FAQPage 스키마 보유 페이지 인용률 41% vs 15%" 수치를 우리는 못 먹고 있는 상태.

#### (C) 키워드 리서치가 완전 수동

`input/*/keywords.txt`를 손으로 채운다. 2026-04-30 연관검색어 서비스 종료 이후 대체 수단을 파이프라인에 붙이지 않았다. `docs/writing-input-guide.md`는 아직 "네이버 자동완성 보기 / 키워드마스터 수동 조회"를 안내한다.

**자동화 가능하다.** 네이버 검색광고 API `/keywordstool`이 연관키워드 + PC/모바일 월간검색수 + 경쟁정도를 주고(HMAC-SHA256 서명, GET), 네이버 오픈 API 블로그 검색이 `total`로 문서수를 준다. 둘을 나누면 **기회점수(검색량 ÷ 문서수)** 가 나온다.

#### (D) 성과 피드백 루프 없음

발행 후 지표가 다음 글 생성에 전혀 반영되지 않는다. `AI_BRIEFING_RULES.metrics`에 "크리에이터 어드바이저에서 수동 확인"이라고만 적혀 있고 코드가 없다. 어떤 소제목 형태가 인용됐는지, 어떤 키워드로 들어왔는지가 축적되지 않으니 **알고리즘이 개선되지 않는다.** 이게 지금 시스템의 가장 큰 구조적 공백이다.

#### (E) lint가 놓치는 2026 룰

`lintPostBody`가 검사하는 것: 협찬고지, 금지패턴, 글자수, 연속사진, 인사/마무리, 키워드 빈도, 소제목 수/명사형/키워드, TL;DR, FAQ, 영상마커, 내부링크, 외부출처.

검사하지 **않는** 것:
- `PUBLISHING_RHYTHM`(하루 2편·주 2~4편) — 상수만 있고 검사 없음
- 두괄식(소제목 다음 문단이 대명사로 시작하는지) — `AI_BRIEFING_RULES.self_contained_answer`가 프롬프트 권고로만 존재
- 최신성 신호("2026년 9월 기준") 유무
- 이미지 alt 길이 (`AI_FRIENDLY_RULES.alt_chars` 50~125자 기준 있음 / 실측 현재 65~87자로 하한 미달 다수)
- frontmatter `description` 길이 (80~150자 기준 있음)
- 유사문서 리스크(같은 카테고리 연속 발행, 소제목 구조 중복)

#### (F) 사이트 자체의 GEO가 약함

`jinas-holiday.vercel.app`은 ChatGPT/Perplexity/Gemini가 크롤할 수 있는 유일한 자산인데(네이버 블로그는 외부 크롤러 차단), 현재:
- `public/llms.txt` 없음
- 카테고리 허브가 단순 목록 — 주제 클러스터(C-rank 유사 신호) 형성 안 됨
- `Speakable` / `HowTo` / breadcrumb 스키마 없음
- RSS는 있음, sitemap은 있음

#### (G) 기타

- **네이버 실제 발행은 자동화 불가** — 공식 글쓰기 API가 없다. 브라우저 자동화는 제재 위험(뉴스버스 보도 기준 대량 자동 발행이 제재 타깃). **현행 블록 복붙 유지가 옳은 판단**이다. 개선 여지는 복붙 횟수 축소뿐.
- **오래된 글 갱신 트리거 없음** — `updated` 필드는 스키마에 있는데, "갱신할 때가 된 글"을 뽑는 도구가 없다. AI 브리핑은 최신성을 본다.
- **A/B 비교 평가 자동화 없음** — `docs/ab-comparison-protocol.md`는 절차만 있고 채점이 없다.
- **legacy 포스트 6편이 루트에 있음** — `src/content/posts/2026-03-26-*.md` 등이 `YYYY/MM/` 규칙 밖.

---

## 2. 2026 하반기 네이버 검색 환경 — 무엇으로 이겨야 하나

### 2.1 확인된 타임라인

| 시점 | 변화 |
|---|---|
| 2025-03 | AI 브리핑 통합검색 정식 출시 |
| 2026-04-09 | Cue:, Clova X 종료 → AI 탭으로 일원화 |
| 2026-04-30 | 연관검색어 서비스 종료(20년 만) |
| 2026-04 | AI 브리핑 이용자 3,000만, 전체 쿼리 약 20% 처리. 출처의 약 70%가 블로그·카페 등 UGC |
| 2026-06-04 | 네이버 메이트 베타 — 선정 기준이 **AI 브리핑 인용수**. 월 30만 원(약 3,000명) ~ 최상위 1,000만 원, 연 200억 / 5년 1조 규모 |
| 2026-06-26 | AI 탭 출시 — 대화형, 쇼핑·플레이스·예약 연결 |
| 2026 하반기 | AI 검색 결과 내 광고 테스트 예고 |

### 2.2 랭킹 요인 — 공개된 것과 추정

**공개/공식:** 네이버는 AI 브리핑의 출처 선정 알고리즘을 공개하지 않는다. 공식적으로 안내되는 건 (1) 검색로봇의 정상 수집·색인, (2) 검색 의도에 대한 직접 답변, (3) 근거·출처 명시, (4) 도입부 핵심 답변 우선 배치.

**업계 분석(추정, 확정 수치 아님):**
- **C-rank** — 한 주제를 깊이 있게 누적한 블로그가 인용 확률이 높다. 여러 주제를 산발적으로 다루면 불리.
- **D.I.A.+ / 문서 품질** — 실제 경험, 고유 정보(자체 비교·분석), 멀티미디어.
- **체류시간 60초** — 2026 로직에서 상위노출 최소 조건으로 보고됨.
- **AI 스팸 실시간 필터링** — "~에 대해 알아보겠습니다", "~는 매우 중요한 요소입니다" 같은 AI 상투구가 판별 신호. 우리 금지룰이 이미 이걸 막고 있다.

### 2.3 그래서 키워드를 어떻게 잡아야 하나 (핵심)

**목표가 "순위"에서 "인용"으로 바뀌었다는 건, 키워드 단위가 단어에서 질문으로 바뀌었다는 뜻이다.**

| 구분 | ~2025 방식 | 2026 하반기 방식 |
|---|---|---|
| 키워드 단위 | 명사구 ("실온이유식") | 질문 ("중기이유식 실온보관 괜찮나요") |
| 선정 기준 | 검색량 | 검색량 ÷ 문서수 = 기회점수 |
| 배치 | 본문 5~7회 반복 | 소제목 = 질문, 첫 문단 = 정의형 답 |
| 확장 소스 | 연관검색어 (종료됨) | 검색광고 API 연관키워드 + AI 탭 후속질문 + 자동완성 |
| 성공 측정 | 검색 순위 | AI 브리핑 출처 카드 등장 여부 + 인용수 |

**우리 블로그에 맞는 키워드 3층 구조 (제안):**

1. **허브 키워드 (C-rank 축)** — 카테고리당 1개. 예: `육아용품 리뷰`, `아기 이유식`. 여기에 글이 누적돼야 전문성 점수가 붙는다. 현재 16편이 육아용품/반려견/전자기기/어학으로 흩어져 있어 **축이 약하다.**
2. **메인 키워드 (글 1편 = 1개)** — 검색량 있고 문서수 적은 조합형. 예: `실온이유식`(현행 방식, 유지).
3. **질문 키워드 (소제목 4~6개 = 질문 4~6개)** — 지금 여기가 비어 있다. 메인 키워드 하나당 롱테일 질문 4~6개를 뽑아서 소제목으로 쓰고, 각 소제목 첫 문단을 그 질문의 완결 답변으로 쓴다. **AI 브리핑 인용은 이 단위에서 일어난다.**

**실행 규칙 (style-rules.ts 반영 후보):**
- 질문 키워드는 "상황 + 대상 + 판단"으로 만든다. `7개월 아기 외출할 때 이유식 어떻게 챙기나요` > `이유식 보관법`
- 각 소제목 답변 문단은 주어를 문단 안에 다시 넣는다(RAG 청크가 잘려도 의미 유지). 이건 이미 `AI_BRIEFING_RULES`에 있음 — lint로 승격.
- 경쟁 키워드는 문서수 기준으로 거른다. 육아용품은 문서수가 많으므로 **조합 2단계 이상**(제품군 + 상황 + 월령)으로 내려간다.

---

## 3. 리빌딩 로드맵

우선순위는 **(효과 ÷ 공수)** 순. Phase 0~1이 전체 효과의 대부분이다.

### Phase 0 — 위생 (반나절, 리스크 거의 없음)

| # | 작업 | 파일 |
|---|---|---|
| 0-1 | 모델 ID를 `scripts/lib/model.ts`로 중앙화하고 `claude-opus-5`로 교체 | `generate-draft.ts:307`, `srv/admin/generate.ts:48` |
| 0-2 | `max_tokens` 16000 → 32000, 장문은 `effort: 'xhigh'` | 동일 |
| 0-3 | 캐시 TTL `1h` 옵션 추가(연속 생성 시) | 동일 |
| 0-4 | ~~legacy 포스트 6편을 `YYYY/MM/`로 이동~~ **철회** | 아래 참고 |
| 0-5 | `docs/writing-input-guide.md`의 "연관검색어" 안내 삭제 | 문서 |

> **0-4 철회 사유 (2026-09-29):** slug가 파일 경로(`post.id`)라서 파일을 옮기면 공개 URL이 바뀐다.
> 이 6편을 가리키는 내부 링크도 이미 존재한다. 얻는 건 파일 정리뿐이고 SEO 이득은 0인데,
> 인용을 늘리려는 작업에서 기존 URL을 깨는 건 손해다. 새 글만 `YYYY/MM/` 규칙을 지킨다.

### Phase 1 — 인용 신호 완성 (1~2일, 효과 최대)

| # | 작업 | 내용 |
|---|---|---|
| 1-1 | frontmatter 확장 | `content.config.ts`에 `tldr` / `faq[]` / `brand` / `product` / `certifications[]` 추가 (전부 optional) |
| 1-2 | JSON-LD `@graph` | `SEOHead.astro`를 `BlogPosting` + `FAQPage` + `Product`/`Review` + `ImageObject` + `BreadcrumbList` 그래프로 교체. **본문에 보이는 FAQ만 스키마에 넣는다**(불일치는 manual action 위험) |
| 1-3 | 본문 FAQ → frontmatter 자동 추출 | 이미 15편에 FAQ 본문이 있으므로 파서로 뽑아 frontmatter 채우는 일회성 스크립트 |
| 1-4 | `public/llms.txt` | 블로그 주제·저자·카테고리·주요 글 목록을 LLM용으로 명시 |
| 1-5 | 카테고리 허브 강화 | `/category/[slug]`에 주제 정의 + 해당 주제 글 목록 + FAQ. C-rank 유사 신호 |

### Phase 2 — 키워드 자동화 (1~2일)

**`scripts/keyword-research.ts` 신규.**

```
npm run keywords -- --seed "실온이유식" --category baby-products
```

1. 네이버 검색광고 API `/keywordstool` (HMAC-SHA256 서명) → 연관키워드 + 월간검색수(PC/모바일) + 경쟁정도
2. 네이버 오픈 API 블로그 검색 → 키워드별 `total`(문서수)
3. 기회점수 = 월간검색수 ÷ 문서수, 랭킹
4. 상위 후보를 Claude에 넘겨 **질문형 소제목 4~6개** 생성
5. `input/<slug>/keywords.txt` + `questions.txt` 자동 생성

필요한 환경변수 (사용자가 발급해야 함):
```
NAVER_AD_CUSTOMER_ID=
NAVER_AD_API_KEY=
NAVER_AD_SECRET_KEY=
NAVER_OPENAPI_CLIENT_ID=
NAVER_OPENAPI_CLIENT_SECRET=
```

> 검색광고 API는 광고주센터 → 도구 → API 사용 관리에서 발급. **SECRET_KEY는 `.env`에만 두고 절대 커밋하지 않는다** (`.gitignore` 확인 완료).

### Phase 3 — lint 강화 (반나절)

`lintPostBody`에 추가할 검사:

| 코드 | 레벨 | 검사 |
|---|---|---|
| `lead-with-answer` | warning | 소제목 직후 문단이 대명사("이건","그게","이렇게")로 시작 |
| `no-recency-signal` | warning | "2026년 ○월 기준" 류 최신성 표현 0회 |
| `alt-too-short` | warning | 이미지 alt < 50자 (현재 다수 미달) |
| `description-length` | warning | frontmatter description이 80~150자 밖 |
| `publishing-rhythm` | warning | 같은 날짜 3편 이상 / 같은 카테고리 연속 3편 |
| `structure-duplicate` | warning | 직전 3편과 소제목 패턴이 과도하게 유사 |

### Phase 4 — 성과 피드백 루프 (2~3일, 장기 효과 최대)

이게 "알고리즘 개선"의 본체다. 현재는 **매번 같은 프롬프트로 같은 품질의 글**이 나온다. 학습이 없다.

```
data/performance.csv   ← 사용자가 크리에이터 어드바이저에서 월 1회 붙여넣기
  slug, 조회수, 체류시간, 유입키워드 top5, AI브리핑인용수, 공감, 댓글
```

- `scripts/perf-report.ts` — 글별 성과 + "어떤 소제목 형태가 인용됐나" 집계
- `scripts/refresh-candidates.ts` — 발행 6개월 경과 + 유입 있는 글 = 갱신 1순위. `updated` 스탬프 찍고 재발행
- 상위 성과 글의 소제목/도입부 패턴을 `buildSystemPrompt`에 **few-shot 예시로 주입**

> 크리에이터 어드바이저는 공식 API가 없으므로 수동 CSV 입력이 현실적. 월 1회 10분이면 충분하다.

### Phase 5 — 선택 항목

- A/B 비교 자동 채점 (Claude를 심판으로, `docs/ab-comparison-protocol.md` 지표 기준)
- `/naver/[slug]` 복붙 횟수 축소 (본문 1회 복사 + 사진 순차 열기)
- 사진 EXIF 촬영시각 보존 검토 (`sharp` 기본은 메타 제거 — 실제 경험 신호 vs 개인정보 트레이드오프)

---

## 4. 사용자가 줘야 할 정보 — 입력 양식 개편

지금 `notes.txt`는 자유 형식이라 **글의 품질이 메모의 풍부함에 전적으로 좌우된다.** AI가 못 만드는 건 직접 겪은 것뿐이라, 여기가 병목이다.

### 4.1 `notes.txt` 구조화 (권장 양식)

```
[언제부터/얼마나]
8월 20일부터 약 5주. 하루 2회.

[사기 전 고민]
냉동실이 꽉 차서 자리가 없었음. 시판 이유식은 다 냉동이라 포기하려던 참.

[계기]
조리원 동기가 실온 보관 되는 게 있다고 알려줌.

[봄이 반응 — 전]
기존 냉동 이유식은 데우는 데 오래 걸려서 그 사이에 울었음.
[봄이 반응 — 후]
바로 데워지니까 안 울고 먹음. 양도 더 먹음.

[실패/아쉬운 점]   ← 가장 중요. 이게 있어야 진짜 후기로 읽힌다
유리병이라 외출할 때 무거움. 깨질까 봐 신경 쓰임.

[꿀팁]
뚜껑 열기 전에 흔들면 안 됨. 분리된 채로 데우는 게 나음.

[비교 대상]
기존에 쓰던 ○○ 냉동 이유식과 비교하면 데우는 시간이 확실히 짧음.

[재구매 의사]
외출용으론 계속 살 듯. 집에서만 먹일 거면 굳이.
```

이 7개 항목이 그대로 **소제목 4~6개 + FAQ 3~5개 + TL;DR**로 변환된다. 지금처럼 bullet 나열이면 AI가 구조를 추측해야 하고, 그 추측이 "AI 티"의 원인이 된다.

### 4.2 촬영 시점에 남기면 좋은 것

- 사진 찍을 때 **한 장당 한 줄** 음성 메모 → `photo-notes.txt`로 옮기면 캡션 정확도가 크게 오른다 (지금은 Claude가 사진만 보고 추정)
- 날짜가 드러나는 컷(택배 송장, 앱 화면, 달력) 1장 — 최신성·실경험 신호

### 4.3 새로 추가할 입력 파일

| 파일 | 용도 | 필수 |
|---|---|---|
| `questions.txt` | 노릴 질문 키워드 4~6개 (Phase 2에서 자동 생성 가능) | 권장 |
| `photo-notes.txt` | 사진 번호별 한 줄 메모 | 선택 |
| `competitors.txt` | 같은 키워드 상위 글 URL 2~3개 (차별화 포인트 추출용) | 선택 |

---

## 5. To-Be 포스팅 흐름

```
[1] 키워드 잡기          npm run keywords -- --seed "실온이유식"
                         → 기회점수 랭킹 + 질문형 소제목 후보
                         → input/<slug>/keywords.txt, questions.txt 생성

[2] 입력 준비            사진 photos/ + notes.txt(구조화 양식) + purchase.txt
                         (+ client-guide.md 협찬 시)

[3] 초안 생성            npm run generate-draft -- --input <dir> --category <cat>
                         Claude Opus 5, 룰 100% + 성과 상위글 few-shot

[4] 검증                 npm run lint:posts -- <file>
                         에러 0 / 경고 확인

[5] 사람 손질            지나님만 아는 디테일 보강 (여기가 진짜 차별화)

[6] 발행                 git push → Vercel 자동 배포 (웹 아카이브 + JSON-LD)

[7] 네이버 업로드        /naver/<slug> 열어서 블록 복붙 + 사진 직접 업로드
                         + 클립/영상 마커 위치에 영상 삽입

[8] 측정 (월 1회)        크리에이터 어드바이저 → data/performance.csv
                         npm run perf-report
                         → 상위 패턴이 다음 글 프롬프트로 환류
```

발행 리듬은 기존대로 **하루 최대 2편 / 주 2~4편** 유지. AI 대량 발행 제재 흐름이 강해지고 있어 이 상한을 자동화로 넘기지 않는다.

---

## 6. 결정 사항 (2026-09-29 확정)

1. **Phase 범위** — ✅ **Phase 0~4 전체 진행**
2. **C-rank 축** — ✅ **육아 + 반려견 2축**. `pet` 카테고리 신설, `HUB_AXES` 로 코드화
3. **네이버 검색광고 API 발급** — ⏳ 사용자 작업 대기. 광고주센터 가입 필요(광고 집행은 불필요)
4. **성과 데이터 수집** — ⏳ 월 1회 수동 CSV 로 확정. `data/performance.csv`

---

## 8. 구현 결과 (2026-09-29)

### 신규 파일

| 파일 | 역할 |
|---|---|
| `scripts/lib/model.ts` | Claude 모델 ID 단일 소스. `claude-opus-5`, `max_tokens` 32000, `effortFor()`, 캐시 TTL |
| `scripts/lib/naver-api.ts` | 검색광고 API(HMAC-SHA256) + 검색 오픈 API 클라이언트 |
| `scripts/lib/performance.ts` | 성과 CSV 로더 + 성과 점수(AI 인용 가중) |
| `scripts/keyword-research.ts` | `npm run keywords` — 기회점수 랭킹 + 질문형 소제목 생성 |
| `scripts/extract-ai-layer.ts` | `npm run extract-ai-layer` — 본문 TL;DR/FAQ → frontmatter 승격 |
| `scripts/perf-report.ts` | `npm run perf-report` — 글별/축별 성과, 소제목 패턴, 유입 대조 |
| `scripts/refresh-candidates.ts` | `npm run refresh` — 갱신 우선순위 |
| `src/lib/jsonld.ts` | `@graph` 빌더 (BlogPosting/Person/ImageObject/FAQPage/Product/Review/Breadcrumb) |
| `src/pages/llms.txt.ts` | LLM 크롤러용 사이트 요약 |
| `data/performance.csv`, `data/README.md` | 성과 기록 (월 1회 수동 입력) |

### 주요 변경

- **모델**: `claude-opus-4-7` → `claude-opus-5` (하드코딩 2곳 제거, 가격 동일 $5/$25)
- **카테고리**: `pet` 신설. 강아지 글 2편을 `daily-life`에서 이동. C-rank 축 = 육아 / 반려견 2축(`HUB_AXES`)
- **카테고리 라벨 중복 제거**: 8개 파일에 흩어져 있던 맵을 `CATEGORY_LABELS` 하나로 통합
- **frontmatter 확장**: `tldr` / `faq[]` / `brand` / `product` / `certifications[]` (전부 optional)
- **기존 16편 소급**: 본문에만 있던 TL;DR 1개 + FAQ 5개를 frontmatter로 승격 → FAQPage 스키마 출력 시작
- **카테고리 허브**: 주제 태그·운영 기간 노출 + `CollectionPage` JSON-LD
- **lint**: `lead-with-answer` / `no-recency-signal` / `alt-empty` / `alt-too-short` / `description-length` / `faq-schema-mismatch` / `faq-not-extracted` + 교차 파일(발행 리듬·카테고리 연속·소제목 중복)
- **학습 루프**: `questions.txt` → 소제목 고정, 성과 상위 글 소제목 → few-shot 주입 (`PromptOptions.questions` / `provenHeadings`)
- **`inferPurchaseType`** 공용화 — legacy `sponsored` 필드만 있는 글의 협찬 고지 오판 방지

### 첫 lint 실행 결과 (16편)

에러 0 / 경고 73. 주요 패턴:

- `alt-too-short` — **16편 전부.** 모든 alt가 50자 미만. 가장 큰 개선 여지
- `no-recency-signal` — 대부분. 오래된 글이라 당연하고, `npm run refresh` 대상
- `no-video-marker`, `internal-links-low` — 다수
- 발행 패턴: 2026-04-13에 4편, 2026-04-17에 3편 (하루 2편 초과) / `baby-products` 4편 연속 2회

### 아직 안 된 것

- **`brand` / `product` / `certifications` 백필** — 정식 제품명을 지어낼 수 없어 비워뒀다.
  채우면 `Product` + `Review` 스키마가 붙는다. 제품명을 아는 사람이 채워야 한다.
- **alt 개선** — 16편 전부 50자 미만. 사진을 보고 다시 써야 해서 일괄 처리 불가
- **네이버 API 키 미발급** — `npm run keywords` 는 키가 들어와야 첫 실행 가능
- **성과 데이터 0건** — `data/performance.csv` 가 비어 있어 학습 루프가 아직 안 돈다

---

## 7. 출처

**네이버 검색 환경**
- [코드잇 — 2026년 확 바뀐 네이버 알고리즘: AI 브리핑·클립·메이트](https://sprint.codeit.kr/blog/naver-blog-algorithm-change-ai-briefing-clip-mate)
- [PageOne Works — 네이버 AI 브리핑 2026: 노출 원리·출처 선정과 콘텐츠 최적화](https://www.pageoneworks.com/article/naver-ai-briefing-optimization-guide-2026)
- [SEO Korea — 네이버 AI란? AI 브리핑·AI 탭 완벽 정리 2026](https://seo.co.kr/blog/what-is-naver-ai/)
- [원포인트 — 네이버 AI 브리핑에 인용되는 콘텐츠 설계법](https://1point.kr/blog/insights/naver-ai-briefing-content-design/)
- [GI Corp — 2026 네이버 검색 알고리즘 변화 분석](https://www.gi-corp.co.kr/post/2026-네이버-검색-알고리즘-변화-분석-ai-브리핑-시대의-콘텐츠-전략)
- [로카포스팅 — 네이버 블로그 상위노출 체크리스트 20가지 2026](https://locaposting.com/blog/naver-seo-checklist)
- [뉴스버스 — AI 따발총 저품질 블로그글, 네이버 제재 강화 방침](https://www.newsverse.kr/news/articleView.html?idxno=9959)
- [행머니 — 네이버 AI 글 판별 기준](https://moneyroan.com/naver-ai-content-detection-criteria/)
- [네이버 Search Advisor SEO 가이드](https://searchadvisor.naver.com/guide/seo-help)

**키워드 도구 / API**
- [naver/searchad-apidoc (GitHub)](https://github.com/naver/searchad-apidoc)
- [마케팅마법사 — 네이버 검색광고 API로 키워드 검색량 호출하기](https://placewizard.kr/guide/naver-keyword-search-ad-api-guide.php)
- [workingwithpython — 네이버 검색광고 API 키워드 검색량·연관검색어 추출](https://workingwithpython.com/naverkeywordplannerapi/)

**모델 / API**
- Anthropic `claude-api` 스킬 내장 모델 표 (캐시 2026-06-24) — Opus 5 `claude-opus-5`, 1M 컨텍스트, $5/$25 per MTok
- Anthropic TypeScript SDK 가이드 (adaptive thinking, `output_config.effort`, prompt caching)

**레포 내부 근거**
- `scripts/generate-draft.ts:307`, `src/pages/srv/admin/generate.ts:48` — 모델 하드코딩
- `src/components/SEOHead.astro:31-56` — JSON-LD 현황
- `src/content.config.ts` — frontmatter 스키마 현황
- `scripts/lib/style-rules.ts:218-240, 324-369` — AI 친화 / AI 브리핑 / 발행 리듬 상수
- `docs/ai-friendly-guide.md` §2.1-2.2 — 미구현 제안
