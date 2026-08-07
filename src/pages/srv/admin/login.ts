export const prerender = false;

import type { APIRoute } from 'astro';
import { createSession, SESSION_COOKIE, verifyPassword } from '../../../lib/admin-auth';

/**
 * 단일 비밀번호 인증이라 무차별 대입에 약하다.
 * 서버리스 인스턴스 메모리 기준의 가벼운 제한 — 완벽한 방어는 아니지만
 * 자동 대입 속도를 크게 떨어뜨린다. (인스턴스가 재활용되는 동안 유지)
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS });
    return { blocked: false, retryAfterSec: 0 };
  }
  if (rec.count >= MAX_ATTEMPTS) {
    return { blocked: true, retryAfterSec: Math.ceil((rec.resetAt - now) / 1000) };
  }
  return { blocked: false, retryAfterSec: 0 };
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  const ip = clientAddress || request.headers.get('x-forwarded-for') || 'unknown';
  const limit = rateLimit(ip);
  if (limit.blocked) {
    return new Response(
      JSON.stringify({
        error: `시도가 너무 많아요. ${Math.ceil(limit.retryAfterSec / 60)}분 뒤에 다시 시도해주세요.`,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(limit.retryAfterSec),
        },
      },
    );
  }

  const { password } = await request.json().catch(() => ({}));
  if (!password || !verifyPassword(password)) {
    const rec = attempts.get(ip);
    if (rec) rec.count += 1;
    // 타이밍 공격 완화 + 자동 대입 속도 저하
    await new Promise((r) => setTimeout(r, 600));
    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  attempts.delete(ip);
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
