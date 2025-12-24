function requireToken(request, env, envKey) {
  const expected = env && env[envKey] ? String(env[envKey]) : '';
  if (!expected) {
    return { ok: false, status: 501, message: `${envKey} not configured` };
  }

  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${expected}`) {
    return { ok: true };
  }

  return { ok: false, status: 401, message: 'Unauthorized' };
}

export function requireAdmin(request, env) {
  return requireToken(request, env, 'WHIST_ADMIN_TOKEN');
}

export function requireUploader(request, env) {
  return requireToken(request, env, 'WHIST_UPLOAD_TOKEN');
}








