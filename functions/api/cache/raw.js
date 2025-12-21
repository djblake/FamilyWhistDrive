function jsonResponse(body, { status = 200, cacheControl = 'no-store', etag = null } = {}) {
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': cacheControl
  };
  if (etag) {
    headers.ETag = etag;
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const kv = env && env.WHIST_CACHE;
  if (!kv) {
    return jsonResponse({ error: 'KV binding WHIST_CACHE not configured' }, { status: 501, cacheControl: 'no-store' });
  }

  const url = new URL(request.url);
  const rawHashParam = (url.searchParams.get('rawHash') || '').trim();

  const manifestRaw = await kv.get('manifest');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : null;
  const rawHash = rawHashParam && rawHashParam !== 'current'
    ? rawHashParam
    : (manifest && manifest.rawHash ? manifest.rawHash : null);

  if (!rawHash) {
    return jsonResponse({ error: 'No rawHash available (cache not initialized)' }, { status: 404, cacheControl: 'no-store' });
  }

  const key = `raw:${rawHash}`;
  const raw = await kv.get(key);
  if (!raw) {
    return jsonResponse({ error: `Raw cache not found for rawHash=${rawHash}` }, { status: 404, cacheControl: 'no-store' });
  }

  // For versioned fetches, allow long-lived caching (URL changes when rawHash changes).
  const isVersioned = rawHashParam && rawHashParam !== 'current';
  const cacheControl = isVersioned ? 'public, max-age=31536000, immutable' : 'no-cache';

  // ETag can just be the rawHash for stable versioned content.
  const etag = `"${rawHash}"`;

  const body = JSON.parse(raw);
  return jsonResponse(body, { status: 200, cacheControl, etag });
}





