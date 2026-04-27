// TEMP: 환경변수 진단용. 진단 끝나면 삭제 (값은 노출하지 않고 길이/존재만 반환)
export const prerender = false;

import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      adminPasswordSet: typeof process.env.ADMIN_PASSWORD === 'string',
      adminPasswordLen: (process.env.ADMIN_PASSWORD ?? '').length,
      sessionSecretSet: typeof process.env.ADMIN_SESSION_SECRET === 'string',
      sessionSecretLen: (process.env.ADMIN_SESSION_SECRET ?? '').length,
      githubTokenSet: typeof process.env.GITHUB_REPO_TOKEN === 'string',
      githubTokenLen: (process.env.GITHUB_REPO_TOKEN ?? '').length,
      anthropicSet: typeof process.env.ANTHROPIC_API_KEY === 'string',
      anthropicLen: (process.env.ANTHROPIC_API_KEY ?? '').length,
      cloudinaryNameSet: typeof process.env.CLOUDINARY_CLOUD_NAME === 'string',
      // 빌드/런타임 정보
      runtime: 'vercel-function',
      nodeVersion: process.version,
      nowIso: new Date().toISOString(),
    }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
};
