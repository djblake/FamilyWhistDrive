import { issueFamilyCookie } from '../../_lib/auth.js';

function jsonResponse(body, { status = 200, cacheControl = 'no-store', headers = {} } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl,
      ...headers
    }
  });
}

function badRequest(message) {
  return jsonResponse({ error: message }, { status: 400, cacheControl: 'no-store' });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const expected = env && env.WHIST_FAMILY_PASSWORD ? String(env.WHIST_FAMILY_PASSWORD) : '';
  if (!expected) {
    return jsonResponse({ error: 'WHIST_FAMILY_PASSWORD not configured' }, { status: 501 });
  }

  let password = '';
  const ct = String(request.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('application/json')) {
    let payload = null;
    try { payload = await request.json(); } catch (_) {}
    password = String(payload?.password || '').trim();
  } else {
    let form = null;
    try { form = await request.formData(); } catch (_) {}
    password = String(form?.get('password') || '').trim();
  }

  if (!password) return badRequest('Missing password');
  if (password !== expected) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }

  // 14 days
  const issued = await issueFamilyCookie(env, { ttlSeconds: 60 * 60 * 24 * 14 });
  if (!issued.ok) {
    return jsonResponse({ error: issued.message || 'Unable to issue cookie' }, { status: issued.status || 500 });
  }

  return jsonResponse(
    { ok: true, exp: issued.exp },
    {
      status: 200,
      headers: {
        'Set-Cookie': `whist_family=${issued.cookieValue}; Path=/; Max-Age=${issued.maxAge}; HttpOnly; Secure; SameSite=Lax`
      }
    }
  );
}


