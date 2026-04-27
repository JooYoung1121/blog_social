/**
 * generate-draft.ts
 *
 * AI 글 자동 생성 — Claude Opus 4.7 (1M context).
 *
 * 흐름:
 *   1. input/{slug}/ 폴더에서 topic, purchase, keywords, notes, photos 읽기
 *   2. 사진 Cloudinary 업로드 + 톤 보정 (upload-images.ts 재사용)
 *   3. style-rules.ts의 buildSystemPrompt() 로 룰 100% 반영된 시스템 프롬프트 생성
 *      → ephemeral 캐시 (매 요청마다 같은 프롬프트 → 90% 비용 절감)
 *   4. 사진을 멀티모달 입력으로 같이 보냄 (Claude가 사진을 보고 정확한 캡션 작성)
 *   5. Claude Opus 4.7 (adaptive thinking + xhigh effort) 호출 (streaming)
 *   6. 마크다운 추출 → src/content/posts/YYYY/MM/{slug}.md 저장
 *   7. lint 자동 실행 (룰 위반 검사)
 *
 * 사용:
 *   npm run generate-draft -- --input input/2026-04-27-제품명 --category baby-products
 *
 * 환경변수:
 *   ANTHROPIC_API_KEY=sk-... (필수)
 *   CLOUDINARY_*  (사진 업로드용)
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import {
  buildSystemPrompt,
  lintPostBody,
  type PurchaseType,
} from './lib/style-rules.js';
import { processAndUpload, type UploadResult } from './upload-images.js';

interface DraftConfig {
  inputDir: string;
  category: string;
  model?: string;
  noTone?: boolean;
  intent?: 'review' | 'compare' | 'info' | 'location' | 'diary';
  target?: 'search' | 'homefeed' | 'both';
}

function parseArgs(): DraftConfig {
  const args = process.argv.slice(2);
  const config: DraftConfig = {
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
      case '--model':
        config.model = args[++i];
        break;
      case '--intent':
        config.intent = args[++i] as DraftConfig['intent'];
        break;
      case '--target':
        config.target = args[++i] as DraftConfig['target'];
        break;
      case '--no-tone':
        config.noTone = true;
        break;
    }
  }
  if (!config.inputDir) {
    console.error(`
사용법:
  npm run generate-draft -- --input <dir> --category <category> [옵션]

필수:
  --input <dir>           입력 디렉토리 (topic.txt, photos/ 등 포함)
  --category <category>   baby-products | parenting | daily-life | food | travel

옵션:
  --intent <intent>       review | compare | info | location | diary (기본: review)
  --target <target>       search | homefeed | both (기본: search)
  --model <model-id>      claude-opus-4-7 (기본) | claude-sonnet-4-6 등
  --no-tone               사진 톤 보정 비활성화

환경변수:
  ANTHROPIC_API_KEY 필수 (.env 파일 또는 export)
`);
    process.exit(1);
  }
  return config;
}

async function readOpt(
  dir: string,
  filename: string,
): Promise<string | undefined> {
  try {
    const content = await fs.readFile(path.join(dir, filename), 'utf-8');
    return content.trim();
  } catch {
    return undefined;
  }
}

async function readInputs(dir: string) {
  const topic = await readOpt(dir, 'topic.txt');
  const purchase = await readOpt(dir, 'purchase.txt');
  const keywords = await readOpt(dir, 'keywords.txt');
  const notes = await readOpt(dir, 'notes.txt');
  const productUrl = await readOpt(dir, 'product-url.txt');
  const sponsor = await readOpt(dir, 'sponsor.txt');
  const guide = await readOpt(dir, 'client-guide.md');

  let mainKeyword: string | undefined;
  let subKeywords: string[] = [];
  if (keywords) {
    const lines = keywords.split('\n').map((l) => l.trim()).filter(Boolean);
    [mainKeyword, ...subKeywords] = lines;
  }

  // purchaseType 검증
  const validPurchaseTypes: PurchaseType[] = [
    'self-purchased',
    'sponsored',
    'gifted',
    'service-experience',
  ];
  let purchaseType: PurchaseType = 'self-purchased';
  if (purchase && validPurchaseTypes.includes(purchase as PurchaseType)) {
    purchaseType = purchase as PurchaseType;
  } else if (purchase) {
    console.warn(
      `⚠️  purchase.txt 값 "${purchase}"가 유효하지 않음 — self-purchased로 처리. 유효 값: ${validPurchaseTypes.join(', ')}`,
    );
  }

  return {
    topic,
    purchaseType,
    mainKeyword,
    subKeywords,
    notes,
    productUrl,
    sponsor,
    clientGuide: guide,
  };
}

function generateSlug(title: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 50);
  return `${date}-${slug || 'untitled'}`;
}

function buildUserPrompt(
  config: DraftConfig,
  inputs: Awaited<ReturnType<typeof readInputs>>,
  images: UploadResult[],
): Anthropic.MessageParam[] {
  const today = new Date().toISOString().slice(0, 10);
  const content: Anthropic.ContentBlockParam[] = [];

  // 1. 지시문 + 메타 정보
  content.push({
    type: 'text',
    text: [
      `다음 정보로 "지나의 휴일" 블로그 글 한 편을 작성해주세요. 시스템 프롬프트의 모든 룰을 정확히 따라주세요.`,
      ``,
      `## 주제`,
      inputs.topic || '(미지정 — 사진과 메모를 보고 적절한 제목 만들어주세요)',
      ``,
      `## 메인 키워드`,
      inputs.mainKeyword || '(미지정)',
      ``,
      `## 서브 키워드 (자연스럽게 1~2회씩 녹여주세요)`,
      inputs.subKeywords.length > 0 ? inputs.subKeywords.join(', ') : '(없음)',
      ``,
      `## 사용자가 적어준 메모 (가장 중요 — 이 디테일을 살려서 진짜 후기 톤으로)`,
      inputs.notes || '(메모 없음 — 사진을 보고 추정해서 작성)',
      ``,
      inputs.productUrl ? `## 제품 링크\n${inputs.productUrl}\n` : '',
      `## 제공된 사진 ${images.length}장`,
      `사진은 본문에 모두 포함시켜야 하며, 원본 순서대로 1~2장씩 배치 후 1~2줄 짧은 텍스트로 설명하세요. 사진 3장 이상 연속 절대 금지. 아래에 각 사진을 보여드리니 무엇이 찍혀있는지 정확히 파악해서 캡션을 써주세요.`,
      ``,
      `## 출력 형식`,
      '아래 정확한 마크다운 형식으로만 출력해주세요. ```markdown 코드블록 안에 frontmatter + 본문을 넣고, 다른 설명은 일체 금지합니다.',
      ``,
      '```markdown',
      '---',
      'title: "글 제목 (25자 이내, 메인 키워드를 앞쪽에)"',
      'description: "메타 설명 (120~160자)"',
      `date: ${today}`,
      `category: ${config.category}`,
      'tags: ["태그1", "태그2", "..."]  # 5~7개',
      `mainKeyword: "${inputs.mainKeyword || ''}"`,
      `purchaseType: ${inputs.purchaseType}`,
      `intent: ${config.intent || 'review'}`,
      `target: ${config.target || 'search'}`,
      `thumbnail: "${images[0]?.cloudinaryUrl || ''}"`,
      'images:',
      ...images.map((img) => `  - "${img.cloudinaryUrl}"`),
      inputs.sponsor ? `sponsorInfo: "${inputs.sponsor.replace(/"/g, "'")}"` : '',
      inputs.productUrl ? `productLink: "${inputs.productUrl}"` : '',
      'sponsored: ' + (inputs.purchaseType === 'sponsored' ? 'true' : 'false'),
      'draft: false',
      '---',
      '',
      '안녕하세요!',
      '지나의 휴일입니다 :)',
      '',
      '(여기서부터 본문 — 시스템 프롬프트의 톤·구조·금지패턴 100% 준수)',
      '...',
      '',
      '오늘 포스팅은 여기서 마무리!',
      '궁금한 점은 댓글로 남겨주세요 😊',
      '그럼 안녕! 👋',
      '```',
      '',
      '이제 사진을 보여드립니다:',
    ]
      .filter(Boolean)
      .join('\n'),
  });

  // 2. 사진 — Claude가 시각적으로 파악해서 정확한 캡션 작성
  for (const [idx, img] of images.entries()) {
    content.push({
      type: 'text',
      text: `\n[사진 ${String(idx + 1).padStart(2, '0')}] 본문 마크다운 시 사용할 URL: ${img.cloudinaryUrl}`,
    });
    content.push({
      type: 'image',
      source: { type: 'url', url: img.cloudinaryUrl },
    });
  }

  return [{ role: 'user', content }];
}

function extractMarkdown(text: string): string {
  // ```markdown ... ``` 코드블록 안에 있으면 추출
  const fenceMatch = text.match(/```(?:markdown|md)?\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return text.trim();
}

async function main() {
  const config = parseArgs();
  console.log('🚀 AI 글 자동 생성 시작\n');

  // 1) 입력 읽기
  const inputs = await readInputs(config.inputDir);
  console.log('📋 입력 읽기 완료');
  console.log(`   주제: ${inputs.topic || '(미지정)'}`);
  console.log(`   구매 형태: ${inputs.purchaseType}`);
  console.log(`   메인 키워드: ${inputs.mainKeyword || '(미지정)'}`);
  console.log(`   서브 키워드: ${inputs.subKeywords.length}개`);
  console.log(`   메모: ${inputs.notes ? inputs.notes.length + '자' : '(없음)'}`);
  console.log(`   체험단 가이드: ${inputs.clientGuide ? '있음 (최우선 반영)' : '없음'}`);

  // 2) 사진 업로드
  const slug = generateSlug(inputs.topic || 'untitled');
  console.log(`\n📝 Slug: ${slug}`);

  let images: UploadResult[] = [];
  const photosDir = path.join(config.inputDir, 'photos');
  const tone = config.noTone ? (false as const) : undefined;
  try {
    await fs.access(photosDir);
    images = await processAndUpload(photosDir, slug, tone);
  } catch {
    try {
      const files = await fs.readdir(config.inputDir);
      const hasImages = files.some((f) => /\.(heic|jpg|jpeg|png)$/i.test(f));
      if (hasImages) {
        images = await processAndUpload(config.inputDir, slug, tone);
      }
    } catch {
      // pass
    }
  }
  if (images.length === 0) {
    console.log('📷 사진 없음 — 텍스트만으로 생성');
  }

  // 3) 시스템 프롬프트 (캐시됨)
  const systemPrompt = buildSystemPrompt({
    category: config.category,
    purchaseType: inputs.purchaseType,
    intent: config.intent || 'review',
    target: config.target || 'search',
    productName: inputs.topic,
    mainKeyword: inputs.mainKeyword,
    subKeywords: inputs.subKeywords,
    notes: inputs.notes,
    clientGuide: inputs.clientGuide,
  });
  console.log(`\n🧠 시스템 프롬프트: ${systemPrompt.length}자 (ephemeral 캐시 적용)`);

  // 4) Claude 호출
  const client = new Anthropic();
  const model = config.model || 'claude-opus-4-7';
  console.log(`🤖 모델: ${model}`);
  console.log(`📤 호출 중... (streaming)\n`);
  console.log('─'.repeat(60));

  const messages = buildUserPrompt(config, inputs, images);

  const stream = client.messages.stream({
    model,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: [
      {
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages,
  });

  stream.on('text', (delta) => {
    process.stdout.write(delta);
  });

  const finalMessage = await stream.finalMessage();
  console.log('\n' + '─'.repeat(60));

  // 5) 응답 추출
  let draft = '';
  for (const block of finalMessage.content) {
    if (block.type === 'text') draft += block.text;
  }
  draft = extractMarkdown(draft);

  // 6) 토큰 사용 보고
  const usage = finalMessage.usage;
  const totalIn =
    usage.input_tokens +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0);
  console.log(`\n📊 토큰 사용`);
  console.log(`   입력 (uncached):    ${usage.input_tokens.toLocaleString()}`);
  console.log(`   캐시 작성:          ${(usage.cache_creation_input_tokens || 0).toLocaleString()}`);
  console.log(`   캐시 읽기:          ${(usage.cache_read_input_tokens || 0).toLocaleString()}`);
  console.log(`   총 입력:            ${totalIn.toLocaleString()}`);
  console.log(`   출력:               ${usage.output_tokens.toLocaleString()}`);

  // 7) 저장
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const postDir = path.resolve('src/content/posts', String(year), month);
  await fs.mkdir(postDir, { recursive: true });
  const postPath = path.join(postDir, `${slug}.md`);
  await fs.writeFile(postPath, draft, 'utf-8');
  console.log(`\n✅ 저장: ${postPath}`);

  // 8) Lint 자동 실행
  const issues = lintPostBody(draft, {
    mainKeyword: inputs.mainKeyword,
    purchaseType: inputs.purchaseType,
  });
  if (issues.length === 0) {
    console.log(`✅ Lint: 룰 위반 없음 — 바로 발행 가능`);
  } else {
    const errors = issues.filter((i) => i.level === 'error');
    const warnings = issues.filter((i) => i.level === 'warning');
    console.log(
      `⚠️  Lint: 에러 ${errors.length}개 / 경고 ${warnings.length}개 — 수정 필요`,
    );
    for (const issue of issues) {
      const icon = issue.level === 'error' ? '❌' : '⚠️ ';
      console.log(`   ${icon} [${issue.code}] ${issue.message}`);
    }
  }

  console.log(`\n📌 다음 단계:`);
  console.log(`   1. ${postPath} 열어서 검토/수정`);
  console.log(`   2. npm run dev → 미리보기`);
  console.log(`   3. git add . && git commit && git push`);
}

main().catch((err) => {
  if (err instanceof Anthropic.AuthenticationError) {
    console.error('\n❌ ANTHROPIC_API_KEY 환경변수가 없거나 유효하지 않습니다.');
    console.error('   .env 파일에 ANTHROPIC_API_KEY=sk-... 추가하세요.');
  } else if (err instanceof Anthropic.RateLimitError) {
    console.error('\n❌ Rate limit — 잠시 후 다시 시도하세요.');
  } else if (err instanceof Anthropic.APIError) {
    console.error(`\n❌ Claude API 에러 (${err.status}):`, err.message);
  } else {
    console.error('\n❌ Error:', err);
  }
  process.exit(1);
});
