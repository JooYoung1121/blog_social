# 지나의 휴일 — Claude Code 진입점

## 이 레포에서 지나님은 명령어를 치지 않습니다

지나님은 **사진을 한 폴더에 모아두고 자연어로 말합니다.** `npm run ...` 은 Claude가 실행합니다.
지나님께 명령어를 치라고 안내하거나, 입력 파일 양식을 설명하며 작성을 요구하지 마세요.

**작업 시작 전 [`docs/talk-to-claude.md`](docs/talk-to-claude.md) 를 읽으세요.**
§4에 "새 글 요청을 받으면" 8단계 실행 규약이 있습니다. 그대로 따릅니다.

### 요청 → 동작 빠른 매핑

| 지나님 발화 | Claude 동작 |
|---|---|
| "새 글 쓸 거야 / 사진 여기 있어" | `intake` → 부족한 정보 **한 번에** 질문 → `notes.txt` 작성 → `keywords` → `generate-draft` → `lint` → 보고 → commit+push |
| "키워드 봐줘" | `npm run keywords -- --seed "<키워드>"` |
| "성과 정리했어" + 숫자 | `data/performance.csv` 기록 → `npm run perf-report` |
| "갱신할 글 있어?" | `npm run refresh` |
| "이 글 검사해줘" | `npm run lint:posts -- <파일>` |
| "네이버에 올릴게" | `/naver/<슬러그>` 링크 + 사진·영상 삽입 위치 안내 |

**항상 확인할 것:** 구매 형태(협찬/직구매/무상제공/체험단)와 체험단 가이드 유무. 추측 금지 — 법적·계약 문제입니다.

---

## 룰 정본

운영 규칙은 `AGENTS.md`와 `docs/` 문서가 정본입니다. 작업 전 `AGENTS.md`를 먼저 읽고, 연결된 가이드를 따르세요.

- `AGENTS.md` — Hard Rules, 폴더 구조, 환경변수
- `docs/talk-to-claude.md` — **자연어 사용법 + Claude 실행 규약**
- `docs/blog-writing-guide.md` — 톤·구조·SEO·금지 표현
- `docs/ai-friendly-guide.md` — AI 탭/GPT/Gemini 인용 친화 레이어
- `docs/writing-input-guide.md` — input 폴더 양식 (Claude가 채움)
- `docs/rebuild-2026H2.md` — 2026 하반기 시스템 구조와 전략
- `docs/author-profile.md` — 작성자/봄이/반려견 사실관계
- `docs/photo-tone.md` — 사진 보정 수치
- `docs/homefeed-strategy.md` — 홈피드 노출용 글

코드 룰의 단일 소스는 `scripts/lib/style-rules.ts`입니다. 문서와 코드가 충돌하면 이 파일을 먼저 확인하고 둘을 맞추세요.

Codex와 결과물을 비교하는 작업에서는 `docs/codex-workflow.md`도 확인하세요. `npm run generate-draft`는 Claude API 기반이므로 Codex 초안 비교용으로 쓰지 않습니다.

A/B 비교 모드(input 폴더에 `AB.txt` 마커)는 `docs/ab-comparison-protocol.md`를 따릅니다.
