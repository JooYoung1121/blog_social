/**
 * og-default.png 빌드 스크립트
 * 글 페이지가 아닌 페이지(홈/카테고리/태그/아카이브 등)의 OG 이미지로 사용.
 * SVG → PNG 변환 (sharp)
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const outPath = resolve(process.cwd(), 'public/og-default.png');
mkdirSync(dirname(outPath), { recursive: true });

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f5e6d8"/>
      <stop offset="100%" stop-color="#faf8f5"/>
    </linearGradient>
    <linearGradient id="title" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3d3225"/>
      <stop offset="100%" stop-color="#d4956a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- decorative circles -->
  <circle cx="120" cy="120" r="60" fill="#d4956a" fill-opacity="0.12"/>
  <circle cx="1080" cy="510" r="90" fill="#d4956a" fill-opacity="0.08"/>

  <!-- eyebrow -->
  <text x="600" y="200" font-family="sans-serif" font-size="28" font-weight="600"
        text-anchor="middle" fill="#d4956a" letter-spacing="2">육아 · 일상 · 솔직 리뷰</text>

  <!-- title -->
  <text x="600" y="330" font-family="serif" font-size="120" font-weight="700"
        text-anchor="middle" fill="url(#title)">지나의 휴일</text>

  <!-- tagline -->
  <text x="600" y="410" font-family="sans-serif" font-size="34"
        text-anchor="middle" fill="#7a6e5f">봄이와 함께하는 매일,</text>
  <text x="600" y="455" font-family="sans-serif" font-size="34"
        text-anchor="middle" fill="#7a6e5f">그리고 직접 써본 솔직한 리뷰</text>

  <!-- url -->
  <text x="600" y="560" font-family="sans-serif" font-size="22" font-weight="500"
        text-anchor="middle" fill="#a89b8c">jinas-holiday.vercel.app</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(outPath);
console.log(`✅ OG default image generated → ${outPath}`);
