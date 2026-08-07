export const prerender = false;

import type { APIRoute } from 'astro';
import {
  lintPostBody,
  type PurchaseType,
} from '../../../../scripts/lib/style-rules';

/**
 * POST /srv/admin/lint  { markdown }
 *
 * CLI의 `npm run lint:posts` 와 같은 룰(style-rules.ts 단일 소스)로
 * 브라우저에서 작성/수정한 글을 발행 전에 검사한다.
 * frontmatter에서 mainKeyword / purchaseType / category / target 을 읽어 기준을 맞춘다.
 */
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const { markdown } = (await request.json()) as { markdown: string };
    if (!markdown) {
      return new Response(JSON.stringify({ error: 'markdown 필수' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const fm = parseFrontmatter(markdown);
    const purchaseType =
      (fm.purchaseType as PurchaseType | undefined) ??
      (fm.sponsored === 'true' ? 'sponsored' : 'self-purchased');

    const issues = lintPostBody(markdown, {
      mainKeyword: fm.mainKeyword,
      purchaseType,
      category: fm.category,
      target: fm.target as 'search' | 'homefeed' | 'both' | undefined,
    });

    const bodyOnly = markdown.replace(/^---[\s\S]*?---\s*/m, '');
    const charCount = bodyOnly
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/\s/g, '').length;

    return new Response(
      JSON.stringify({
        issues,
        stats: {
          charCount,
          photoCount: (bodyOnly.match(/!\[.*?\]\(.*?\)/g) || []).length,
          videoMarkers: (bodyOnly.match(/<!--\s*video:/gi) || []).length,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[lint] error', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Lint failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
