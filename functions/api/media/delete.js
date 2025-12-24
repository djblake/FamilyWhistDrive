import { requireAdmin } from '../../_lib/auth.js';

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

async function readTournamentMeta(bucket, year) {
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
    if (out.length >= 3) break;
  }
  return out;
}

function isSafeKey(key) {
  const k = String(key || '').trim();
  if (!k) return false;
  if (k.includes('..')) return false;
  if (k.startsWith('/')) return false;
  return true;
}

function isAllowedPrefix(key) {
  const k = String(key || '');
  return (
    k.startsWith('avatars/') ||
    k.startsWith('scorecards/') ||
    k.startsWith('player-scorecards/') ||
    k.startsWith('tournament-photos/')
  );
}

function tournamentYearFromKey(key) {
  const m = String(key || '').match(/^tournament-photos\/(\d{4})\//);
  return m ? m[1] : '';
}

async function updateTournamentMetaAfterDelete(bucket, { year, deletedKey }) {
  if (!year || !/^\d{4}$/.test(year)) return;
  if (!deletedKey) return;

  const meta = await readTournamentMeta(bucket, year);
  meta.photos = meta.photos.filter(p => String(p?.key || '') !== deletedKey);
  meta.coverPicks = normalizeCoverPicks((meta.coverPicks || []).filter(k => String(k || '') !== deletedKey));

  // If cover picks reference non-existent keys (e.g. manual edits), prune them.
  const known = new Set(meta.photos.map(p => String(p?.key || '')).filter(Boolean));
  meta.coverPicks = normalizeCoverPicks(meta.coverPicks.filter(k => known.has(String(k || ''))));

  // Update coverRank for remaining photos.
  const rankByKey = new Map(meta.coverPicks.map((k, idx) => [String(k), idx + 1]));
  meta.photos = meta.photos.map((p) => {
    const key = String(p?.key || '');
    if (!key) return p;
    return { ...p, coverRank: rankByKey.get(key) || 0 };
  });
  meta.updatedAt = new Date().toISOString();

  await bucket.put(buildTournamentMetaKey(year), JSON.stringify(meta, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = requireAdmin(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.message }, { status: auth.status });

  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) {
    return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501 });
  }

  let key = '';
  try {
    const ct = String(request.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('application/json')) {
      const payload = await request.json().catch(() => null);
      key = String(payload?.key || '').trim();
    } else {
      const form = await request.formData().catch(() => null);
      key = String(form?.get('key') || '').trim();
    }
  } catch (_) {
    // ignore
  }

  if (!key) return badRequest('Missing key');
  if (!isSafeKey(key)) return badRequest('Invalid key');
  if (!isAllowedPrefix(key)) return badRequest('Key not allowed');

  // Delete object (R2 delete is idempotent).
  await bucket.delete(key);

  // If it was a tournament photo, keep meta consistent.
  const year = tournamentYearFromKey(key);
  if (year) {
    await updateTournamentMetaAfterDelete(bucket, { year, deletedKey: key });
  }

  return jsonResponse({ ok: true, key }, { status: 200 });
}


