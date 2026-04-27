export const prerender = false;

import type { APIRoute } from 'astro';

interface PublishBody {
  slug: string;
  markdown: string;
}

function parseRepoFromGitConfig(): { owner: string; repo: string } {
  // 환경변수 우선
  const repo = process.env.GITHUB_REPO; // "owner/repo" 형식
  if (repo && repo.includes('/')) {
    const [owner, name] = repo.split('/');
    return { owner, repo: name };
  }
  // 기본값 (이 프로젝트)
  return { owner: 'JooYoung1121', repo: 'blog_social' };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body: PublishBody = await request.json();
    const { slug, markdown } = body;
    if (!slug || !markdown) {
      return new Response(JSON.stringify({ error: 'slug, markdown 필수' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = process.env.GITHUB_REPO_TOKEN;
    if (!token) {
      return new Response(
        JSON.stringify({ error: 'GITHUB_REPO_TOKEN 환경변수 필요' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const { owner, repo } = parseRepoFromGitConfig();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const filePath = `src/content/posts/${year}/${month}/${slug}.md`;

    // 1) 기존 파일 존재 여부 확인 (sha 필요 시)
    const headRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}?ref=main`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'jinas-holiday-admin',
        },
      },
    );
    let existingSha: string | undefined;
    if (headRes.ok) {
      const json = (await headRes.json()) as { sha: string };
      existingSha = json.sha;
    } else if (headRes.status !== 404) {
      const errText = await headRes.text();
      throw new Error(`GitHub get failed: ${headRes.status} ${errText}`);
    }

    // 2) 커밋 생성
    const contentBase64 = Buffer.from(markdown, 'utf-8').toString('base64');
    const message = existingSha ? `update: ${slug}` : `feat: 새 글 — ${slug}`;
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
          'User-Agent': 'jinas-holiday-admin',
        },
        body: JSON.stringify({
          message,
          content: contentBase64,
          branch: 'main',
          sha: existingSha,
        }),
      },
    );
    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub put failed: ${putRes.status} ${errText}`);
    }
    const putJson = (await putRes.json()) as {
      commit: { html_url: string; sha: string };
      content: { html_url: string };
    };

    return new Response(
      JSON.stringify({
        ok: true,
        commitUrl: putJson.commit.html_url,
        fileUrl: putJson.content.html_url,
        path: filePath,
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
