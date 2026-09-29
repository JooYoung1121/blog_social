/**
 * lint-posts.ts
 *
 * 모든 포스트 마크다운을 순회하며 글쓰기 룰 위반을 검출.
 * 메모리/룰 단일 소스(scripts/lib/style-rules.ts)의 lintPostBody를 사용.
 *
 * 사용:
 *   npm run lint:posts            # 모든 포스트 검사
 *   npm run lint:posts -- <path>  # 특정 파일만
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import {
  lintPostBody,
  inferPurchaseType,
  PUBLISHING_RHYTHM,
  type LintIssue,
  type PurchaseType,
} from './lib/style-rules.js';

interface PostReport {
  file: string;
  mainKeyword?: string;
  purchaseType?: PurchaseType;
  date?: string;
  category?: string;
  headings: string[];
  errors: LintIssue[];
  warnings: LintIssue[];
}

/**
 * 한 파일만 봐서는 못 잡는 검사 (발행 리듬 / 유사문서 리스크).
 *
 * 왜 필요한가: 네이버는 AI 대량 발행 저품질 블로그에 대한 제재를 강화하는
 * 흐름이고, 같은 구조·같은 주제를 연속 발행하면 유사문서로 판정될 위험이 있다.
 * 자동화를 붙일수록 사람이 눈치채기 어려워지므로 lint가 대신 본다.
 *   근거: 뉴스버스 "AI 따발총 저품질 블로그글, 네이버 제재 강화 방침"
 *         https://www.newsverse.kr/news/articleView.html?idxno=9959
 *         scripts/lib/style-rules.ts PUBLISHING_RHYTHM
 */
function lintAcrossPosts(reports: PostReport[]): string[] {
  const notes: string[] = [];

  // 1) 하루 발행량
  const byDate = new Map<string, string[]>();
  for (const r of reports) {
    if (!r.date) continue;
    const list = byDate.get(r.date) ?? [];
    list.push(path.basename(r.file));
    byDate.set(r.date, list);
  }
  for (const [date, files] of [...byDate].sort()) {
    if (files.length > PUBLISHING_RHYTHM.per_day_max) {
      notes.push(
        `발행 리듬: ${date}에 ${files.length}편 — 하루 최대 ${PUBLISHING_RHYTHM.per_day_max}편 권장`,
      );
    }
  }

  // 2) 같은 카테고리 연속 발행 (날짜순)
  const sorted = reports
    .filter((r) => r.date && r.category)
    .sort((a, b) => a.date!.localeCompare(b.date!));
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].category === sorted[i - 1].category) {
      run++;
      if (run === 4) {
        notes.push(
          `유사문서 리스크: "${sorted[i].category}" 카테고리가 ${run}편 연속 (~${sorted[i].date}) — 사이에 다른 축의 글을 끼우는 게 안전`,
        );
      }
    } else {
      run = 1;
    }
  }

  // 3) 소제목 구조 중복 — 직전 글들과 소제목이 과하게 겹치면 템플릿 티가 난다
  for (let i = 1; i < sorted.length; i++) {
    const cur = new Set(sorted[i].headings);
    if (cur.size < 3) continue;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const prev = new Set(sorted[j].headings);
      if (prev.size < 3) continue;
      const overlap = [...cur].filter((h) => prev.has(h)).length;
      const ratio = overlap / Math.min(cur.size, prev.size);
      if (ratio >= 0.6) {
        notes.push(
          `구조 중복: ${path.basename(sorted[i].file)} 와 ${path.basename(sorted[j].file)} 의 소제목이 ${Math.round(ratio * 100)}% 동일 — 소제목을 글마다 다르게`,
        );
        break;
      }
    }
  }

  return notes;
}

/** FAQ 헤딩 등 반복되는 고정 소제목은 중복 판정에서 제외 */
const GENERIC_HEADINGS = /자주 묻는 질문|한 줄 요약/;

function extractHeadings(body: string): string[] {
  return [...body.matchAll(/^#{2,6}\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((h) => !GENERIC_HEADINGS.test(h));
}

function parseFrontmatter(text: string): Record<string, string> {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const result: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^(\w+):\s*(.+)$/);
    if (m) result[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return result;
}

async function lintFile(filePath: string): Promise<PostReport> {
  const content = await fs.readFile(filePath, 'utf-8');
  const fm = parseFrontmatter(content);
  const purchaseType = inferPurchaseType(fm);
  const issues = lintPostBody(content, {
    mainKeyword: fm.mainKeyword,
    purchaseType,
    category: fm.category,
    target: fm.target as 'search' | 'homefeed' | 'both' | undefined,
  });

  return {
    file: filePath,
    mainKeyword: fm.mainKeyword,
    purchaseType,
    date: fm.date,
    category: fm.category,
    headings: extractHeadings(content),
    errors: issues.filter((i) => i.level === 'error'),
    warnings: issues.filter((i) => i.level === 'warning'),
  };
}

async function main() {
  const targetArg = process.argv[2];

  let files: string[];
  if (targetArg) {
    files = [path.resolve(targetArg)];
  } else {
    files = await glob('src/content/posts/**/*.md', { absolute: true });
  }

  if (files.length === 0) {
    console.log('검사할 포스트가 없습니다.');
    return;
  }

  console.log(`📋 ${files.length}개 포스트 검사 시작\n`);

  const reports = await Promise.all(files.map(lintFile));

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const r of reports) {
    if (r.errors.length === 0 && r.warnings.length === 0) {
      console.log(`✅ ${path.relative(process.cwd(), r.file)}`);
      continue;
    }

    const rel = path.relative(process.cwd(), r.file);
    console.log(`\n${r.errors.length > 0 ? '❌' : '⚠️ '} ${rel}`);
    if (r.purchaseType) console.log(`   구매 형태: ${r.purchaseType}`);
    if (r.mainKeyword) console.log(`   메인 키워드: ${r.mainKeyword}`);

    for (const e of r.errors) {
      console.log(`   ❌ [${e.code}] ${e.message}`);
      totalErrors++;
    }
    for (const w of r.warnings) {
      console.log(`   ⚠️  [${w.code}] ${w.message}`);
      totalWarnings++;
    }
  }

  // 전체를 가로질러 봐야 보이는 문제 (파일 하나만 검사할 땐 생략)
  if (!targetArg) {
    const crossNotes = lintAcrossPosts(reports);
    if (crossNotes.length > 0) {
      console.log('\n🔁 발행 패턴 검사');
      for (const n of crossNotes) console.log(`   ⚠️  ${n}`);
    }
  }

  console.log(
    `\n📊 결과: ${reports.length}개 파일, 에러 ${totalErrors}개, 경고 ${totalWarnings}개`,
  );

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
