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

function safeSlug(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function safeFilename(name) {
  const base = String(name || '').trim().replace(/[/\\\\]/g, '_');
  // Remove weird chars but keep dots/dashes/underscores.
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'upload';
}

function extFromFile(file) {
  const n = String(file?.name || '').toLowerCase();
  const m = n.match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  // fallback from content-type
  const ct = String(file?.type || '').toLowerCase();
  if (ct.includes('jpeg')) return 'jpg';
  if (ct.includes('png')) return 'png';
  if (ct.includes('webp')) return 'webp';
  return '';
}

function parsePlayerScorecardFilename(fileName) {
  // Expected: YYYY_Key.jpeg (Key is the Players sheet Key; shared hands join Keys with '_')
  const name = String(fileName || '').trim();
  const m = name.match(/^(\d{4})_(.+?)\.[a-z0-9]{2,5}$/i);
  if (!m) return null;
  const year = m[1];
  const playerKey = String(m[2] || '').trim();
  if (!/^\d{4}$/.test(year)) return null;
  if (!playerKey) return null;
  // Keep strict: key IDs should be simple and stable.
  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(playerKey)) return null;
  return { year, playerKey };
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

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = await requireUploader(request, env);
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

  const kind = String(form.get('kind') || '').trim();
  const file = form.get('file');
  if (!kind) return badRequest('Missing kind');
  if (!(file instanceof File)) return badRequest('Missing file');

  const now = new Date();
  const nowIso = now.toISOString();
  const ts = String(Date.now());

  // Construct key server-side (clients never provide raw key).
  let key = '';
  let contentType = String(file.type || '').trim() || 'application/octet-stream';
  const ext = extFromFile(file);
  if (!ext) return badRequest('Unsupported file type (jpg/png/webp)');

  if (kind === 'scorecard') {
    const year = String(form.get('year') || '').trim();
    const round = String(form.get('round') || '').trim();
    const table = String(form.get('table') || '').trim();
    if (!/^\d{4}$/.test(year)) return badRequest('Invalid year');
    if (!/^\d{1,2}$/.test(round)) return badRequest('Invalid round');
    if (!/^\d{1,2}$/.test(table)) return badRequest('Invalid table');

    key = `scorecards/${year}/r${Number(round)}/t${Number(table)}.${ext}`;
  } else if (kind === 'player-scorecard') {
    // Bulk-friendly: year/playerKey can be provided OR inferred from filename `YYYY_Key.jpeg`.
    let year = String(form.get('year') || '').trim();
    // Accept both names for compatibility: playerKey preferred, playerId legacy.
    let playerKey = String(form.get('playerKey') || '').trim() || String(form.get('playerId') || '').trim();

    if (!year || !playerKey) {
      const parsed = parsePlayerScorecardFilename(file.name);
      if (parsed) {
        year = year || parsed.year;
        playerKey = playerKey || parsed.playerKey;
      }
    }

    if (!/^\d{4}$/.test(year)) return badRequest('Invalid year (expected YYYY)');
    if (!playerKey) return badRequest('Missing playerKey (or filename not in YYYY_Key.jpeg format)');
    if (!/^[a-zA-Z0-9_-]{1,120}$/.test(playerKey)) return badRequest('Invalid playerKey');

    // We store all player scorecards as .jpg. Require JPEG input to avoid mismatches.
    if (ext !== 'jpg') return badRequest('Player scorecards must be JPEG (.jpg/.jpeg)');
    // Include the year in the stored filename so downloads preserve the year context.
    // Example: player-scorecards/1993/1993_David_SteveBlake.jpg
    key = `player-scorecards/${year}/${year}_${playerKey}.jpg`;
    contentType = 'image/jpeg';
  } else if (kind === 'tournament-photo') {
    const year = String(form.get('year') || '').trim();
    const uploaderName = String(form.get('uploaderName') || '').trim();
    if (!/^\d{4}$/.test(year)) return badRequest('Invalid year');
    if (!uploaderName) return badRequest('Missing uploaderName');

    const uploaderSlug = safeSlug(uploaderName) || 'uploader';
    const fname = safeFilename(file.name);
    key = `tournament-photos/${year}/${uploaderSlug}/${ts}_${fname}`;

    // update meta file
    const meta = await readTournamentMeta(bucket, year);
    const exists = meta.photos.some(p => p && p.key === key);
    if (!exists) {
      meta.photos.push({
        key,
        uploaderName,
        uploaderSlug,
        uploadedAt: nowIso,
        originalName: String(file.name || '').slice(0, 200),
        coverRank: 0
      });
    }
    meta.updatedAt = nowIso;

    await bucket.put(buildTournamentMetaKey(year), JSON.stringify(meta, null, 2), {
      httpMetadata: { contentType: 'application/json' }
    });
  } else if (kind === 'avatar') {
    const playerId = String(form.get('playerId') || '').trim();
    if (!playerId) return badRequest('Missing playerId');
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(playerId)) return badRequest('Invalid playerId');

    // Standardize avatars to .jpg to simplify rendering.
    key = `avatars/${playerId}.jpg`;
    contentType = 'image/jpeg';
  } else {
    return badRequest('Unsupported kind');
  }

  if (key.includes('..') || key.startsWith('/')) return badRequest('Invalid key');

  await bucket.put(key, file.stream(), {
    httpMetadata: { contentType },
    customMetadata: {
      uploadedAt: nowIso
    }
  });

  const publicBaseUrl = env && env.WHIST_MEDIA_PUBLIC_BASE_URL ? String(env.WHIST_MEDIA_PUBLIC_BASE_URL) : '';
  const url = publicBaseUrl ? `${publicBaseUrl.replace(/\/+$/, '')}/${key}` : null;
  return jsonResponse({ ok: true, key, url });
}

