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

  const auth = await requireAdmin(request, env);
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
  const statsAlgorithmVersion = body && body.statsAlgorithmVersion ? String(body.statsAlgorithmVersion) : '';

  if (!rawHash || !schemaVersion || !statsAlgorithmVersion) {
    return jsonResponse({ error: 'Missing required fields: rawHash, schemaVersion, statsAlgorithmVersion' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const key = `stats:${rawHash}:alg:${statsAlgorithmVersion}`;
  await kv.put(key, JSON.stringify(body));

  const manifestRaw = await kv.get('manifest');
  const manifest = manifestRaw ? JSON.parse(manifestRaw) : {};

  const nextManifest = {
    ...manifest,
    exists: true,
    rawHash: manifest.rawHash || rawHash,
    rawUpdatedAt: manifest.rawUpdatedAt || null,
    statsAlgorithmVersion,
    statsUpdatedAt: now,
    updatedAt: now
  };
  await kv.put('manifest', JSON.stringify(nextManifest));

  return jsonResponse({ ok: true, manifest: nextManifest }, { status: 200 });
}








