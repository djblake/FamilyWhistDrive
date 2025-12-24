import { requireUploader } from '../_lib/auth.js';

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

function parseCookies(cookieHeader) {
  const out = {};
  const raw = String(cookieHeader || '');
  if (!raw) return out;
  raw.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx <= 0) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function base64UrlDecodeToBytes(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function base64UrlEncode(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(message || '')));
  return new Uint8Array(sig);
}

async function requireAdminCookie(request, env) {
  const password = env && env.WHIST_ADMIN_PASSWORD ? String(env.WHIST_ADMIN_PASSWORD) : '';
  if (!password) return { ok: false, status: 501, message: 'WHIST_ADMIN_PASSWORD not configured' };
  const cookies = parseCookies(request.headers.get('Cookie'));
  const raw = String(cookies.whist_admin || '');
  const parts = raw.split('.');
  if (parts.length !== 2) return { ok: false, status: 401, message: 'Unauthorized' };
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  if (!payloadB64 || !sigB64) return { ok: false, status: 401, message: 'Unauthorized' };

  let payloadJson = null;
  try {
    payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64));
  } catch (_) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  let payload = null;
  try {
    payload = JSON.parse(payloadJson);
  } catch (_) {
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  const exp = Number(payload && payload.exp);
  if (!Number.isFinite(exp)) return { ok: false, status: 401, message: 'Unauthorized' };
  if (Date.now() > exp) return { ok: false, status: 401, message: 'Unauthorized' };

  const expectedSig = await hmacSha256(password, payloadB64);
  const expectedB64 = base64UrlEncode(expectedSig);
  if (expectedB64 !== sigB64) return { ok: false, status: 401, message: 'Unauthorized' };

  return { ok: true };
}

function buildKey(year) {
  return `tournament-day/${year}/notes.json`;
}

function makeId() {
  if (crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function readNotes(bucket, year) {
  const key = buildKey(year);
  const obj = await bucket.get(key);
  if (!obj) {
    return { schema: 1, year: Number(year), stories: [], quotes: [], updatedAt: new Date().toISOString() };
  }
  let parsed = null;
  try {
    parsed = await obj.json();
  } catch (_) {
    parsed = null;
  }
  if (!parsed || typeof parsed !== 'object') {
    return { schema: 1, year: Number(year), stories: [], quotes: [], updatedAt: new Date().toISOString() };
  }
  parsed.stories = Array.isArray(parsed.stories) ? parsed.stories : [];
  parsed.quotes = Array.isArray(parsed.quotes) ? parsed.quotes : [];
  parsed.schema = 1;
  parsed.year = Number(year);
  parsed.updatedAt = String(parsed.updatedAt || new Date().toISOString());
  return parsed;
}

async function writeNotes(bucket, year, notes) {
  const key = buildKey(year);
  await bucket.put(key, JSON.stringify(notes, null, 2), {
    httpMetadata: { contentType: 'application/json' }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = String(request.method || 'GET').toUpperCase();
  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501 });

  const year = String(url.searchParams.get('year') || '').trim();
  if (!/^\d{4}$/.test(year)) return badRequest('Invalid year');

  if (method === 'GET') {
    const notes = await readNotes(bucket, year);
    return jsonResponse({
      ok: true,
      year: Number(year),
      stories: notes.stories || [],
      quotes: notes.quotes || [],
      updatedAt: notes.updatedAt || null
    }, { status: 200, cacheControl: 'no-store' });
  }

  if (method !== 'POST') {
    return jsonResponse({ error: 'Method Not Allowed' }, { status: 405 });
  }

  let body = null;
  try {
    body = await request.json();
  } catch (_) {
    return badRequest('Expected JSON body');
  }

  const action = String(body?.action || 'add').trim().toLowerCase();

  if (action === 'delete') {
    const admin = await requireAdminCookie(request, env);
    if (!admin.ok) return jsonResponse({ error: admin.message }, { status: admin.status });

    const type = String(body?.type || '').trim().toLowerCase();
    const id = String(body?.id || '').trim();
    if (!id) return badRequest('Missing id');
    if (type !== 'story' && type !== 'quote') return badRequest('Invalid type');

    const notes = await readNotes(bucket, year);
    if (type === 'story') {
      notes.stories = (notes.stories || []).filter(x => String(x?.id || '') !== id);
    } else {
      notes.quotes = (notes.quotes || []).filter(x => String(x?.id || '') !== id);
    }
    notes.updatedAt = new Date().toISOString();
    await writeNotes(bucket, year, notes);
    return jsonResponse({ ok: true }, { status: 200, cacheControl: 'no-store' });
  }

  // Default: add
  // Accept either:
  // - Family cookie / upload token (requireUploader), OR
  // - Direct password in request body (for simple one-off submissions from modals)
  const suppliedPw = String(body?.password || '').trim();
  const familyPw = env && env.WHIST_FAMILY_PASSWORD ? String(env.WHIST_FAMILY_PASSWORD) : '';
  const pwOk = Boolean(familyPw && suppliedPw && suppliedPw === familyPw);
  if (!pwOk) {
    const auth = await requireUploader(request, env);
    if (!auth.ok) return jsonResponse({ error: auth.message }, { status: auth.status });
  }

  const type = String(body?.type || '').trim().toLowerCase();
  if (type !== 'story' && type !== 'quote') return badRequest('Invalid type');

  const createdAt = new Date().toISOString();
  const id = makeId();

  const author = String(body?.author || '').trim().slice(0, 80);
  const text = String(body?.text || '').trim();
  if (!author) return badRequest('Missing author');
  if (!text) return badRequest('Missing text');

  const notes = await readNotes(bucket, year);
  notes.updatedAt = createdAt;

  if (type === 'story') {
    if (text.length > 4000) return badRequest('Story too long');
    notes.stories.push({ id, author, text, createdAt });
  } else {
    const saidBy = String(body?.saidBy || '').trim().slice(0, 80);
    if (!saidBy) return badRequest('Missing saidBy');
    if (text.length > 600) return badRequest('Quote too long');
    notes.quotes.push({ id, author, saidBy, text, createdAt });
  }

  await writeNotes(bucket, year, notes);
  return jsonResponse({ ok: true, id, createdAt }, { status: 200, cacheControl: 'no-store' });
}


