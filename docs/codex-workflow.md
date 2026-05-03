# Codex 작업 흐름

> 이 문서는 Claude Code 메모리에서 옮겨온 가이드를 Codex가 실제 작업에 쓰는 방법을 정리한 runbook입니다. 글 품질 비교를 할 때는 특히 `npm run generate-draft`를 바로 실행하지 않도록 주의합니다.

---

## 1. Codex가 읽는 기준

Codex는 Claude Code의 내부 메모리를 직접 읽지 않습니다. 대신 레포 안에 문서화된 규칙을 기준으로 작업합니다.

작업 시작 시 읽는 순서:

1. `AGENTS.md` — 전체 진입점과 Hard Rules
2. `docs/blog-writing-guide.md` — 톤, 구조, 사진 배치, SEO, 금지 규칙
3. `docs/author-profile.md` — 작성자, 봄이, 반려견 정보
4. `docs/photo-tone.md` — 사진 보정 수치
5. `docs/homefeed-strategy.md` — `target: homefeed` 글일 때 추가 확인
6. `docs/writing-input-guide.md` — input 폴더 형식과 작성 후 체크리스트

코드 기준은 `scripts/lib/style-rules.ts`입니다. 문서와 코드가 충돌하면 먼저 코드를 확인하고, 필요한 경우 문서와 코드를 함께 고칩니다.

---

## 2. Claude와 공정하게 비교하는 흐름

`npm run generate-draft`는 내부에서 Claude API를 호출합니다. Codex 결과물과 Claude 결과물을 비교하려면 Codex 작업에서는 이 명령으로 본문을 생성하지 않습니다.

Codex 비교용 권장 흐름:

1. 사용자가 상품 링크, 주제, 사진 폴더, 구매 형태, 메모를 제공합니다.
2. Codex가 `AGENTS.md`와 `docs/` 가이드를 읽고 글 방향을 정합니다.
3. 제품 링크가 있으면 공식 페이지나 판매 페이지에서 사실 정보만 확인합니다.
4. 사진은 파일명 순서대로 확인하고, 영상은 조용히 제외합니다.
5. `npm run new-post -- --input <input> --category <category>`로 사진 업로드와 Markdown 뼈대를 만듭니다.
6. 생성된 Markdown을 Codex가 직접 다시 작성합니다.
7. `npm run lint:posts -- <post>`로 글쓰기 룰을 확인합니다.
8. `npm run build`로 Astro 빌드를 확인합니다.
9. 이상 없으면 commit + push까지 진행합니다.

Claude 결과물과 비교할 때는 같은 input 폴더로 Claude Code 쪽에서 `npm run generate-draft`를 실행하고, Codex 쪽은 위 흐름으로 직접 작성한 Markdown을 사용합니다.

---

## 3. 상품 링크와 검색 사용

상품 링크가 있을 때 Codex는 다음 원칙을 지킵니다.

- 공식 상품명, 브랜드명, 기능명처럼 객관적인 사실만 확인합니다.
- 판매 페이지 문구를 길게 베끼지 않습니다.
- 가격, 수량, 사이즈(mm)는 본문에 쓰지 않습니다.
- 체험단 가이드가 있으면 가이드의 필수 키워드와 멘션을 우선합니다.

일반 웹 열람이 막히거나 JS 렌더링 때문에 내용이 비어 있으면 `insane-search` 플러그인이 사용 가능한 세션에서 다음 순서로 확인합니다.

1. 공개 엔드포인트 또는 모바일 URL
2. Jina Reader 같은 가벼운 대체 경로
3. OGP/JSON-LD 메타데이터
4. 마지막으로 브라우저 렌더링

로그인이나 결제가 필요한 정보는 추정하지 않고 사용자에게 필요한 정보를 요청합니다.

---

## 4. Codex 초안 작성 기준

Codex가 본문을 직접 쓸 때의 체크리스트:

- 인사말은 `안녕하세요! 지나의 휴일 지나입니다 :)`를 사용합니다.
- 첫 3줄은 제품 설명보다 구체적인 고민이나 에피소드로 시작합니다.
- 소제목은 명사형이 아니라 이야기 문장으로 씁니다.
- 사진은 1~2장 뒤에 반드시 짧은 설명을 붙입니다.
- 제공된 이미지 파일은 영상 제외 전부 사용합니다.
- 메인 키워드는 5~7회만 자연스럽게 반복합니다.
- 본문 길이는 공백 제외 1,500~2,000자를 목표로 합니다.
- 본문에 협찬/제공받음, 가격, 수량, 사이즈(mm), 모유수유/직수/젖 표현을 쓰지 않습니다.
- 단, 고객 가이드나 법정 고지로 요구된 무상 제공 고지는 상단 1회만 허용합니다.
- 마지막은 `오늘 포스팅은 여기서 마무리! 궁금한 점은 댓글로 남겨주세요 😊 그럼 안녕! 👋` 흐름으로 닫습니다.

---

## 5. 검증과 배포

글 작성 후 최소 검증:

```bash
npm run lint:posts -- src/content/posts/YYYY/MM/slug.md
npm run build
```

이미지 업로드나 빌드에 실패하면 원인을 수정한 뒤 다시 검증합니다. 검증이 끝나면 자동 배포 규칙에 따라 commit + push까지 진행합니다.
