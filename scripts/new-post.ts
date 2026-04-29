import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { processAndUpload, type UploadResult } from './upload-images.js';
import { PUBLISHING_RULES } from './lib/style-rules.js';
// generateNaverGuide는 PUBLISHING_RULES.generate_naver_guide 가 true일 때만 동적 import

interface PostConfig {
  inputDir: string;
  category: string;
  title?: string;
  description?: string;
  tags?: string[];
  sponsored?: boolean;
  sponsorInfo?: string;
  productLink?: string;
  noTone?: boolean;
}

function parseArgs(): PostConfig {
  const args = process.argv.slice(2);
  const config: PostConfig = {
    inputDir: '',
    category: 'daily-life',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        config.inputDir = args[++i];
        break;
      case '--category':
        config.category = args[++i];
        break;
      case '--title':
        config.title = args[++i];
        break;
      case '--description':
        config.description = args[++i];
        break;
      case '--tags':
        config.tags = args[++i].split(',').map((t) => t.trim());
        break;
      case '--sponsored':
        config.sponsored = true;
        break;
      case '--sponsor-info':
        config.sponsorInfo = args[++i];
        config.sponsored = true;
        break;
      case '--product-link':
        config.productLink = args[++i];
        break;
      case '--no-tone':
        config.noTone = true;
        break;
    }
  }

  if (!config.inputDir) {
    console.error(`
Usage: npm run new-post -- --input <dir> --category <category> [options]

Required:
  --input <dir>           사진이 있는 디렉토리 경로
  --category <category>   baby-products | parenting | daily-life | food | travel

Optional:
  --title <title>         글 제목
  --description <desc>    글 설명
  --tags <tag1,tag2>      태그 (쉼표 구분)
  --sponsored             협찬 글 여부
  --sponsor-info <info>   협찬 정보 (예: "브랜드명으로부터 제품을 협찬받아")
  --product-link <url>    제품 링크
  --no-tone               사진 톤 보정 비활성화 (기본: 보정 적용)
`);
    process.exit(1);
  }

  return config;
}

async function readOptionalFile(dir: string, filename: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(path.join(dir, filename), 'utf-8');
    return content.trim();
  } catch {
    return undefined;
  }
}

function generateSlug(title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${date}-${slug}`;
}

// 카테고리별 본문 구조 템플릿
const categoryTemplates: Record<string, (title: string, images: UploadResult[]) => string> = {
  'baby-products': (title, images) => {
    const photoBlocks = images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->`,
    );
    const mid = Math.ceil(photoBlocks.length / 3);
    return [
      '',
      '안녕하세요!',
      '지나의 휴일 지나입니다 :)',
      '',
      `<!-- 도입부: 이 제품을 사게 된 계기/고민 -->`,
      '',
      ...photoBlocks.slice(0, mid),
      '',
      `## 실제 사용 후기`,
      '',
      `<!-- 본론: 사용감, 장점, 아쉬운 점 솔직하게 -->`,
      '',
      ...photoBlocks.slice(mid, mid * 2),
      '',
      `## 이런 분께 추천해요`,
      '',
      `<!-- 추천 대상, 활용 팁 -->`,
      '',
      ...photoBlocks.slice(mid * 2),
      '',
      '---',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
    ].join('\n');
  },
  'parenting': (title, images) => {
    const photoBlocks = images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->`,
    );
    return [
      '',
      '안녕하세요!',
      '지나의 휴일 지나입니다 :)',
      '',
      `<!-- 도입부: 요즘 아이 성장/변화 이야기 -->`,
      '',
      ...photoBlocks,
      '',
      '---',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
    ].join('\n');
  },
  'food': (title, images) => {
    const photoBlocks = images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->`,
    );
    const mid = Math.ceil(photoBlocks.length / 2);
    return [
      '',
      '안녕하세요!',
      '지나의 휴일 지나입니다 :)',
      '',
      `<!-- 도입부: 방문 계기, 위치/분위기 -->`,
      '',
      ...photoBlocks.slice(0, mid),
      '',
      `## 메뉴 & 맛 후기`,
      '',
      `<!-- 주문한 메뉴, 맛 평가, 가성비 -->`,
      '',
      ...photoBlocks.slice(mid),
      '',
      '---',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
    ].join('\n');
  },
  'travel': (title, images) => {
    const photoBlocks = images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->`,
    );
    const third = Math.ceil(photoBlocks.length / 3);
    return [
      '',
      '안녕하세요!',
      '지나의 휴일 지나입니다 :)',
      '',
      `<!-- 도입부: 여행지 소개, 방문 동기 -->`,
      '',
      ...photoBlocks.slice(0, third),
      '',
      `## 코스 & 즐길거리`,
      '',
      `<!-- 본론: 동선, 볼거리, 체험 -->`,
      '',
      ...photoBlocks.slice(third, third * 2),
      '',
      `## 꿀팁 정리`,
      '',
      `<!-- 방문 팁: 주차, 시간, 준비물 등 -->`,
      '',
      ...photoBlocks.slice(third * 2),
      '',
      '---',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
    ].join('\n');
  },
};

// 기본 템플릿 (daily-life 등)
function defaultTemplate(title: string, images: UploadResult[]): string {
  return [
    '',
    '안녕하세요!',
    '지나의 휴일 지나입니다 :)',
    '',
    `<!-- 도입부: 오늘의 이야기 -->`,
    '',
    ...images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->`,
    ),
    '',
    '---',
    '',
    '오늘 포스팅은 여기서 마무리!',
    '궁금한 점은 댓글로 남겨주세요 😊',
    '그럼 안녕! 👋',
  ].join('\n');
}

function generateMarkdown(
  config: PostConfig,
  images: UploadResult[],
  slug: string,
): string {
  const title = config.title || 'TODO: 제목을 입력하세요';
  const description = config.description || 'TODO: 설명을 입력하세요';
  const date = new Date().toISOString().slice(0, 10);
  const tags = config.tags?.length ? config.tags : ['TODO'];
  const thumbnail = images[0]?.cloudinaryUrl || 'https://placehold.co/800x500';
  const imageUrls = images.map((i) => i.cloudinaryUrl);

  const frontmatter = [
    '---',
    `title: "${title}"`,
    `description: "${description}"`,
    `date: ${date}`,
    `category: ${config.category}`,
    `tags: [${tags.map((t) => `"${t}"`).join(', ')}]`,
    `thumbnail: "${thumbnail}"`,
    `images:`,
    ...imageUrls.map((url) => `  - "${url}"`),
    `sponsored: ${config.sponsored || false}`,
    config.sponsorInfo ? `sponsorInfo: "${config.sponsorInfo}"` : null,
    config.productLink ? `productLink: "${config.productLink}"` : null,
    `draft: false`,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  // 카테고리별 본문 구조 적용
  const templateFn = categoryTemplates[config.category] || defaultTemplate;
  const body = templateFn(title, images);

  return frontmatter + '\n' + body;
}

async function main() {
  const config = parseArgs();

  console.log('🚀 새 글 생성 시작!\n');

  // Read optional text files from input dir
  const titleFromFile = await readOptionalFile(config.inputDir, 'topic.txt');
  const notesFromFile = await readOptionalFile(config.inputDir, 'notes.txt');
  const productLinkFromFile = await readOptionalFile(config.inputDir, 'product-url.txt');
  const sponsorFromFile = await readOptionalFile(config.inputDir, 'sponsor.txt');

  if (titleFromFile && !config.title) config.title = titleFromFile;
  if (productLinkFromFile && !config.productLink) config.productLink = productLinkFromFile;
  if (sponsorFromFile && !config.sponsorInfo) {
    config.sponsorInfo = sponsorFromFile;
    config.sponsored = true;
  }

  // Generate slug
  const slug = generateSlug(config.title || 'untitled');
  console.log(`📝 Slug: ${slug}`);

  // Process images (톤 보정 기본 적용, --no-tone 시 비활성화)
  const tone = config.noTone ? false as const : undefined; // undefined → DEFAULT_TONE 사용
  let images: UploadResult[] = [];
  const photosDir = path.join(config.inputDir, 'photos');
  try {
    await fs.access(photosDir);
    images = await processAndUpload(photosDir, slug, tone);
  } catch {
    // Try input dir directly if no photos/ subfolder
    try {
      const files = await fs.readdir(config.inputDir);
      const hasImages = files.some((f) =>
        /\.(heic|jpg|jpeg|png|gif)$/i.test(f),
      );
      if (hasImages) {
        images = await processAndUpload(config.inputDir, slug, tone);
      } else {
        console.log('📷 사진 없이 진행합니다 (나중에 추가 가능)');
      }
    } catch {
      console.log('📷 사진 없이 진행합니다 (나중에 추가 가능)');
    }
  }

  // Generate markdown
  const markdown = generateMarkdown(config, images, slug);

  // Determine output path
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const postDir = path.resolve('src/content/posts', String(year), month);
  await fs.mkdir(postDir, { recursive: true });
  const postPath = path.join(postDir, `${slug}.md`);
  await fs.writeFile(postPath, markdown, 'utf-8');
  console.log(`\n✅ 포스트 생성: ${postPath}`);

  // Naver guide 생성은 룰에 따라 분기 (memory: feedback_no_naver_export.md)
  if (PUBLISHING_RULES.generate_naver_guide) {
    const { generateNaverGuide } = await import('./generate-naver.js');
    const naverPath = await generateNaverGuide({
      title: config.title || 'TODO: 제목',
      category: config.category,
      sponsored: config.sponsored || false,
      sponsorInfo: config.sponsorInfo,
      productLink: config.productLink,
      images,
      slug,
      notes: notesFromFile,
    });
    console.log(`✅ 네이버 가이드: ${naverPath}`);
  }

  console.log(`
📌 다음 단계:
1. ${postPath} 파일을 열어서 본문을 작성하세요 (draft: false 로 이미 발행 상태)
2. npm run lint:posts ${postPath} 로 룰 위반 검사
3. git add . && git commit && git push 로 발행!
`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
