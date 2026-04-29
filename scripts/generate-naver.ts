import fs from 'fs/promises';
import path from 'path';
import type { UploadResult } from './upload-images.js';

interface NaverGuideConfig {
  title: string;
  category: string;
  sponsored: boolean;
  sponsorInfo?: string;
  productLink?: string;
  images: UploadResult[];
  slug: string;
  notes?: string;
}

const categoryLabels: Record<string, string> = {
  'baby-products': '육아용품 리뷰',
  parenting: '육아일기',
  'daily-life': '일상',
  food: '맛집/요리',
  travel: '여행/나들이',
};

export async function generateNaverGuide(config: NaverGuideConfig): Promise<string> {
  const { title, category, sponsored, sponsorInfo, productLink, images, slug, notes } = config;

  const lines: string[] = [
    `# 네이버 블로그 업로드 가이드`,
    ``,
    `> 글 제목: ${title}`,
    `> 카테고리: ${categoryLabels[category] || category}`,
    `> 생성일: ${new Date().toISOString().slice(0, 10)}`,
    ``,
  ];

  // 협찬 고지
  if (sponsored && sponsorInfo) {
    lines.push(`## ⚠️ 협찬 고지 (본문 맨 앞에 삽입)`);
    lines.push('```');
    lines.push(`※ 본 포스팅은 ${sponsorInfo}으로 작성된 리뷰입니다.`);
    lines.push('```');
    lines.push('');
  }

  // 사진 업로드 순서
  if (images.length > 0) {
    lines.push(`## 📷 사진 업로드 순서 (총 ${images.length}장)`);
    lines.push('');
    images.forEach((img, i) => {
      const label = i === 0 ? ' ← 대표 이미지(썸네일)' : '';
      lines.push(
        `${i + 1}. \`${img.originalName}\` → photo_${String(i + 1).padStart(2, '0')}${label}`,
      );
    });
    lines.push('');
  }

  // 본문 템플릿
  lines.push(`## 📝 본문 텍스트 (복사해서 네이버 에디터에 붙여넣기)`);
  lines.push('');
  lines.push('```');
  lines.push(`안녕하세요!`);
  lines.push(`지나의 휴일 지나입니다 :)`);
  lines.push('');
  lines.push(`오늘은 ${title}에 대해 이야기해볼게요!`);
  lines.push('');

  if (notes) {
    lines.push(`[메모 참고]`);
    lines.push(notes);
    lines.push('');
  }

  lines.push(`<!-- 여기에 본문 작성 -->`);
  lines.push('');

  // 사진 배치 가이드
  images.forEach((img, i) => {
    lines.push(`📷 사진 ${i + 1} 삽입 (${img.originalName})`);
    lines.push(`[사진 ${i + 1} 설명 작성]`);
    lines.push('');
  });

  lines.push(`---`);
  lines.push('');
  lines.push(`오늘 포스팅은 여기서 마무리!`);
  lines.push(`더 궁금하신 점은 댓글로 남겨주세요 😊`);
  lines.push(`그럼 안녕! 👋`);
  lines.push('```');
  lines.push('');

  // 제품 링크
  if (productLink) {
    lines.push(`## 🔗 제품 링크`);
    lines.push(`\`${productLink}\``);
    lines.push('');
  }

  // 네이버 에디터 팁
  lines.push(`## 💡 네이버 에디터 꾸미기 팁`);
  lines.push('');
  lines.push(`- 제목: **글자 크기 24pt**, 가운데 정렬`);
  lines.push(`- 소제목: **글자 크기 18pt**, 볼드`);
  lines.push(`- 본문: 기본 크기, 줄간격 1.8`);
  lines.push(`- 사진: 가로 정렬 (2장 나란히는 50%씩)`);
  lines.push(`- 구분선: 소제목 사이에 얇은 구분선 추가`);

  const content = lines.join('\n');

  // Write to output
  const outputDir = path.resolve('scripts/output/naver');
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `${slug}.md`);
  await fs.writeFile(outputPath, content, 'utf-8');

  return outputPath;
}

// CLI entry point
if (process.argv[1]?.includes('generate-naver')) {
  console.log('ℹ️  네이버 가이드는 new-post 스크립트를 통해 자동 생성됩니다.');
  console.log('   npm run new-post -- --input <dir> --category <category>');
}
