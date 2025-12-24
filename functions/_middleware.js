function htmlResponse(html, { status = 200 } = {}) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
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

async function verifyAdminCookie(cookieValue, env) {
  const password = env && env.WHIST_ADMIN_PASSWORD ? String(env.WHIST_ADMIN_PASSWORD) : '';
  if (!password) return { ok: false, reason: 'WHIST_ADMIN_PASSWORD not configured' };

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

  const expectedSig = await hmacSha256(password, payloadB64);
  const expectedB64 = base64UrlEncode(expectedSig);
  if (expectedB64 !== sigB64) return { ok: false, reason: 'Bad signature' };

  return { ok: true };
}

function loginPage({ redirectTo = '/admin/media-upload.html', error = '' } = {}) {
  const safeRedirect = String(redirectTo || '').startsWith('/admin/') ? String(redirectTo) : '/admin/media-upload.html';
  const err = error ? `<p style="margin:0 0 0.75rem; color:#991b1b; font-weight:700;">${error}</p>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Admin Login | Ruston Family Whist Drive</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b1f14; color:#fff; margin:0; }
    .wrap { max-width: 560px; margin: 8vh auto; padding: 0 16px; }
    .card { background: rgba(255,255,255,0.10); border: 1px solid rgba(255,255,255,0.18); border-radius: 16px; padding: 20px; }
    h1 { margin: 0 0 6px; font-size: 22px; }
    p { margin: 0 0 14px; color: rgba(255,255,255,0.82); }
    label { display:block; font-weight: 800; margin: 10px 0 6px; }
    input { width: 100%; padding: 12px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.25); background: rgba(0,0,0,0.18); color:#fff; font-size: 16px; }
    button { margin-top: 12px; width: 100%; padding: 12px 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.25); background: rgba(255,255,255,0.14); color:#fff; font-weight: 900; cursor: pointer; }
    button:hover { background: rgba(255,255,255,0.18); text-decoration: underline; }
    .small { font-size: 13px; color: rgba(255,255,255,0.72); margin-top: 10px; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Admin login</h1>
      <p>Enter the admin password to access upload tools.</p>
      ${err}
      <form method="POST" action="/admin/login">
        <input type="hidden" name="redirect" value="${safeRedirect}" />
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="current-password" />
        <button type="submit">Continue</button>
      </form>
      <div class="small">This gate controls access to <code>/admin/</code> pages. Uploads also require the separate upload token.</div>
    </div>
  </div>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname || '/';

  // Only protect /admin/* paths.
  if (!path.startsWith('/admin/')) {
    return context.next();
  }

  // Allow login endpoint through.
  if (path === '/admin/login') {
    return context.next();
  }

  // Check cookie
  const cookies = parseCookies(request.headers.get('Cookie'));
  const authCookie = cookies.whist_admin || '';
  const ok = await verifyAdminCookie(authCookie, env);
  if (ok.ok) {
    return context.next();
  }

  return htmlResponse(loginPage({ redirectTo: path }));
}



