# A/B 비교 프로토콜 — Claude vs Codex

> 같은 input으로 두 AI 도구가 글을 어떻게 다르게 쓰는지 비교. 어떤 패턴이 효과적인지 데이터로 검증한 뒤, 우리 룰/프롬프트를 더 강한 쪽에 맞춰 정착시키는 게 목표.

---

## 0. 적용 기간 / 범위

- **다음 10~15편의 글**에 한정 (2026-05-05 시작)
- 모든 글이 아니라, **input 폴더에 `AB.txt` 마커 파일이 있을 때만** 발동
- 기간 종료 후 누적 데이터로 결론 도출 → 정본 룰 갱신

---

## 1. 입력 공유 룰

두 도구가 **같은 input 폴더 하나**를 공유합니다. 입력 분기 X.

```
input/2026-05-10-신생아세제추천/
├── AB.txt                  ← 마커 파일 (이게 있으면 A/B 모드)
├── photos/                 ← 두 도구가 같은 사진 사용
├── topic.txt
├── purchase.txt
├── keywords.txt
├── notes.txt
├── product-url.txt
├── sponsor.txt             (sponsored일 때만)
└── client-guide.md         (sponsored일 때만)
```

- 사진 / 메모 / 가이드는 **한 번만 준비**해서 두 도구가 같은 입력으로 작업
- 두 도구 모두 정본 가이드(`AGENTS.md`, `docs/blog-writing-guide.md`, `docs/ai-friendly-guide.md`)를 따라야 함
- 입력이 같다는 게 핵심 — 결과 차이가 도구 차이로만 설명 가능해야 함

---

## 2. 출력 분리 룰

같은 input에서 **두 글이 만들어집니다**. 슬러그 충돌 방지를 위해 다음 룰을 따릅니다:

### 2-1. 슬러그 접미사
```
src/content/posts/2026/05/2026-05-10-<주제슬러그>-claude.md
src/content/posts/2026/05/2026-05-10-<주제슬러그>-codex.md
```

- 둘 다 끝에 도구 식별자(`-claude`, `-codex`)를 붙임
- 자연스러운 부제목으로 갈리는 건 권장 X (식별자가 명시적이어야 결과 추적 쉬움)

### 2-2. frontmatter 필드 — `abVariant`
```yaml
abVariant: "claude"   # 또는 "codex"
abPair: "2026-05-10-신생아세제추천"  # 같은 input의 페어 식별자
```

- `abVariant` — 어느 도구가 썼는지
- `abPair` — 페어 묶음 키 (input 폴더명과 동일)
- 두 필드는 결과 측정 시 페어 매칭에 사용

### 2-3. 제목/description은 자유
- 도구마다 다른 제목/description으로 가도 OK (자연스러운 차이)
- 단 둘 다 메인 키워드는 포함 (정본 룰)

---

## 3. Cloudinary 자원 공유

이미지 업로드는 **한 번만**. 두 도구가 같은 Cloudinary URL을 공유합니다.

### 운영 흐름
1. **먼저 작업하는 도구**가 `npm run new-post`를 실행 → 사진을 Cloudinary `blog/<year>/<month>/<slug>` 폴더에 업로드
2. **두 번째 도구**는 첫 글의 `images:` frontmatter 배열을 그대로 복사. 재업로드 X.
3. Cloudinary 폴더 슬러그는 **공통 부분**(접미사 제외)으로 통일하거나, 한쪽 슬러그를 공유

### 주의
- `npm run new-post`는 슬러그별로 새 폴더 만듦. A/B 모드에선 두 번째 도구가 사진 업로드 단계를 **건너뛰고**, 마크다운만 직접 작성해야 함.
- 또는 두 글이 다른 Cloudinary 폴더를 가져도 결과 측정에 영향 없음 (비용/시간 차이만).
- 권장: **한 폴더 공유** — 깔끔하고 비용 절약.

---

## 4. 평가 지표 (글별 측정)

| 지표 | 측정 위치 | 측정 시점 |
|---|---|---|
| **AI 탭 인용** | 네이버 AI 탭에 노출/인용되는지 | 발행 후 1주 / 2주 / 4주 |
| **GPT/Gemini/Perplexity 인용** | 해당 키워드로 검색해서 출처로 잡히는지 | 발행 후 2주 / 4주 |
| **네이버 검색 상위 노출** | 메인 키워드 검색 시 순위 | 발행 후 1주 / 2주 / 4주 |
| **네이버 홈피드 노출** | 발행 후 홈피드에 발견됐는지 | 발행 후 1주 |
| **체류시간 / 완독률** | Vercel Analytics + 네이버 통계 | 4주 누적 |
| **공감 / 댓글 / 스크랩** | 네이버 블로그 통계 | 4주 누적 |
| **외부 유입** | Vercel Analytics referrer | 4주 누적 |

---

## 5. 결과 누적 — `docs/ab-results.md`

지표 측정 결과는 별도 파일에 누적 표로 기록합니다. (이 문서는 프로토콜만, 결과는 ab-results.md에)

표 예시:

```markdown
| abPair | 변형 | 발행일 | AI 탭 (1w/2w/4w) | 네이버 상위 (1w/4w) | 홈피드 | 체류 | 공감 | 댓글 |
|---|---|---|---|---|---|---|---|---|
| 2026-05-10-신생아세제추천 | claude | 2026-05-10 | -/-/- | -/- | - | - | - | - |
| 2026-05-10-신생아세제추천 | codex  | 2026-05-10 | -/-/- | -/- | - | - | - | - |
```

---

## 6. 결론 도출 기준

### 정량
- **10편 이상 페어 누적** 시 통계적 비교 시작
- **한 도구가 7개 이상 지표에서 우세**하면 그 도구의 패턴을 정본으로 정착
- 동률 또는 6:6 같은 분포면 **케이스별 분류** (체험단 글 vs 일상 글, 리뷰 vs 정보형 등)

### 정성
- 매 페어마다 사람 독자 1~2명에게 블라인드 평가 의뢰 (선택)
- 두 글 중 어느 쪽이 더 자연스러운지, 진심 담겨 보이는지

---

## 7. 도구별 관찰 메모 (글이 쌓이면 업데이트)

### Claude (Claude Code)
- _첫 페어 후 채울 것_

### Codex
- _첫 페어 후 채울 것_

### 공통 관찰
- _첫 페어 후 채울 것_

---

## 8. AB 모드 input 폴더의 `AB.txt` 마커 표준

각 input 폴더 루트에 둡니다. 두 도구 모두 이걸 보고 A/B 모드임을 인식해야 합니다.

```
AB MODE
- 두 도구(Claude / Codex) 모두 이 폴더로 작성
- 슬러그 접미사: -claude / -codex
- frontmatter abVariant / abPair 필수
- 사진 업로드는 먼저 작업하는 도구가 한 번만 (Cloudinary 폴더 공유)
- abPair: <이 폴더 이름과 동일하게>
```

---

## 9. 작업 흐름 (한 페어 만드는 표준 절차)

```
1) input 폴더 준비 (사진 + notes + AB.txt)

2) 첫 도구 작업
   - npm run new-post -- --input input/<...> --category <...>
   - 본문 작성, lint, build
   - 슬러그 끝 -claude 또는 -codex 로 파일명 수정 (또는 처음부터 그렇게 생성)
   - frontmatter abVariant / abPair 추가
   - commit

3) 두 번째 도구 작업
   - 첫 글의 frontmatter images 배열 복사
   - npm run new-post 사진 업로드 단계 건너뛰기
   - 본문은 새로 작성 (정본 룰 + 자기 도구 스타일)
   - 슬러그 끝 반대 접미사
   - frontmatter abVariant / abPair 추가
   - commit

4) 두 글 모두 발행 → 측정 시작
   - 발행 후 1주/2주/4주 시점에 docs/ab-results.md 갱신
```

---

## 10. 관련 문서

- `AGENTS.md` — 진입점
- `docs/blog-writing-guide.md` — 톤/구조/SEO 정본
- `docs/ai-friendly-guide.md` — AI 탭 / GPT / Gemini 친화 (작성 중)
- `docs/codex-workflow.md` — Codex 일반 흐름 (A/B 모드 시 이 프로토콜이 우선)
- `docs/ab-results.md` — 누적 측정 결과 (글이 쌓이면 생성)
