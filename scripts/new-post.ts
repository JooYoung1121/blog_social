import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { processAndUpload, type UploadResult } from './upload-images.js';
import { generateNaverGuide } from './generate-naver.js';

interface PostConfig {
  inputDir: string;
  category: string;
  title?: string;
  description?: string;
  tags?: string[];
  sponsored?: boolean;
  sponsorInfo?: string;
  productLink?: string;
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
    `draft: true`,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  const body = [
    '',
    '안녕하세요!',
    '지나의 휴일입니다 :)',
    '',
    '<!-- TODO: 본문을 작성하세요 -->',
    '',
    ...images.map(
      (img, i) =>
        `![photo_${String(i + 1).padStart(2, '0')}](${img.cloudinaryUrl})\n\n<!-- 사진 ${i + 1} 설명 -->\n`,
    ),
    '---',
    '',
    '오늘 포스팅은 여기서 마무리!',
    '더 궁금하신 점은 댓글로 남겨주세요 😊',
    '그럼 안녕! 👋',
  ].join('\n');

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

  // Process images
  let images: UploadResult[] = [];
  const photosDir = path.join(config.inputDir, 'photos');
  try {
    await fs.access(photosDir);
    images = await processAndUpload(photosDir, slug);
  } catch {
    // Try input dir directly if no photos/ subfolder
    try {
      const files = await fs.readdir(config.inputDir);
      const hasImages = files.some((f) =>
        /\.(heic|jpg|jpeg|png)$/i.test(f),
      );
      if (hasImages) {
        images = await processAndUpload(config.inputDir, slug);
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

  // Generate Naver guide
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

  console.log(`
📌 다음 단계:
1. ${postPath} 파일을 열어서 본문을 작성하세요
2. frontmatter의 draft: true → false 로 변경
3. git add . && git commit && git push 로 발행!
`);
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
