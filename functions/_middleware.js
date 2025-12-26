function htmlResponse(html, { status = 200 } = {}) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet'
    }
  });
}

function isAllowedMediaKey(key) {
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

function cacheControlForMediaKey(key) {
  const k = String(key || '');
  // Meta files and user-managed media can be deleted/changed; always revalidate so deletions show up.
  if (k.endsWith('/_meta.json') || k.endsWith('_meta.json')) {
    return 'no-store';
  }
  if (k.startsWith('tournament-photos/')) {
    return 'public, max-age=0, must-revalidate';
  }
  // Avatars can change too.
  if (k.startsWith('avatars/')) {
    return 'public, max-age=0, must-revalidate';
  }
  // Scorecards are relatively stable, but still allow quick deletes/updates.
  if (k.startsWith('scorecards/') || k.startsWith('player-scorecards/')) {
    return 'public, max-age=0, must-revalidate';
  }
  return 'public, max-age=0, must-revalidate';
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

async function verifySiteCookie(cookieValue, env) {
  const password = env && env.WHIST_SITE_PASSWORD ? String(env.WHIST_SITE_PASSWORD) : '';
  if (!password) return { ok: false, reason: 'WHIST_SITE_PASSWORD not configured' };

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

function gatePage({ next = '/' } = {}) {
  const safeNext = String(next || '/').startsWith('/') ? String(next) : '/';
  const parrotSrc = '/assets/images/WhistParrot_256.png';
  const parrotSrcSet = [
    '/assets/images/WhistParrot_256.png 256w',
    '/assets/images/WhistParrot.png 1024w'
  ].join(', ');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
  <title>Ruston Family Whist Drive</title>
  <style>
    html, body { height: 100%; }
    body {
      margin: 0;
      background: #fff;
      color: #111;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    }
    .wrap {
      min-height: 100%;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(520px, 92vw);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .parrot {
      width: min(320px, 70vw);
      height: auto;
      display: block;
    }
    .parrot-caption {
      font-size: 22px;
      font-weight: 650;
      font-style: italic;
      color: #111;
      margin-top: -8px;
      margin-bottom: 2px;
    }
    #gateForm {
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .pw-row {
      position: relative;
      width: min(300px, 78vw);
    }
    input {
      width: 100%;
      font-size: 18px;
      box-sizing: border-box;
      height: 48px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.2);
      background: #fff;
      color: #111;
      outline: none;
    }
    input:focus {
      border-color: rgba(15, 23, 42, 0.4);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
    }
    .submit-btn {
      width: fit-content;
      max-width: 100%;
      box-sizing: border-box;
      height: 48px;
      padding: 0 22px;
      border-radius: 12px;
      border: 1px solid rgba(15, 23, 42, 0.22);
      background: #fff;
      color: #111;
      font-size: 16px;
      font-weight: 900;
      cursor: pointer;
      white-space: nowrap;
      margin-top: 14px;
      align-self: center;
    }
    .submit-btn:hover {
      background: rgba(15, 23, 42, 0.04);
    }
    .submit-btn:active {
      transform: translateY(1px);
    }
    .submit-btn:focus-visible {
      outline: 3px solid rgba(59, 130, 246, 0.25);
      outline-offset: 3px;
    }
    .msg { min-height: 20px; font-weight: 700; color: #991b1b; }
    .hint { font-size: 13px; color: rgba(15, 23, 42, 0.55); text-align: center; margin-top: 4px; }
    .continue {
      display: none;
      font-size: 14px;
      font-weight: 800;
      color: #111;
      text-decoration: underline;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }
    .pw-stack {
      display: flex;
      flex-direction: column;
      gap: 0;
      align-items: stretch;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <img
        class="parrot"
        src="${parrotSrc}"
        srcset="${parrotSrcSet}"
        sizes="(max-width: 640px) 70vw, 320px"
        alt="Parrot mascot"
      />
      <div class="parrot-caption">"Hello, talk to me?"</div>
      <form id="gateForm" autocomplete="off">
        <div class="pw-row pw-stack">
          <input id="pw" type="password" inputmode="text" autocomplete="current-password" aria-label="Password" placeholder="Password" />
          <div class="hint">Enter the password to continue.</div>
          <button class="submit-btn" type="submit">Open Sesame</button>
        </div>
      </form>
      <div class="msg" id="msg"></div>
      <button class="continue" id="continueBtn" type="button">Continue</button>
    </div>
  </div>
  <script>
    const NEXT = ${JSON.stringify(safeNext)};
    const helloUrl = '/assets/audio/ParrotHelloTTM.m4a';
    const tuneUrl = '/assets/audio/ParrotTune1Short.m4a';

    let helloAttempted = false;
    function tryPlayHello() {
      if (helloAttempted) return Promise.resolve(false);
      helloAttempted = true;
      try {
        const a = new Audio(helloUrl);
        a.volume = 1.0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          return p.then(() => true).catch(() => {
            // Autoplay blocked; allow retry on first gesture.
            helloAttempted = false;
            return false;
          });
        }
        return Promise.resolve(true);
      } catch (_) {
        helloAttempted = true;
        return Promise.resolve(false);
      }
    }

    function retryHelloUntilItPlays() {
      let tries = 0;
      const maxTries = 6;
      const onGesture = async () => {
        tries += 1;
        const ok = await tryPlayHello();
        if (ok || tries >= maxTries) {
          window.removeEventListener('pointerdown', onGesture);
          window.removeEventListener('keydown', onGesture);
        }
      };
      window.addEventListener('pointerdown', onGesture);
      window.addEventListener('keydown', onGesture);
    }

    // Some browsers require a user gesture, but you can "unlock" audio on the submit click
    // so the success tune can play even after an async fetch.
    async function unlockAudioForThisPage() {
      try {
        const a = new Audio(helloUrl);
        a.muted = true;
        a.volume = 0;
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          await p.catch(() => {});
        }
        try { a.pause(); } catch (_) {}
        try { a.currentTime = 0; } catch (_) {}
      } catch (_) {}
    }

    async function playTuneAndContinue() {
      let done = false;
      let ended = false;
      let playStarted = false;
      const go = () => {
        if (done) return;
        done = true;
        try {
          if (!ended) {
            sessionStorage.setItem('whist_post_login_tune', 'ParrotTune1Short');
          }
        } catch (_) {}
        window.location.href = NEXT;
      };
      const btn = document.getElementById('continueBtn');
      if (btn) {
        btn.style.display = 'inline';
        btn.addEventListener('click', go, { once: true });
      }

      try {
        const a = new Audio(tuneUrl);
        a.volume = 1.0;
        a.addEventListener('ended', () => {
          ended = true;
          go();
        }, { once: true });
        const p = a.play();
        if (p && typeof p.catch === 'function') {
          // If play fails (policy), don't instantly redirect; user can press Continue.
          playStarted = true;
          p.catch(() => {
            try { sessionStorage.setItem('whist_post_login_tune', 'ParrotTune1Short'); } catch (_) {}
          });
        } else {
          playStarted = true;
        }
      } catch (_) {
        // If audio cannot play, fall back to the Continue button.
        try { sessionStorage.setItem('whist_post_login_tune', 'ParrotTune1Short'); } catch (_) {}
      }

      // Safety net: don't trap the user if audio never fires ended.
      setTimeout(() => {
        // If audio never started, make sure next page can try.
        try {
          if (!playStarted) sessionStorage.setItem('whist_post_login_tune', 'ParrotTune1Short');
        } catch (_) {}
        go();
      }, 12000);
    }

    tryPlayHello();
    retryHelloUntilItPlays();

    const form = document.getElementById('gateForm');
    const pw = document.getElementById('pw');
    const msg = document.getElementById('msg');
    if (pw) setTimeout(() => pw.focus(), 50);

    async function submit() {
      if (!pw) return;
      const password = String(pw.value || '').trim();
      if (!password) return;
      if (msg) msg.textContent = '';

      // User-gesture phase (before any await): unlock audio so success tune can play later.
      unlockAudioForThisPage();

      try {
        const res = await fetch('/api/site/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ password })
        });
        if (!res.ok) {
          if (msg) msg.textContent = 'Wrong password';
          pw.select();
          return;
        }
        pw.disabled = true;
        await playTuneAndContinue();
      } catch (e) {
        if (msg) msg.textContent = 'Unable to sign in';
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        submit();
      });
    }
  </script>
</body>
</html>`;
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname || '/';

  // Dedicated login page (always show gate, even if already signed in).
  if (path === '/login' || path === '/login/') {
    const next = url.searchParams.get('next') || '/';
    return htmlResponse(gatePage({ next }));
  }

  // Allowlist for assets and site-login API so the gate can function.
  const allowUnauthed = (
    path.startsWith('/assets/') ||
    path === '/robots.txt' ||
    path === '/api/site/login' ||
    path === '/api/site/status' ||
    path === '/api/site/logout'
  );
  if (allowUnauthed) {
    return context.next();
  }

  // Site-wide gate (everything else).
  const cookies = parseCookies(request.headers.get('Cookie'));
  const siteCookie = cookies.whist_site || '';
  const siteOk = await verifySiteCookie(siteCookie, env);
  if (!siteOk.ok) {
    return htmlResponse(gatePage({ next: path + url.search }));
  }

  // Same-origin media gateway: /media/<key> -> R2 WHIST_MEDIA (only after site gate).
  if (path.startsWith('/media/')) {
    const method = String(request.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const bucket = env && env.WHIST_MEDIA;
    if (!bucket) return new Response('Not configured', { status: 501 });

    const key = String(path.slice('/media/'.length) || '').replace(/^\/+/, '');
    if (!isAllowedMediaKey(key)) return new Response('Not Found', { status: 404 });

    const obj = await bucket.get(key);
    if (!obj) {
      return new Response('Not Found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const headers = new Headers();
    const ct = obj.httpMetadata && obj.httpMetadata.contentType ? String(obj.httpMetadata.contentType) : 'application/octet-stream';
    headers.set('Content-Type', ct);
    headers.set('Cache-Control', cacheControlForMediaKey(key));
    headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    if (obj.httpEtag) headers.set('ETag', obj.httpEtag);

    const inm = request.headers.get('If-None-Match');
    if (inm && obj.httpEtag && inm === obj.httpEtag) {
      return new Response(null, { status: 304, headers });
    }

    return new Response(method === 'HEAD' ? null : obj.body, { status: 200, headers });
  }

  // Admin gate still applies (but only reachable after site gate).
  if (path === '/admin/login') {
    return context.next();
  }

  if (path.startsWith('/admin/')) {
    const authCookie = cookies.whist_admin || '';
    const ok = await verifyAdminCookie(authCookie, env);
    if (ok.ok) return context.next();
    return htmlResponse(loginPage({ redirectTo: path }));
  }

  return context.next();
}



