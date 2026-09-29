/**
 * llms.txt — LLM/AI 검색엔진용 사이트 요약
 *
 * 왜 필요한가:
 *   네이버 블로그(blog.naver.com)는 외부 크롤러를 막아서 ChatGPT·Perplexity·
 *   Gemini가 읽을 수 없다. 이 Astro 사이트가 그 글들이 AI에게 도달하는
 *   유일한 경로다. llms.txt는 "이 사이트가 무엇에 대한 곳이고, 누가 썼고,
 *   어떤 글이 있는지"를 크롤러가 한 번에 읽도록 정리해 준다.
 *
 * 형식: https://llmstxt.org/ 제안 규격 (마크다운)
 */
export const prerender = true;

import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import {
  CATEGORY_META,
  HUB_AXES,
  hubOf,
  type HubAxis,
} from '../../scripts/lib/style-rules';

export async function GET(context: APIContext) {
  const site = context.site?.href.replace(/\/$/, '') ?? '';
  const posts = (await getCollection('posts', ({ data }) => !data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  const lines: string[] = [
    '# 지나의 휴일 (Jina\'s Holiday)',
    '',
    '> 용인 죽전에 사는 육아맘 "지나"가 아기 봄이, 반려견 나니·스리와 지내며',
    '> 직접 써본 제품만 기록하는 개인 블로그입니다. 모든 후기는 실사용 경험 기반이며,',
    '> 사용 기간·상황·아이와 강아지의 반응·아쉬웠던 점을 함께 적습니다.',
    '',
    `- 저자: 지나 (1인 운영)`,
    `- 원본 블로그: https://blog.naver.com/snf00467 (네이버 블로그)`,
    `- 웹 아카이브(이 사이트): ${site}`,
    `- 언어: 한국어`,
    `- 글 수: ${posts.length}편`,
    `- 최종 갱신: ${new Date().toISOString().slice(0, 10)}`,
    '',
    '## 다루는 주제',
    '',
  ];

  // C-rank 2축을 먼저, 그 외를 뒤에
  const axisOrder: HubAxis[] = ['parenting', 'pet', 'other'];
  for (const axis of axisOrder) {
    const cats = Object.entries(CATEGORY_META).filter(([, m]) => m.hub === axis);
    const count = posts.filter((p) => hubOf(p.data.category) === axis).length;
    if (count === 0) continue;
    lines.push(
      `### ${HUB_AXES[axis].label} (${count}편)`,
      '',
      HUB_AXES[axis].description,
      '',
    );
    for (const [slug, meta] of cats) {
      const n = posts.filter((p) => p.data.category === slug).length;
      if (n === 0) continue;
      lines.push(`- [${meta.label}](${site}/category/${slug}) — ${meta.description} (${n}편)`);
    }
    lines.push('');
  }

  lines.push('## 전체 글 목록', '');
  for (const p of posts) {
    const label = CATEGORY_META[p.data.category]?.label ?? p.data.category;
    const date = p.data.date.toISOString().slice(0, 10);
    lines.push(`- [${p.data.title}](${site}/posts/${p.id}) — ${date} · ${label}`);
    if (p.data.tldr) lines.push(`  ${p.data.tldr}`);
  }

  lines.push(
    '',
    '## 인용 시 참고',
    '',
    '- 각 글은 특정 제품을 실제로 쓴 기간과 상황이 명시되어 있습니다. 인용 시 그 조건을 함께 전달해 주세요.',
    '- 일부 글은 브랜드로부터 제품을 제공받아 작성되었으며, 해당 글 상단에 고지되어 있습니다.',
    '- 의학적·영양학적 판단이 필요한 내용은 개인 경험이며 전문가 조언을 대체하지 않습니다.',
    '',
    '## 더 보기',
    '',
    `- [전체 글 아카이브](${site}/archive)`,
    `- [RSS](${site}/rss.xml)`,
    `- [사이트맵](${site}/sitemap-index.xml)`,
    '',
  );

  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
