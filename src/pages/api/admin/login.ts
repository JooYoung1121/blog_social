export const prerender = false;

import type { APIRoute } from 'astro';
import { createSession, SESSION_COOKIE, verifyPassword } from '../../../lib/admin-auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  const { password } = await request.json().catch(() => ({}));
  if (!password || !verifyPassword(password)) {
    return new Response(
      JSON.stringify({
        error: 'Invalid password',
        // TEMP DEBUG — 진단 끝나면 제거
        _debug: {
          envSet: typeof process.env.ADMIN_PASSWORD === 'string',
          envLen: (process.env.ADMIN_PASSWORD ?? '').length,
          sessionSecretSet: typeof process.env.ADMIN_SESSION_SECRET === 'string',
          sessionSecretLen: (process.env.ADMIN_SESSION_SECRET ?? '').length,
          inputLen: typeof password === 'string' ? password.length : -1,
          inputType: typeof password,
        },
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }
  cookies.set(SESSION_COOKIE, createSession(), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
