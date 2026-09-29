/**
 * performance.ts — 성과 데이터(data/performance.csv) 로더
 *
 * 이 파일이 존재하는 이유:
 *   2026-08까지 이 시스템에는 피드백 루프가 없었다. 매번 같은 프롬프트로
 *   같은 품질의 글이 나왔고, 무엇이 먹혔는지가 다음 글에 반영되지 않았다.
 *   2026 하반기 실질 KPI가 AI 브리핑 인용수로 이동했으므로,
 *   "인용된 글이 어떻게 생겼나"를 프롬프트로 되먹이는 게 핵심이다.
 *
 * 데이터 출처는 수동이다. 크리에이터 어드바이저에 공식 API가 없다.
 */
import fs from 'fs/promises';
import path from 'path';

export interface PerfRow {
  slug: string;
  measuredOn: string;
  views: number;
  avgSeconds: number;
  aiCitations: number;
  likes: number;
  comments: number;
  inflowKeywords: string[];
}

const CSV_PATH = path.resolve('data/performance.csv');

function parseLine(line: string): PerfRow | null {
  const cols = line.split(',');
  if (cols.length < 8) return null;
  const [slug, measuredOn, views, avgSeconds, aiCitations, likes, comments, ...rest] =
    cols;
  if (!slug.trim()) return null;
  const num = (v: string) => {
    const n = parseInt((v || '').replace(/[^0-9-]/g, ''), 10);
    return Number.isNaN(n) ? 0 : n;
  };
  return {
    slug: slug.trim(),
    measuredOn: measuredOn.trim(),
    views: num(views),
    avgSeconds: num(avgSeconds),
    aiCitations: num(aiCitations),
    likes: num(likes),
    comments: num(comments),
    inflowKeywords: rest
      .join(',')
      .split(';')
      .map((k) => k.trim())
      .filter(Boolean),
  };
}

/** 글별 최신 측정값만 남긴다 (같은 slug가 여러 시점에 있으면 마지막 것) */
export async function loadPerformance(): Promise<Map<string, PerfRow>> {
  let raw: string;
  try {
    raw = await fs.readFile(CSV_PATH, 'utf-8');
  } catch {
    return new Map();
  }

  const latest = new Map<string, PerfRow>();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || t.startsWith('slug,')) continue;
    const row = parseLine(t);
    if (!row) continue;
    const prev = latest.get(row.slug);
    if (!prev || row.measuredOn >= prev.measuredOn) latest.set(row.slug, row);
  }
  return latest;
}

/**
 * 성과 점수 — 어느 글을 "잘된 글"로 볼지.
 *
 * AI 인용수에 가장 큰 가중치를 둔다. 2026 하반기 목표 지표이고,
 * 조회수와 달리 제목빨·일시적 유입으로 부풀릴 수 없는 신호라서다.
 * 체류시간은 60초를 기준선으로 본다(2026 로직에서 상위노출 최소 조건으로 보고됨).
 */
export function perfScore(r: PerfRow): number {
  return (
    r.aiCitations * 100 +
    Math.min(r.avgSeconds, 180) * 2 +
    Math.log10(Math.max(r.views, 1)) * 20 +
    (r.likes + r.comments * 3)
  );
}

/** 성과 상위 N편의 slug */
export async function topPerformers(n = 3): Promise<PerfRow[]> {
  const rows = [...(await loadPerformance()).values()];
  return rows.sort((a, b) => perfScore(b) - perfScore(a)).slice(0, n);
}
