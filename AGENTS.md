# 지나의 휴일 — 블로그 아카이브 시스템

> **AI 에이전트 (Codex / Cursor / Claude Code 등) 진입점.**
> 이 레포에서 작업하기 전에 이 문서와 아래 링크된 가이드들을 먼저 읽으세요. 이 문서들에 정의된 규칙은 글 작성·코드 수정 모두에서 **반드시** 따라야 합니다.

---

## 📚 핵심 가이드 문서 (작업 전 필수 숙지)

| 문서 | 언제 읽어야 하는가 |
|---|---|
| [`docs/blog-writing-guide.md`](docs/blog-writing-guide.md) | **모든 새 글 작성 시.** 톤, 구조, 사진 배치, SEO, 금지 규칙 정의 |
| [`docs/ai-friendly-guide.md`](docs/ai-friendly-guide.md) | **AI 탭 / GPT / Gemini / Perplexity 인용을 노릴 때.** 기존 글쓰기 가이드 위에 얹는 AI 친화 레이어 (TL;DR, FAQ, 엔티티, 구조화 데이터) |
| [`docs/ab-comparison-protocol.md`](docs/ab-comparison-protocol.md) | **A/B 비교 모드 (input 폴더에 `AB.txt` 마커가 있을 때).** Claude/Codex 두 도구가 같은 입력으로 두 글을 작성하는 절차와 측정 지표 |
| [`docs/codex-workflow.md`](docs/codex-workflow.md) | **Codex로 글 작성/비교 실험 시.** Claude 생성 스크립트와 분리된 작업 흐름 |
| [`docs/homefeed-strategy.md`](docs/homefeed-strategy.md) | 홈피드 노출을 노리는 글 작성 시. 상위노출용과 스타일 분리 기준 |
| [`docs/author-profile.md`](docs/author-profile.md) | 글에 작성자/아기/반려견을 언급할 때. 잘못된 사실(예: 모유수유) 방지 |
| [`docs/photo-tone.md`](docs/photo-tone.md) | 사진 보정 작업 시. 기본 보정 수치 |
| [`docs/writing-input-guide.md`](docs/writing-input-guide.md) | input 폴더 양식 정의. `npm run new-post` 실행 전 입력 준비 |

룰의 단일 소스 코드: `scripts/lib/style-rules.ts` (AI 시스템 프롬프트 + lint가 함께 읽음).

---

## 프로젝트 개요
네이버 블로그 "지나의 휴일" (https://blog.naver.com/snf00467) 의 글 작성 + 아카이빙 시스템.
Astro 기반 개인 웹 블로그를 생성하고, 네이버 업로드 전 웹 본문을 검토하는 흐름으로 운영.

배포 사이트: https://jinas-holiday.vercel.app

## 기술 스택
- **프레임워크:** Astro 5.x (Content Collections)
- **이미지:** Cloudinary (HEIC→JPG 변환 후 업로드)
- **배포:** Vercel (git push → 자동 배포)

## 새 글 작성 명령
```bash
npm run new-post -- --input <사진폴더> --category <카테고리> [옵션]
```

카테고리: `baby-products` | `parenting` | `daily-life` | `food` | `travel`

옵션:
- `--title "제목"`, `--description "설명"`, `--tags "태그1,태그2"`
- `--sponsor-info "브랜드명으로부터 협찬받아"`, `--product-link "URL"`

또는 input 폴더에 `topic.txt`, `notes.txt`, `product-url.txt`, `sponsor.txt`, `client-guide.md` 파일을 넣으면 자동 인식. 자세한 양식은 [`docs/writing-input-guide.md`](docs/writing-input-guide.md) 참고.

Codex 결과물 비교 시에는 [`docs/codex-workflow.md`](docs/codex-workflow.md)를 따른다. `npm run generate-draft`는 Claude API 기반 자동 생성이므로 Codex 초안 비교용으로 사용하지 않는다.

## 폴더 구조
- `src/content/posts/YYYY/MM/` — Markdown 포스트 (날짜별 정리)
- `src/pages/posts/[...slug].astro` — 웹 블로그 글 페이지
- `src/pages/naver/[...slug].astro` — **네이버 업로드 모드** (블록 단위 복사 버튼 + 사진/영상 삽입 마커, 모바일 친화). 모든 발행 글에 자동 생성됨
- `scripts/` — CLI 도구 (new-post, upload-images, generate-naver)

## 환경변수 (.env)
```
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```

---

## ⚙️ 작업 룰 (Hard Rules) — 외부 에이전트 포함 모두 적용

### 우선순위
체험단/협찬 가이드(`input/.../client-guide.md`) 가 다른 모든 룰보다 **최우선**. SEO·톤·구조 룰과 충돌 시 가이드를 따른다. 가이드에 명시 안 된 부분만 기본 룰 적용.

### 글 작성 시
- **인사말** `안녕하세요! 지나의 휴일 지나입니다 :)` / **마무리** `오늘 포스팅은 여기서 마무리! 궁금한 점은 댓글로 남겨주세요 😊 그럼 안녕! 👋`
- 톤: 친근한 대화체, 본인 경험 기반, 이모지 적절히. 1~2줄 짧은 문단 → 빈 줄 → 1~2줄.
- 소제목: **서술형/감정형 문장**. 명사형(`성분`, `디자인`, `결론`) 금지.
- 사진 배치: **연속 최대 2장**, 사진 뒤에 반드시 텍스트.
- SEO: 본문 1,500~2,000자, 메인 키워드 5~7회, 소제목 4~6개, 내부 링크 2~3개.
- 자세한 톤·구조·예시는 [`docs/blog-writing-guide.md`](docs/blog-writing-guide.md) 참고.

### 절대 금지
- ❌ "감성 한 컷 📸" 같은 **필러 섹션**.
- ❌ 본문에 **협찬/제공받음** 표현 (frontmatter 필드는 유지하되 본문 노출 X). 단, 고객 가이드나 법정 고지로 요구된 상단 1회 고지는 허용.
- ❌ 본문에 **수량/사이즈(mm)/가격** 표기.
- ❌ 본문에 **모유수유/직수/젖** 표현 — 봄이는 분유 수유 중. 단, 젖병/젖꼭지 같은 제품명은 허용.
- ❌ AI가 쓴 듯한 깔끔한 설명체 (`~에 도움이 됩니다` 등). 반드시 구어체 (`~거든요`, `~더라구요`).
- ❌ 억지 후킹/낚시성 제목.

### 사진/미디어 처리
- **PNG/JPG/GIF 전부 본문에 포함.** 한 장도 빠뜨리지 않음.
- **MP4 등 영상은 조용히 스킵.** 사용자가 직접 주입.
- **파일명 순서 = 본문 배치 순서.** 임의로 순서 바꾸지 않음.
- 보정 수치는 [`docs/photo-tone.md`](docs/photo-tone.md) 참고.

### 산출물 / 배포
- frontmatter는 **`draft: false`** 로 생성 (바로 발행 상태).
- **정적 export(`generate-naver.ts`)는 실행하지 않음.** 네이버 업로드는 라이브 페이지 `/naver/<slug>`(업로드 모드)에서 블록 단위로 복붙. 사진은 input 원본에서 직접 업로드, 영상은 `<!-- video: 설명 -->` 마커 위치에 직접 삽입(DIA 영상 가점).
- 작업 완료 시 **자동 git commit + push.** 매번 별도 요청 없이 진행.

### 코드 작업 시 (Astro 라우팅 주의)
- API endpoint는 `/srv/*` 경로에 둘 것. **`/api/*` 경로는 Vercel이 무조건 가로채서 Astro 라우팅이 동작하지 않음.**
