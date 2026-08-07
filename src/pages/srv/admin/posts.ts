export const prerender = false;

import type { APIRoute } from 'astro';
import { listPosts, readFile, findPostPath } from '../../../lib/github';

/**
 * GET /srv/admin/posts            → 발행된 글 목록 (수정할 글 고르기)
 * GET /srv/admin/posts?slug=xxx   → 해당 글의 마크다운 원문 + sha
 */
export const GET: APIRoute = async ({ url }) => {
  try {
    const slug = url.searchParams.get('slug');

    if (!slug) {
      const posts = await listPosts();
      return new Response(JSON.stringify({ posts }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const path = await findPostPath(slug);
    if (!path) {
      return new Response(JSON.stringify({ error: '글을 찾을 수 없어요' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const file = await readFile(path);
    return new Response(JSON.stringify(file), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[posts] error', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Failed to load posts',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
};
