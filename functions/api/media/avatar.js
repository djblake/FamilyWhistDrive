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

function extFromFile(file) {
  const n = String(file?.name || '').toLowerCase();
  const m = n.match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  const ct = String(file?.type || '').toLowerCase();
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return '';
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = requireUploader(request, env);
  if (!auth.ok) return jsonResponse({ error: auth.message }, { status: auth.status });

  const bucket = env && env.WHIST_MEDIA;
  if (!bucket) {
    return jsonResponse({ error: 'R2 binding WHIST_MEDIA not configured' }, { status: 501 });
  }

  let form = null;
  try {
    form = await request.formData();
  } catch (_) {
    return badRequest('Expected multipart/form-data');
  }

  const playerId = String(form.get('playerId') || '').trim();
  const file = form.get('file');
  if (!playerId) return badRequest('Missing playerId');
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(playerId)) return badRequest('Invalid playerId');
  if (!(file instanceof File)) return badRequest('Missing file');

  const ext = extFromFile(file);
  if (!ext) return badRequest('Unsupported file type (jpg/png/webp)');

  // Store as .jpg for simplicity. (If a PNG/WebP is uploaded, it is still stored as bytes; clients should prefer uploading jpg.)
  const key = `avatars/${playerId}.jpg`;

  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType: 'image/jpeg' },
    customMetadata: { uploadedAt: new Date().toISOString() }
  });

  const publicBaseUrl = env && env.WHIST_MEDIA_PUBLIC_BASE_URL ? String(env.WHIST_MEDIA_PUBLIC_BASE_URL) : '';
  const url = publicBaseUrl ? `${publicBaseUrl.replace(/\\/+$/, '')}/${key}` : null;
  return jsonResponse({ ok: true, key, url });
}



