import { requireSite } from '../../_lib/auth.js';

function jsonResponse(body, { status = 200, cacheControl = 'no-store' } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl
    }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const auth = await requireSite(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.message }, { status: auth.status });
  return jsonResponse({ ok: true, exp: auth.exp }, { status: 200 });
}


