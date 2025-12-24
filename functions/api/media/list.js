function jsonResponse(body, { status = 200, cacheControl = 'public, max-age=60' } = {}) {
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

export async function onRequestGet(context) {
  const { request, env } = context;
  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) {
    return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501, cacheControl: 'no-store' });
  }

  const url = new URL(request.url);
  const prefix = (url.searchParams.get('prefix') || '').trim();
  const delimiter = (url.searchParams.get('delimiter') || '').trim() || undefined;
  const limitParam = Number(url.searchParams.get('limit') || 1000);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 5000) : 1000;

  if (!prefix) {
    return badRequest('Missing prefix');
  }

  // Prevent obviously dangerous prefixes.
  if (prefix.includes('..') || prefix.startsWith('/')) {
    return badRequest('Invalid prefix');
  }

  let cursor = undefined;
  const objects = [];
  const delimitedPrefixes = new Set();

  while (true) {
    const resp = await bucket.list({ prefix, delimiter, cursor, limit: Math.min(1000, limit) });
    for (const obj of resp.objects || []) {
      objects.push({
        key: obj.key,
        size: obj.size,
        etag: obj.etag,
        uploaded: obj.uploaded ? new Date(obj.uploaded).toISOString() : null
      });
      if (objects.length >= limit) break;
    }
    for (const p of resp.delimitedPrefixes || []) {
      delimitedPrefixes.add(p);
    }
    if (objects.length >= limit) break;
    if (!resp.truncated) break;
    cursor = resp.cursor;
    if (!cursor) break;
  }

  return jsonResponse({
    prefix,
    objects,
    delimitedPrefixes: Array.from(delimitedPrefixes.values()).sort()
  });
}




