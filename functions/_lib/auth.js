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

function base64UrlEncode(bytes) {
  let binary = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecodeToBytes(str) {
  const s = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(String(secret || '')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(String(message || '')));
  return new Uint8Array(sig);
}

async function verifySignedCookie(cookieValue, secret) {
  const raw = String(cookieValue || '');
  const parts = raw.split('.');
  if (parts.length !== 2) return { ok: false, reason: 'Malformed cookie' };
  const payloadB64 = parts[0];
  const sigB64 = parts[1];
  if (!payloadB64 || !sigB64) return { ok: false, reason: 'Malformed cookie' };

  let payloadJson = null;
  try {
    payloadJson = new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64));
  } catch (_) {
    return { ok: false, reason: 'Bad payload' };
  }

  let payload = null;
  try {
    payload = JSON.parse(payloadJson);
  } catch (_) {
    return { ok: false, reason: 'Bad payload JSON' };
  }

  const exp = Number(payload && payload.exp);
  if (!Number.isFinite(exp)) return { ok: false, reason: 'Bad exp' };
  if (Date.now() > exp) return { ok: false, reason: 'Expired' };

  const expectedSig = await hmacSha256(secret, payloadB64);
  const expectedB64 = base64UrlEncode(expectedSig);
  if (expectedB64 !== sigB64) return { ok: false, reason: 'Bad signature' };

  return { ok: true, exp };
}

function requireBearerToken(request, env, envKey) {
  const expected = env && env[envKey] ? String(env[envKey]) : '';
  if (!expected) {
    return { ok: false, status: 501, message: `${envKey} not configured` };
  }
  const auth = request.headers.get('authorization') || '';
  if (auth === `Bearer ${expected}`) {
    return { ok: true };
  }
  return { ok: false, status: 401, message: 'Unauthorized' };
}

export async function requireAdmin(request, env) {
  // Option A: Bearer admin token (good for curl / automation).
  const token = env && env.WHIST_ADMIN_TOKEN ? String(env.WHIST_ADMIN_TOKEN) : '';
  if (token) {
    const auth = request.headers.get('authorization') || '';
    if (auth === `Bearer ${token}`) return { ok: true };
  }

  // Option B: Admin cookie (good for the website admin UI).
  const password = env && env.WHIST_ADMIN_PASSWORD ? String(env.WHIST_ADMIN_PASSWORD) : '';
  if (password) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const c = cookies.whist_admin || '';
    // Cookie is signed with WHIST_ADMIN_PASSWORD.
    // Reuse shared signed-cookie verifier (payloadB64.sigB64).
    // Note: this enforces expiration.
    const verified = await verifySignedCookie(c, password);
    if (verified.ok) return { ok: true, exp: verified.exp };
    return { ok: false, status: 401, message: 'Unauthorized' };
  }

  // If neither auth mechanism is configured, return 501.
  return { ok: false, status: 501, message: 'Admin auth not configured (WHIST_ADMIN_TOKEN or WHIST_ADMIN_PASSWORD)' };
}

export async function requireUploader(request, env) {
  // Option A: classic bearer token (good for admin tooling / curl).
  const token = env && env.WHIST_UPLOAD_TOKEN ? String(env.WHIST_UPLOAD_TOKEN) : '';
  if (token) {
    const auth = request.headers.get('authorization') || '';
    if (auth === `Bearer ${token}`) return { ok: true };
  }

  // Option B: family cookie (good for public upload pages).
  const familyPw = env && env.WHIST_FAMILY_PASSWORD ? String(env.WHIST_FAMILY_PASSWORD) : '';
  if (familyPw) {
    const cookies = parseCookies(request.headers.get('Cookie'));
    const c = cookies.whist_family || '';
    const verified = await verifySignedCookie(c, familyPw);
    if (verified.ok) return { ok: true };
  }

  // If neither auth mechanism is configured, return 501.
  if (!token && !familyPw) {
    return { ok: false, status: 501, message: 'Upload auth not configured' };
  }

  return { ok: false, status: 401, message: 'Unauthorized' };
}

export async function requireFamily(request, env) {
  const familyPw = env && env.WHIST_FAMILY_PASSWORD ? String(env.WHIST_FAMILY_PASSWORD) : '';
  if (!familyPw) return { ok: false, status: 501, message: 'WHIST_FAMILY_PASSWORD not configured' };
  const cookies = parseCookies(request.headers.get('Cookie'));
  const c = cookies.whist_family || '';
  const verified = await verifySignedCookie(c, familyPw);
  if (verified.ok) return { ok: true, exp: verified.exp };
  return { ok: false, status: 401, message: 'Unauthorized' };
}

export async function requireSite(request, env) {
  const sitePw = env && env.WHIST_SITE_PASSWORD ? String(env.WHIST_SITE_PASSWORD) : '';
  if (!sitePw) return { ok: false, status: 501, message: 'WHIST_SITE_PASSWORD not configured' };
  const cookies = parseCookies(request.headers.get('Cookie'));
  const c = cookies.whist_site || '';
  const verified = await verifySignedCookie(c, sitePw);
  if (verified.ok) return { ok: true, exp: verified.exp };
  return { ok: false, status: 401, message: 'Unauthorized' };
}

export async function issueFamilyCookie(env, { ttlSeconds = 60 * 60 * 24 * 14 } = {}) {
  const familyPw = env && env.WHIST_FAMILY_PASSWORD ? String(env.WHIST_FAMILY_PASSWORD) : '';
  if (!familyPw) return { ok: false, status: 501, message: 'WHIST_FAMILY_PASSWORD not configured' };
  const exp = Date.now() + (Math.max(60, Number(ttlSeconds) || 0) * 1000);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ exp, v: 1 })));
  const sig = await hmacSha256(familyPw, payloadB64);
  const sigB64 = base64UrlEncode(sig);
  const cookieValue = `${payloadB64}.${sigB64}`;
  return { ok: true, exp, cookieValue, maxAge: Math.floor((exp - Date.now()) / 1000) };
}

export async function issueSiteCookie(env, { ttlSeconds = 60 * 60 * 24 * 30 } = {}) {
  const sitePw = env && env.WHIST_SITE_PASSWORD ? String(env.WHIST_SITE_PASSWORD) : '';
  if (!sitePw) return { ok: false, status: 501, message: 'WHIST_SITE_PASSWORD not configured' };
  const exp = Date.now() + (Math.max(60, Number(ttlSeconds) || 0) * 1000);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ exp, v: 1 })));
  const sig = await hmacSha256(sitePw, payloadB64);
  const sigB64 = base64UrlEncode(sig);
  const cookieValue = `${payloadB64}.${sigB64}`;
  return { ok: true, exp, cookieValue, maxAge: Math.floor((exp - Date.now()) / 1000) };
}








