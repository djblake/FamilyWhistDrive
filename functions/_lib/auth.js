export function requireAdmin(request, env) {
  const expected = env && env.WHIST_ADMIN_TOKEN ? String(env.WHIST_ADMIN_TOKEN) : '';
  if (!expected) {
    return { ok: false, status: 501, message: 'WHIST_ADMIN_TOKEN not configured' };
  }

  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${expected}`) {
    return { ok: true };
  }

  return { ok: false, status: 401, message: 'Unauthorized' };
}





