function htmlResponse(html, { status = 200 } = {}) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
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
      <form method="POST">
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

export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get('redirect') || '/admin/media-upload.html';
  return htmlResponse(loginPage({ redirectTo }), { status: 200 });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const expected = env && env.WHIST_ADMIN_PASSWORD ? String(env.WHIST_ADMIN_PASSWORD) : '';
  if (!expected) {
    return htmlResponse(loginPage({ error: 'Server not configured: WHIST_ADMIN_PASSWORD missing' }), { status: 501 });
  }

  let form = null;
  try {
    form = await request.formData();
  } catch (_) {
    return htmlResponse(loginPage({ error: 'Expected form submission' }), { status: 400 });
  }

  const password = String(form.get('password') || '').trim();
  const redirectTo = String(form.get('redirect') || '/admin/media-upload.html');
  const safeRedirect = redirectTo.startsWith('/admin/') ? redirectTo : '/admin/media-upload.html';

  if (password !== expected) {
    return htmlResponse(loginPage({ redirectTo: safeRedirect, error: 'Incorrect password' }), { status: 401 });
  }

  // Create 24h signed cookie: payloadB64.sigB64 (HMAC over payloadB64).
  const exp = Date.now() + (24 * 60 * 60 * 1000);
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ exp, v: 1 })));
  const sig = await hmacSha256(expected, payloadB64);
  const sigB64 = base64UrlEncode(sig);
  const cookieValue = `${payloadB64}.${sigB64}`;

  return new Response(null, {
    status: 302,
    headers: {
      'Location': safeRedirect,
      'Set-Cookie': `whist_admin=${cookieValue}; Path=/; Max-Age=86400; HttpOnly; Secure; SameSite=Lax`,
      'Cache-Control': 'no-store'
    }
  });
}



