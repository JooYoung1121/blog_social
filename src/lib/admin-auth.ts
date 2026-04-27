/**
 * admin-auth.ts — 단일 비밀번호 + HMAC 세션 쿠키
 *
 * - ADMIN_PASSWORD: 사용자 입력 비밀번호 (서버 측 비교)
 * - ADMIN_SESSION_SECRET: HMAC 서명용 시크릿 (랜덤 32바이트 hex 권장)
 *
 * 쿠키 값 형식: <expiresAtMs>.<hmacHex>
 */
import crypto from 'node:crypto';

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일
export const SESSION_COOKIE = 'admin_session';

function timingSafeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmac(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function verifyPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return timingSafeEq(input, expected);
}

export function createSession(): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET 환경변수 필요');
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = String(expiresAt);
  return `${payload}.${hmac(payload, secret)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false;
  const idx = token.indexOf('.');
  if (idx < 0) return false;
  const payload = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  if (!timingSafeEq(sig, hmac(payload, secret))) return false;
  const expiresAt = Number.parseInt(payload, 10);
  if (!Number.isFinite(expiresAt)) return false;
  return Date.now() < expiresAt;
}
