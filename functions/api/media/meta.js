function jsonResponse(body, { status = 200, cacheControl = 'public, max-age=300' } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl
    }
  });
}

function badRequest(message) {
  return jsonResponse({ error: message }, { status: 400, cacheControl: 'no-store' });
}

function buildTournamentMetaKey(year) {
  return `tournament-photos/${year}/_meta.json`;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) {
    return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501, cacheControl: 'no-store' });
  }

  const url = new URL(request.url);
  const year = (url.searchParams.get('year') || '').trim();
  if (!year) return badRequest('Missing year');
  if (!/^\d{4}$/.test(year)) return badRequest('Invalid year');

  const key = buildTournamentMetaKey(year);
  const obj = await bucket.get(key);
  if (!obj) {
    return jsonResponse({ error: 'Not found' }, { status: 404, cacheControl: 'no-store' });
  }

  const body = await obj.json();
  return jsonResponse(body, { status: 200, cacheControl: 'public, max-age=300' });
}




