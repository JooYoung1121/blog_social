/**
 * keyword-research.ts
 *
 * 메인 키워드 후보를 "기회점수" 순으로 뽑고, 그 키워드로 검색하는 사람이
 * 실제로 궁금해할 질문형 소제목을 생성한다.
 *
 * 왜 질문까지 뽑는가:
 *   2026 하반기 네이버의 실질 KPI는 검색 순위가 아니라 AI 브리핑 인용수다.
 *   AI 브리핑은 "질문 → 자기완결 답변" 덩어리 단위로 인용한다.
 *   따라서 키워드 리서치의 산출물이 명사구 목록이 아니라
 *   **소제목으로 바로 쓸 수 있는 질문 4~6개**여야 한다.
 *   (docs/rebuild-2026H2.md §2.3, docs/blog-writing-guide.md §7)
 *
 * 기회점수 = 월간검색수 / 블로그문서수 × 1000
 *   검색량이 있으면서 아직 문서가 적은 키워드가 높게 나온다.
 *   육아용품처럼 문서수가 많은 영역은 조합 2단계 이상으로 내려가야
 *   점수가 살아난다 — 그 판단을 수치로 보여주는 게 목적.
 *
 * 사용:
 *   npm run keywords -- --seed "실온이유식"
 *   npm run keywords -- --seed "실온이유식" --seed "중기이유식" --top 15
 *   npm run keywords -- --seed "강아지 관절영양제" --out input/2026-10-01-제품명
 *
 * 필요 환경변수 (.env):
 *   NAVER_AD_CUSTOMER_ID / NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY
 *   NAVER_OPENAPI_CLIENT_ID / NAVER_OPENAPI_CLIENT_SECRET
 *   ANTHROPIC_API_KEY  (질문 생성용, 없으면 키워드 표까지만 출력)
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import {
  fetchRelatedKeywords,
  fetchBlogDocCount,
  fetchTopBlogTitles,
  hasAdCredentials,
  hasOpenApiCredentials,
  type KeywordStat,
} from './lib/naver-api.js';
import { UTILITY_MODEL } from './lib/model.js';
import { CATEGORY_META, hubOf, HUB_AXES } from './lib/style-rules.js';

interface Scored extends KeywordStat {
  docCount: number;
  opportunity: number;
}

interface Config {
  seeds: string[];
  top: number;
  category?: string;
  outDir?: string;
  minSearches: number;
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  const cfg: Config = { seeds: [], top: 20, minSearches: 100 };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--seed':
        cfg.seeds.push(args[++i]);
        break;
      case '--top':
        cfg.top = parseInt(args[++i], 10);
        break;
      case '--category':
        cfg.category = args[++i];
        break;
      case '--out':
        cfg.outDir = args[++i];
        break;
      case '--min-searches':
        cfg.minSearches = parseInt(args[++i], 10);
        break;
    }
  }
  if (cfg.seeds.length === 0) {
    console.error(`
사용법:
  npm run keywords -- --seed "<키워드>" [옵션]

필수:
  --seed <키워드>          시드 키워드 (여러 번 지정 가능, 최대 5개)

옵션:
  --top <n>               상위 몇 개까지 볼지 (기본 20)
  --category <slug>       ${Object.keys(CATEGORY_META).join(' | ')}
  --out <dir>             input 폴더에 keywords.txt / questions.txt 저장
  --min-searches <n>      월간 검색수 하한 (기본 100)

환경변수(.env):
  NAVER_AD_CUSTOMER_ID, NAVER_AD_API_KEY, NAVER_AD_SECRET_KEY
  NAVER_OPENAPI_CLIENT_ID, NAVER_OPENAPI_CLIENT_SECRET
  ANTHROPIC_API_KEY (질문형 소제목 생성용)
`);
    process.exit(1);
  }
  return cfg;
}

const fmt = (n: number) => n.toLocaleString('ko-KR');

/** 기회점수: 검색량 대비 문서수가 적을수록 높다 */
function opportunityScore(searches: number, docs: number): number {
  if (docs <= 0) return searches; // 문서 없음 = 완전 블루오션
  return Math.round((searches / docs) * 1000);
}

function grade(score: number): string {
  if (score >= 100) return '\u{1F7E2} 매우좋음';
  if (score >= 30) return '\u{1F7E1} 좋음';
  if (score >= 10) return '\u{1F7E0} 보통';
  return '\u{1F534} 레드오션';
}

async function generateQuestions(
  mainKeyword: string,
  related: Scored[],
  category: string | undefined,
  topTitles: { title: string; description: string }[],
): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const axis = hubOf(category);
  const client = new Anthropic();

  const res = await client.messages.create({
    model: UTILITY_MODEL,
    max_tokens: 2000,
    system: [
      '당신은 네이버 블로그 검색 최적화를 돕는 어시스턴트입니다.',
      '',
      '2026년 네이버의 핵심 노출 경로는 AI 브리핑 인용입니다.',
      'AI 브리핑은 "질문 → 그 문단만 읽어도 답이 되는 답변" 단위로 글을 인용합니다.',
      '따라서 블로그 소제목이 검색자의 실제 질문과 일치해야 인용 확률이 올라갑니다.',
      '',
      '좋은 질문형 소제목의 조건:',
      '- "상황 + 대상 + 판단"이 들어간다. ("이유식 보관법" ❌ / "7개월 아기 외출할 때 이유식 어떻게 챙기나요" ✅)',
      '- 한 소제목이 질문 하나만 담는다.',
      '- 검색자가 실제로 검색창에 칠 법한 구어체.',
      '- 6개 질문이 서로 다른 각도(고민/사용법/비교/주의점/대상)를 커버한다.',
      '',
      `이 블로그는 "${HUB_AXES[axis].label}" 주제를 주력으로 하는 개인 육아 블로그입니다.`,
      HUB_AXES[axis].description,
      '',
      '출력: 질문 6개만, 한 줄에 하나씩, 번호나 불릿 없이. 다른 설명 금지.',
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: [
          `메인 키워드: ${mainKeyword}`,
          '',
          '실제 검색되는 연관 키워드 (월간검색수 순):',
          ...related.slice(0, 15).map((r) => `- ${r.keyword} (${fmt(r.totalSearches)}회)`),
          '',
          topTitles.length > 0
            ? [
                '현재 상위 노출 중인 글 제목 (이것과 겹치지 않는 각도를 찾아주세요):',
                ...topTitles.map((t) => `- ${t.title}`),
              ].join('\n')
            : '',
          '',
          `위 데이터를 참고해 "${mainKeyword}"로 검색한 사람이 궁금해할 질문 6개를 만들어주세요.`,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ],
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  return text
    .split('\n')
    .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
    .filter((l) => l.length > 5);
}

async function main() {
  const cfg = parseArgs();

  if (!hasAdCredentials()) {
    console.error('\n❌ 네이버 검색광고 API 키가 없습니다.');
    console.error('   광고주센터(searchad.naver.com) → 도구 → API 사용 관리에서 발급');
    console.error('   .env 에 NAVER_AD_CUSTOMER_ID / NAVER_AD_API_KEY / NAVER_AD_SECRET_KEY 추가\n');
    process.exit(1);
  }

  console.log(`🔍 시드: ${cfg.seeds.join(', ')}\n`);

  // 1) 연관키워드 확장
  const related = await fetchRelatedKeywords(cfg.seeds);
  console.log(`📥 연관키워드 ${related.length}개 수신`);

  const filtered = related
    .filter((k) => k.totalSearches >= cfg.minSearches)
    .sort((a, b) => b.totalSearches - a.totalSearches)
    .slice(0, cfg.top);

  console.log(`   검색수 ${fmt(cfg.minSearches)}회 이상: ${filtered.length}개`);

  // 2) 문서수 조회 → 기회점수
  const scored: Scored[] = [];
  if (hasOpenApiCredentials()) {
    console.log(`\n📊 블로그 문서수 조회 중 (${filtered.length}건)...`);
    for (const k of filtered) {
      try {
        const docCount = await fetchBlogDocCount(k.keyword);
        scored.push({
          ...k,
          docCount,
          opportunity: opportunityScore(k.totalSearches, docCount),
        });
      } catch (e) {
        scored.push({ ...k, docCount: -1, opportunity: 0 });
      }
      await new Promise((r) => setTimeout(r, 120)); // 오픈API 레이트리밋 배려
    }
  } else {
    console.log('\n⚠️  오픈 API 키가 없어 문서수/기회점수는 건너뜁니다.');
    console.log('   발급: https://developers.naver.com/apps');
    for (const k of filtered) scored.push({ ...k, docCount: -1, opportunity: 0 });
  }

  scored.sort((a, b) => b.opportunity - a.opportunity);

  // 3) 출력
  console.log('\n' + '─'.repeat(92));
  console.log(
    '키워드'.padEnd(30) +
      '월검색수'.padStart(10) +
      '문서수'.padStart(12) +
      '기회점수'.padStart(10) +
      '  경쟁' +
      '  판정',
  );
  console.log('─'.repeat(92));
  for (const s of scored) {
    console.log(
      s.keyword.slice(0, 28).padEnd(30) +
        fmt(s.totalSearches).padStart(10) +
        (s.docCount >= 0 ? fmt(s.docCount) : '-').padStart(12) +
        (s.docCount >= 0 ? fmt(s.opportunity) : '-').padStart(10) +
        '  ' +
        s.competition.padEnd(4) +
        (s.docCount >= 0 ? '  ' + grade(s.opportunity) : ''),
    );
  }
  console.log('─'.repeat(92));

  // 4) 메인 키워드 = 기회점수 1위
  const main = scored[0];
  if (!main) {
    console.log('\n조건에 맞는 키워드가 없습니다. --min-searches 를 낮춰보세요.');
    return;
  }
  const subs = scored.slice(1, 7);

  console.log(`\n🎯 추천 메인 키워드: ${main.keyword}`);
  console.log(`   월 ${fmt(main.totalSearches)}회 검색 / 문서 ${fmt(main.docCount)}건 / 기회점수 ${fmt(main.opportunity)}`);
  console.log(`   서브: ${subs.map((s) => s.keyword).join(', ')}`);

  // 5) 상위 노출 글 (차별화 각도)
  let topTitles: { title: string; link: string; description: string }[] = [];
  if (hasOpenApiCredentials()) {
    topTitles = await fetchTopBlogTitles(main.keyword, 5);
    if (topTitles.length > 0) {
      console.log(`\n📄 "${main.keyword}" 상위 노출 글:`);
      for (const t of topTitles) console.log(`   · ${t.title}`);
    }
  }

  // 6) 질문형 소제목
  console.log('\n🧠 질문형 소제목 생성 중...');
  const questions = await generateQuestions(
    main.keyword,
    scored,
    cfg.category,
    topTitles,
  );
  if (questions.length > 0) {
    console.log('\n💬 소제목으로 쓸 질문 (각 질문 바로 아래 문단이 자기완결 답변이어야 인용됩니다):');
    for (const [i, q] of questions.entries()) console.log(`   ${i + 1}. ${q}`);
  } else {
    console.log('   (ANTHROPIC_API_KEY 없음 — 건너뜀)');
  }

  // 7) input 폴더 저장
  if (cfg.outDir) {
    await fs.mkdir(cfg.outDir, { recursive: true });

    const kwPath = path.join(cfg.outDir, 'keywords.txt');
    await fs.writeFile(
      kwPath,
      [main.keyword, ...subs.map((s) => s.keyword)].join('\n') + '\n',
      'utf-8',
    );
    console.log(`\n✅ ${kwPath}`);

    if (questions.length > 0) {
      const qPath = path.join(cfg.outDir, 'questions.txt');
      await fs.writeFile(
        qPath,
        [
          '# 소제목으로 쓸 질문 (각 질문 아래 첫 문단 = 그 질문만의 완결 답변)',
          `# 생성: ${new Date().toISOString().slice(0, 10)} / 메인 키워드: ${main.keyword}`,
          '',
          ...questions,
          '',
        ].join('\n'),
        'utf-8',
      );
      console.log(`✅ ${qPath}`);
    }

    const reportPath = path.join(cfg.outDir, 'keyword-report.md');
    await fs.writeFile(
      reportPath,
      [
        `# 키워드 리서치 — ${cfg.seeds.join(', ')}`,
        `조회일: ${new Date().toISOString().slice(0, 10)}`,
        '',
        '| 키워드 | 월검색수 | 문서수 | 기회점수 | 경쟁 |',
        '|---|---:|---:|---:|---|',
        ...scored.map(
          (s) =>
            `| ${s.keyword} | ${fmt(s.totalSearches)} | ${s.docCount >= 0 ? fmt(s.docCount) : '-'} | ${s.docCount >= 0 ? fmt(s.opportunity) : '-'} | ${s.competition} |`,
        ),
        '',
        topTitles.length > 0
          ? ['## 상위 노출 글', '', ...topTitles.map((t) => `- [${t.title}](${t.link})`), ''].join('\n')
          : '',
      ].join('\n'),
      'utf-8',
    );
    console.log(`✅ ${reportPath}`);
  } else {
    console.log('\n💡 --out input/<폴더> 를 주면 keywords.txt / questions.txt 로 저장합니다.');
  }
}

main().catch((err) => {
  console.error('\n❌', err instanceof Error ? err.message : err);
  process.exit(1);
});
