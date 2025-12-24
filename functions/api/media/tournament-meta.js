import { requireUploader } from '../../_lib/auth.js';

function jsonResponse(body, { status = 200, cacheControl = 'no-store' } = {}) {
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

async function readMeta(bucket, year) {
  const key = buildTournamentMetaKey(year);
  const obj = await bucket.get(key);
  if (!obj) {
    return {
      schema: 1,
      year: Number(year),
      photos: [],
      coverPicks: [],
      updatedAt: new Date().toISOString()
    };
  }
  const parsed = await obj.json();
  if (!parsed || typeof parsed !== 'object') {
    return {
      schema: 1,
      year: Number(year),
      photos: [],
      coverPicks: [],
      updatedAt: new Date().toISOString()
    };
  }
  parsed.photos = Array.isArray(parsed.photos) ? parsed.photos : [];
  parsed.coverPicks = Array.isArray(parsed.coverPicks) ? parsed.coverPicks : [];
  return parsed;
}

function normalizeCoverPicks(keys) {
  const out = [];
  for (const k of Array.isArray(keys) ? keys : []) {
    const key = String(k || '').trim();
    if (!key) continue;
    if (out.includes(key)) continue;
    out.push(key);
    if (out.length >= 6) break;
  }
  return out;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUploader(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.message }, { status: auth.status });

  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) {
    return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501 });
  }

  let payload = null;
  try {
    payload = await request.json();
  } catch (_) {
    return badRequest('Invalid JSON body');
  }

  const year = String(payload?.year || '').trim();
  if (!year) return badRequest('Missing year');
  if (!/^\d{4}$/.test(year)) return badRequest('Invalid year');

  const requested = normalizeCoverPicks(payload?.coverPicks);
  const prefix = `tournament-photos/${year}/`;
  for (const k of requested) {
    if (!k.startsWith(prefix) || k.includes('..') || k.startsWith('/')) {
      return badRequest('Invalid cover pick key');
    }
  }

  const meta = await readMeta(bucket, year);
  const knownKeys = new Set(meta.photos.map(p => p && p.key).filter(Boolean));
  for (const k of requested) {
    if (!knownKeys.has(k)) {
      return badRequest('Cover pick must be an existing uploaded photo');
    }
  }

  meta.coverPicks = requested;
  meta.updatedAt = new Date().toISOString();

  // Mark coverRank on photos for convenience
  const rankByKey = new Map(meta.coverPicks.map((k, idx) => [k, idx + 1]));
  meta.photos = meta.photos.map((p) => {
    const key = p && p.key ? String(p.key) : '';
    if (!key) return p;
    return { ...p, coverRank: rankByKey.get(key) || 0 };
  });

  await bucket.put(buildTournamentMetaKey(year), JSON.stringify(meta, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });

  return jsonResponse({ ok: true, coverPicks: meta.coverPicks, updatedAt: meta.updatedAt }, { status: 200 });
}




