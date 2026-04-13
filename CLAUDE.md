# 지나의 휴일 — 블로그 아카이브 시스템

## 프로젝트 개요
네이버 블로그 "지나의 휴일"(https://blog.naver.com/snf00467)의 글 작성 + 아카이빙 시스템.
Astro 기반 개인 웹 블로그 + 네이버 블로그 복붙 가이드를 동시 생성.

## 기술 스택
- **프레임워크:** Astro 5.x (Content Collections)
- **이미지:** Cloudinary (HEIC→JPG 변환 후 업로드)
- **배포:** Vercel (git push → 자동 배포)

## 새 글 작성 방법
```bash
npm run new-post -- --input <사진폴더> --category <카테고리> [옵션]
```

카테고리: `baby-products` | `parenting` | `daily-life` | `food` | `travel`

옵션:
- `--title "제목"`, `--description "설명"`, `--tags "태그1,태그2"`
- `--sponsor-info "브랜드명으로부터 협찬받아"`, `--product-link "URL"`

또는 input 폴더에 `topic.txt`, `notes.txt`, `product-url.txt`, `sponsor.txt` 파일을 넣으면 자동 인식.

## 글쓰기 스타일 규칙
- 인사말: "안녕하세요! 지나의 휴일입니다 :)"
- 마무리: "오늘 포스팅은 여기서 마무리! 궁금한 점은 댓글로 남겨주세요 😊 그럼 안녕! 👋"
- 톤: 친근한 대화체, 본인 경험 기반, 이모지 적절히 사용
- SEO: 본문 2000자+, 메인 키워드 3~7회, 소제목 구조화, 내부 링크 2~3개

## 폴더 구조
- `src/content/posts/YYYY/MM/` — Markdown 포스트 (날짜별 정리)
- `src/pages/posts/[...slug].astro` — 웹 블로그 글 페이지
- `src/pages/naver/[...slug].astro` — 네이버 복붙용 클린 HTML
- `scripts/` — CLI 도구 (new-post, upload-images, generate-naver)

## 환경변수 (.env)
```
CLOUDINARY_CLOUD_NAME=xxx
CLOUDINARY_API_KEY=xxx
CLOUDINARY_API_SECRET=xxx
```
