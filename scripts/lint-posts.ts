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
  type LintIssue,
  type PurchaseType,
} from './lib/style-rules.js';

interface PostReport {
  file: string;
  mainKeyword?: string;
  purchaseType?: PurchaseType;
  errors: LintIssue[];
  warnings: LintIssue[];
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

function inferPurchaseType(
  fm: Record<string, string>,
): PurchaseType | undefined {
  if (fm.purchaseType) return fm.purchaseType as PurchaseType;
  // legacy sponsored 필드로 추정 (true면 sponsored, false면 self-purchased)
  if (fm.sponsored === 'true') return 'sponsored';
  if (fm.sponsored === 'false') return 'self-purchased';
  return undefined;
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

  console.log(
    `\n📊 결과: ${reports.length}개 파일, 에러 ${totalErrors}개, 경고 ${totalWarnings}개`,
  );

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('❌ Error:', err);
  process.exit(1);
});
