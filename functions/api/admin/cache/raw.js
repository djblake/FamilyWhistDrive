import { requireAdmin } from '../../../_lib/auth.js';

function jsonResponse(body, { status = 200, cacheControl = 'no-store' } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheControl
    }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const kv = env && env.WHIST_CACHE;
  if (!kv) {
    return jsonResponse({ error: 'KV binding WHIST_CACHE not configured' }, { status: 501 });
  }

  const auth = requireAdmin(request, env);
  if (!auth.ok) {
    return jsonResponse({ error: auth.message }, { status: auth.status });
  }

  let body;
  try {
    body = await request.json();
  } catch (error) {
    return jsonResponse({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const rawHash = body && body.rawHash ? String(body.rawHash) : '';
  const schemaVersion = body && body.schemaVersion ? Number(body.schemaVersion) : null;

  if (!rawHash || !schemaVersion) {
    return jsonResponse({ error: 'Missing required fields: rawHash, schemaVersion' }, { status: 400 });
  }

  const now = new Date().toISOString();

  // Store versioned raw cache
  await kv.put(`raw:${rawHash}`, JSON.stringify(body));

  // Update manifest pointer
  const manifestRaw = await kv.get('manifest');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : {};

  const nextManifest = {
    ...manifest,
    exists: true,
    rawHash,
    rawUpdatedAt: now,
    // Preserve stats pointers (may not match new raw; stats refresh can update)
    statsAlgorithmVersion: manifest.statsAlgorithmVersion || null,
    statsUpdatedAt: manifest.statsUpdatedAt || null,
    updatedAt: now
  };

  await kv.put('manifest', JSON.stringify(nextManifest));

  return jsonResponse({ ok: true, manifest: nextManifest }, { status: 200 });
}





