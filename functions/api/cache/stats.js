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
  const algParam = (url.searchParams.get('alg') || '').trim();

  const manifestRaw = await kv.get('manifest');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : null;

  const rawHash = rawHashParam && rawHashParam !== 'current'
    ? rawHashParam
    : (manifest && manifest.rawHash ? manifest.rawHash : null);

  const alg = algParam
    ? algParam
    : (manifest && manifest.statsAlgorithmVersion ? String(manifest.statsAlgorithmVersion) : null);

  if (!rawHash || !alg) {
    return jsonResponse({ error: 'No rawHash/alg available (cache not initialized)' }, { status: 404, cacheControl: 'no-store' });
  }

  const key = `stats:${rawHash}:alg:${alg}`;
  const raw = await kv.get(key);
  if (!raw) {
    return jsonResponse({ error: `Stats cache not found for rawHash=${rawHash} alg=${alg}` }, { status: 404, cacheControl: 'no-store' });
  }

  const isVersioned = (rawHashParam && rawHashParam !== 'current') || !!algParam;
  const cacheControl = isVersioned ? 'public, max-age=31536000, immutable' : 'no-cache';
  const etag = `"${rawHash}:${alg}"`;

  const body = JSON.parse(raw);
  return jsonResponse(body, { status: 200, cacheControl, etag });
}


