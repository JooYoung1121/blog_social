import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, verifySession } from './lib/admin-auth';

const PUBLIC_ADMIN_PATHS = new Set([
  '/admin/login',
  '/srv/admin/login',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, request } = context;
  const pathname = url.pathname;

  const isAdminPage = pathname.startsWith('/admin');
  const isAdminApi = pathname.startsWith('/srv/admin');

  if (!isAdminPage && !isAdminApi) return next();
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return next();

  const token = cookies.get(SESSION_COOKIE)?.value;
  if (verifySession(token)) return next();

  // API 호출이면 401, 페이지면 리다이렉트
  if (isAdminApi) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return redirect('/admin/login');
});
