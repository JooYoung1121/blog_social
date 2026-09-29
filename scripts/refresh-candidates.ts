/**
 * refresh-candidates.ts
 *
 * "지금 갱신하면 가장 이득인 글"을 뽑는다.
 *
 * 왜 갱신인가:
 *   AI 브리핑은 최신성 신호가 있는 문서를 선호한다. 새 글 한 편을 쓰는 것보다
 *   이미 유입이 있는 글을 손보는 쪽이 투입 대비 인용 확률이 높은 경우가 많다.
 *   발행 리듬 상한(하루 2편/주 2~4편)에 묶여 있을수록 더 그렇다.
 *
 * 우선순위:
 *   - 오래됐는데 유입이 있는 글 (고칠 가치가 증명된 글)
 *   - lint 경고가 남아 있는 글 (영상마커·내부링크·최신성 등 쉬운 수정)
 *   - 이미 AI 인용이 있는 글 (한 번 인용된 글은 다시 인용될 확률이 높다)
 *
 * 사용:
 *   npm run refresh
 *   npm run refresh -- --top 5
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { loadPerformance } from './lib/performance.js';
import { lintPostBody, inferPurchaseType } from './lib/style-rules.js';

const STALE_DAYS = 120; // 약 4개월

interface Candidate {
  slug: string;
  file: string;
  title: string;
  ageDays: number;
  views: number;
  aiCitations: number;
  warnings: string[];
  score: number;
  reasons: string[];
}

function fm(text: string): Record<string, string> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.+)$/);
    if (mm) out[mm[1]] = mm[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const topN = args.includes('--top')
    ? parseInt(args[args.indexOf('--top') + 1], 10)
    : 5;

  const perf = await loadPerformance();
  const files = await glob('src/content/posts/**/*.md', { absolute: true });
  const base = path.resolve('src/content/posts');
  const now = Date.now();

  const candidates: Candidate[] = [];

  for (const file of files) {
    const raw = await fs.readFile(file, 'utf-8');
    const meta = fm(raw);
    const slug = path.relative(base, file).replace(/\.md$/, '');

    // 마지막으로 손본 시점 = updated 있으면 그것, 없으면 date
    const refDate = new Date(meta.updated || meta.date || 0);
    const ageDays = Math.floor((now - refDate.valueOf()) / 86400000);

    const issues = lintPostBody(raw, {
      mainKeyword: meta.mainKeyword,
      purchaseType: inferPurchaseType(meta),
      category: meta.category,
      target: meta.target as 'search' | 'homefeed' | 'both' | undefined,
    });
    const warnings = issues.map((i) => i.code);

    const p = perf.get(slug);
    const views = p?.views ?? 0;
    const aiCitations = p?.aiCitations ?? 0;

    const reasons: string[] = [];
    let score = 0;

    if (ageDays >= STALE_DAYS) {
      score += Math.min(ageDays - STALE_DAYS, 200) / 4;
      reasons.push(`${ageDays}일째 미갱신`);
    }
    if (views > 0) {
      score += Math.log10(views) * 25;
      reasons.push(`조회 ${views.toLocaleString('ko-KR')}`);
    }
    if (aiCitations > 0) {
      score += aiCitations * 40;
      reasons.push(`AI 인용 ${aiCitations}회 (재인용 가능성 높음)`);
    }
    // 고치기 쉬운 경고일수록 가점 — 손대는 비용이 낮다
    const easyFixes = warnings.filter((w) =>
      [
        'no-video-marker',
        'internal-links-low',
        'no-recency-signal',
        'alt-too-short',
        'description-length',
        'external-source-missing',
      ].includes(w),
    );
    if (easyFixes.length > 0) {
      score += easyFixes.length * 8;
      reasons.push(`쉬운 수정 ${easyFixes.length}건`);
    }

    if (score <= 0) continue;

    candidates.push({
      slug,
      file: path.relative(process.cwd(), file),
      title: meta.title ?? slug,
      ageDays,
      views,
      aiCitations,
      warnings,
      score,
      reasons,
    });
  }

  candidates.sort((a, b) => b.score - a.score);

  if (perf.size === 0) {
    console.log(
      '\n💡 data/performance.csv 가 비어 있어 "경과일 + lint 경고"만으로 판단했습니다.',
    );
    console.log(
      '   성과 데이터를 넣으면 실제 유입이 있는 글이 우선순위로 올라옵니다.\n',
    );
  }

  console.log(`🔄 갱신 우선순위 상위 ${Math.min(topN, candidates.length)}편\n`);

  for (const [i, c] of candidates.slice(0, topN).entries()) {
    console.log(`${i + 1}. ${c.title}`);
    console.log(`   ${c.file}`);
    console.log(`   근거: ${c.reasons.join(' · ')}`);
    if (c.warnings.length > 0) {
      console.log(`   남은 경고: ${c.warnings.join(', ')}`);
    }
    console.log('');
  }

  console.log('갱신할 때:');
  console.log('  1. 본문에 "2026년 ○월 기준" 같은 최신성 문장 1회 추가');
  console.log('  2. 그 사이 새로 쓴 관련 글로 내부 링크 보강 (npm run suggest-links)');
  console.log('  3. frontmatter 에 updated: YYYY-MM-DD 스탬프');
  console.log('  4. npm run lint:posts -- <파일> 로 확인 후 push');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
