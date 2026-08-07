export const prerender = false;

import type { APIRoute } from 'astro';
import {
  commitFile,
  findPostPath,
  newPostPath,
  readFile,
  stampUpdated,
} from '../../../lib/github';

interface PublishBody {
  slug: string;
  markdown: string;
  /** 수정 발행 시 불러온 파일의 sha (동시 수정 충돌 방지) */
  sha?: string;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: PublishBody = await request.json();
    const { slug, markdown, sha } = body;
    if (!slug || !markdown) {
      return new Response(JSON.stringify({ error: 'slug, markdown 필수' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 1) 기존 글이면 "원래 저장된 경로"에 그대로 덮어쓴다.
    //    (지금 연/월로 경로를 계산하면 과거 글 수정 시 중복 파일이 생김)
    const existingPath = await findPostPath(slug);
    const path = existingPath ?? newPostPath(slug);

    // 2) 최신 sha 확인 — 클라이언트가 들고 있던 sha와 다르면 그 사이에 다른 곳에서 수정된 것
    const current = existingPath ? await readFile(existingPath) : null;
    if (current && sha && current.sha !== sha) {
      return new Response(
        JSON.stringify({
          error:
            '이 글이 다른 곳에서 먼저 수정됐어요. 다시 불러온 뒤 수정해주세요.',
          code: 'conflict',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 3) 수정이면 updated 날짜 스탬프 (신선도 신호)
    const today = new Date().toISOString().slice(0, 10);
    const finalMarkdown = current
      ? stampUpdated(markdown, today)
      : markdown;

    const message = current ? `update: ${slug}` : `feat: 새 글 — ${slug}`;
    const result = await commitFile(
      path,
      finalMarkdown,
      message,
      current?.sha,
    );

    return new Response(
      JSON.stringify({
        ok: true,
        ...result,
        naverUrl: `/naver/${path
          .replace(/^src\/content\/posts\//, '')
          .replace(/\.md$/, '')}`,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[publish] error', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Publish failed',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
