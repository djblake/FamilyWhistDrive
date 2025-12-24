function joinPath(parts) {
  const arr = Array.isArray(parts) ? parts : [parts];
  return arr.map(s => String(s || '').replace(/^\/+|\/+$/g, '')).filter(Boolean).join('/');
}

function isAllowedKey(key) {
  const k = String(key || '');
  if (!k) return false;
  if (k.includes('..')) return false;
  if (k.startsWith('/')) return false;
  return (
    k.startsWith('avatars/') ||
    k.startsWith('tournament-photos/') ||
    k.startsWith('scorecards/') ||
    k.startsWith('player-scorecards/')
  );
}

function cacheControlForKey(key) {
  const k = String(key || '');
  // Avatars can change, so keep caching shorter.
  if (k.startsWith('avatars/')) return 'public, max-age=600';
  return 'public, max-age=31536000, immutable';
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = String(request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) return new Response('Not configured', { status: 501 });

  const key = joinPath(params && params.key ? params.key : '');
  if (!isAllowedKey(key)) return new Response('Not Found', { status: 404 });

  const obj = await bucket.get(key);
  if (!obj) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  const ct = obj.httpMetadata && obj.httpMetadata.contentType ? String(obj.httpMetadata.contentType) : 'application/octet-stream';
  headers.set('Content-Type', ct);
  headers.set('Cache-Control', cacheControlForKey(key));
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

  // Conditional requests
  const inm = request.headers.get('If-None-Match');
  if (inm && obj.httpEtag && inm === obj.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(method === 'HEAD' ? null : obj.body, { status: 200, headers });
}


