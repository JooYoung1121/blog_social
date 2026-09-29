/**
 * perf-report.ts
 *
 * data/performance.csv 를 읽어 "무엇이 먹혔나"를 집계한다.
 *
 * 보는 것:
 *   1. 글별 성과 순위 (AI 인용수 가중)
 *   2. C-rank 축(육아/반려견/그 외)별 성과 — 축 전략이 맞는지 검증
 *   3. 상위 글의 소제목 형태 — 다음 글에 재사용할 패턴
 *   4. 유입 키워드 — 우리가 노린 메인 키워드와 실제 유입이 일치하는지
 *
 * 사용:
 *   npm run perf-report
 */
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { loadPerformance, perfScore, type PerfRow } from './lib/performance.js';
import { CATEGORY_META, HUB_AXES, hubOf, type HubAxis } from './lib/style-rules.js';

interface PostInfo {
  slug: string;
  title: string;
  category?: string;
  mainKeyword?: string;
  date?: string;
  headings: string[];
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

async function loadPosts(): Promise<Map<string, PostInfo>> {
  const files = await glob('src/content/posts/**/*.md', { absolute: true });
  const base = path.resolve('src/content/posts');
  const map = new Map<string, PostInfo>();
  for (const f of files) {
    const raw = await fs.readFile(f, 'utf-8');
    const meta = fm(raw);
    const slug = path.relative(base, f).replace(/\.md$/, '');
    map.set(slug, {
      slug,
      title: meta.title ?? slug,
      category: meta.category,
      mainKeyword: meta.mainKeyword,
      date: meta.date,
      headings: [...raw.matchAll(/^#{2,6}\s+(.+)$/gm)]
        .map((m) => m[1].trim())
        .filter((h) => !/자주 묻는 질문/.test(h)),
    });
  }
  return map;
}

const bar = (n: number, max: number, w = 20) =>
  '█'.repeat(Math.round((n / Math.max(max, 1)) * w)).padEnd(w, '·');

async function main() {
  const perf = await loadPerformance();
  const posts = await loadPosts();

  if (perf.size === 0) {
    console.log(`
📭 data/performance.csv 에 데이터가 없습니다.

이 시스템에서 유일한 학습 입력이 이 파일입니다. 비어 있으면
초안 생성기는 계속 같은 품질의 글만 뽑습니다.

채우는 법 (월 1회, 10분):
  1. 네이버 크리에이터 어드바이저 접속
  2. 내 블로그 통계 → 게시글별 조회수 / 평균 사용시간
  3. AI 브리핑 인용 → 글별 인용수 (2026-01부터 누적)
  4. data/performance.csv 에 한 줄씩 추가

형식과 예시는 data/README.md 참고.
`);
    return;
  }

  const rows = [...perf.values()].sort((a, b) => perfScore(b) - perfScore(a));
  const maxScore = perfScore(rows[0]);

  // ── 1. 글별 순위 ────────────────────────────────────────────
  console.log(`\n📊 글별 성과 (${rows.length}편 / 최신 측정 기준)\n`);
  console.log(
    '순위  제목'.padEnd(46) +
      'AI인용'.padStart(7) +
      '체류'.padStart(7) +
      '조회'.padStart(9) +
      '  성과',
  );
  console.log('─'.repeat(92));
  for (const [i, r] of rows.entries()) {
    const p = posts.get(r.slug);
    const title = (p?.title ?? r.slug).slice(0, 36);
    const stay = r.avgSeconds >= 60 ? `${r.avgSeconds}s` : `${r.avgSeconds}s⚠`;
    console.log(
      `${String(i + 1).padStart(3)}.  ${title.padEnd(38)}` +
        String(r.aiCitations).padStart(7) +
        stay.padStart(8) +
        r.views.toLocaleString('ko-KR').padStart(9) +
        '  ' +
        bar(perfScore(r), maxScore),
    );
  }

  const under60 = rows.filter((r) => r.avgSeconds > 0 && r.avgSeconds < 60);
  if (under60.length > 0) {
    console.log(
      `\n⚠️  체류시간 60초 미만 ${under60.length}편 — 2026 로직에서 상위노출 최소 조건으로 보고되는 기준선입니다.`,
    );
  }

  // ── 2. C-rank 축별 ──────────────────────────────────────────
  console.log('\n\n🎯 C-rank 축별 성과\n');
  const byAxis = new Map<HubAxis, PerfRow[]>();
  for (const r of rows) {
    const axis = hubOf(posts.get(r.slug)?.category);
    byAxis.set(axis, [...(byAxis.get(axis) ?? []), r]);
  }
  for (const axis of ['parenting', 'pet', 'other'] as HubAxis[]) {
    const list = byAxis.get(axis) ?? [];
    if (list.length === 0) continue;
    const cites = list.reduce((s, r) => s + r.aiCitations, 0);
    const avgStay = Math.round(
      list.reduce((s, r) => s + r.avgSeconds, 0) / list.length,
    );
    const core = HUB_AXES[axis].isCore ? '주력' : '축 밖';
    console.log(
      `  ${HUB_AXES[axis].label.padEnd(6)} [${core}] ${String(list.length).padStart(2)}편 · AI인용 ${String(cites).padStart(3)}회 · 평균체류 ${avgStay}s · 글당인용 ${(cites / list.length).toFixed(1)}`,
    );
  }
  console.log(
    '\n  → 주력 축의 글당 인용수가 축 밖보다 낮으면 축 선정을 재검토할 때입니다.',
  );

  // ── 3. 상위 글의 소제목 패턴 ────────────────────────────────
  const top = rows.slice(0, 3);
  console.log('\n\n💬 성과 상위 3편의 소제목 (다음 글에 재사용할 패턴)\n');
  for (const r of top) {
    const p = posts.get(r.slug);
    if (!p) continue;
    console.log(`  [AI인용 ${r.aiCitations}회] ${p.title}`);
    for (const h of p.headings.slice(0, 6)) console.log(`     · ${h}`);
    console.log('');
  }
  const questionish = top
    .flatMap((r) => posts.get(r.slug)?.headings ?? [])
    .filter((h) => /[?？]|나요|까요|어때|뭐|왜|언제|어떻게/.test(h));
  if (top.length > 0) {
    const total = top.flatMap((r) => posts.get(r.slug)?.headings ?? []).length;
    console.log(
      `  질문형 소제목 비율: ${questionish.length}/${total} — AI 브리핑은 질문 단위로 인용하므로 이 비율이 높을수록 유리합니다.`,
    );
  }

  // ── 4. 유입 키워드 vs 노린 키워드 ───────────────────────────
  console.log('\n\n🔑 유입 키워드 대조\n');
  let mismatch = 0;
  for (const r of rows) {
    if (r.inflowKeywords.length === 0) continue;
    const p = posts.get(r.slug);
    const aimed = p?.mainKeyword;
    const hit =
      aimed &&
      r.inflowKeywords.some((k) => k.includes(aimed) || aimed.includes(k));
    const mark = !aimed ? '  ' : hit ? '✅' : '❌';
    if (aimed && !hit) mismatch++;
    console.log(`  ${mark} ${(p?.title ?? r.slug).slice(0, 30).padEnd(32)}`);
    console.log(`      노림: ${aimed ?? '(미지정)'}`);
    console.log(`      실제: ${r.inflowKeywords.slice(0, 5).join(', ')}`);
  }
  if (mismatch > 0) {
    console.log(
      `\n  ⚠️  ${mismatch}편이 노린 키워드와 다른 경로로 유입됐습니다.`,
    );
    console.log(
      '      실제 유입 키워드를 npm run keywords 의 --seed 로 넣으면 다음 글의 정확도가 올라갑니다.',
    );
  }

  console.log('');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
