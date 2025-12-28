(() => {
  const SORT_LATEST = 'latest';
  const SORT_TOURNAMENT = 'tournament';

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getSortMode() {
    const url = new URL(window.location.href);
    const raw = String(url.searchParams.get('sort') || '').trim().toLowerCase();
    return raw === SORT_TOURNAMENT ? SORT_TOURNAMENT : SORT_LATEST;
  }

  function setActiveSortButtons(mode) {
    const latest = document.getElementById('sort-latest');
    const tournament = document.getElementById('sort-tournament');
    if (!latest || !tournament) return;
    if (mode === SORT_TOURNAMENT) {
      latest.classList.remove('btn-primary');
      latest.classList.add('btn-secondary');
      tournament.classList.remove('btn-secondary');
      tournament.classList.add('btn-primary');
    } else {
      tournament.classList.remove('btn-primary');
      tournament.classList.add('btn-secondary');
      latest.classList.remove('btn-secondary');
      latest.classList.add('btn-primary');
    }
  }

  function updateSubtitle(mode) {
    const el = document.getElementById('stream-sub');
    if (!el) return;
    if (mode === SORT_TOURNAMENT) {
      el.textContent = 'Browse by tournament year, with uploader sections in first-upload order.';
    } else {
      el.textContent = 'Latest uploads from across all tournaments (interleaved by uploader + year).';
    }
  }

  async function getYearsWithPhotos() {
    if (!(window.WhistMedia && typeof window.WhistMedia.listPrefix === 'function')) return [];
    const listing = await window.WhistMedia.listPrefix('tournament-photos/', { delimiter: '/', limit: 5000 });
    const prefixes = Array.isArray(listing?.delimitedPrefixes) ? listing.delimitedPrefixes : [];
    const years = [];
    for (const p of prefixes) {
      const m = String(p || '').match(/^tournament-photos\/(\d{4})\/$/);
      if (m) years.push(m[1]);
    }
    // Descending year by default (useful for tournament view; latest view will re-order groups anyway)
    years.sort((a, b) => String(b).localeCompare(String(a)));
    return years;
  }

  function normalizeUploader(p) {
    const name = String(p?.uploaderName || '').trim();
    const slug = String(p?.uploaderSlug || '').trim();
    return name || slug || 'Unknown';
  }

  function iso(s) {
    const t = String(s || '').trim();
    return t && /^\d{4}-\d{2}-\d{2}T/.test(t) ? t : '';
  }

  async function loadAllPhotos() {
    if (!(window.WhistMedia && typeof window.WhistMedia.getTournamentMeta === 'function')) return [];
    const years = await getYearsWithPhotos();
    if (!years.length) return [];

    const metas = await Promise.all(
      years.map(async (year) => {
        try {
          const meta = await window.WhistMedia.getTournamentMeta(year);
          return { year, meta };
        } catch (_) {
          return { year, meta: null };
        }
      })
    );

    const out = [];
    for (const { year, meta } of metas) {
      const photos = Array.isArray(meta?.photos) ? meta.photos : [];
      for (const p of photos) {
        const key = String(p?.key || '').trim();
        if (!key) continue;
        out.push({
          year,
          key,
          thumbKey: String(p?.thumbKey || '').trim(),
          uploader: normalizeUploader(p),
          uploaderSlug: String(p?.uploaderSlug || '').trim(),
          uploadedAt: iso(p?.uploadedAt),
          originalName: String(p?.originalName || '').trim()
        });
      }
    }
    return out;
  }

  async function buildKeyUrlCache() {
    const cache = new Map(); // key -> Promise<string>
    const toUrl = async (key) => {
      const k = String(key || '').trim();
      if (!k) return '';
      if (cache.has(k)) return await cache.get(k);
      const p = (async () => {
        try {
          return await window.WhistMedia.publicUrlForKey(k);
        } catch (_) {
          return '';
        }
      })();
      cache.set(k, p);
      return await p;
    };
    return { toUrl };
  }

  function groupKey(year, uploader) {
    return `${year}||${uploader}`;
  }

  function formatGroupMeta(group) {
    const n = group.photos.length;
    if (group.mode === SORT_LATEST && group.latestUploadedAt) {
      const d = new Date(group.latestUploadedAt);
      const dateText = Number.isFinite(d.getTime()) ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      return dateText ? `${n} photo${n === 1 ? '' : 's'} • latest ${dateText}` : `${n} photo${n === 1 ? '' : 's'}`;
    }
    return `${n} photo${n === 1 ? '' : 's'}`;
  }

  async function renderLatest(photos, streamEl) {
    // Group by (year, uploader), then order groups by latest uploadedAt desc.
    const groups = new Map();
    for (const p of photos) {
      const gk = groupKey(p.year, p.uploader);
      if (!groups.has(gk)) {
        groups.set(gk, {
          mode: SORT_LATEST,
          year: p.year,
          uploader: p.uploader,
          latestUploadedAt: '',
          photos: []
        });
      }
      const g = groups.get(gk);
      g.photos.push(p);
      if (p.uploadedAt && (!g.latestUploadedAt || p.uploadedAt > g.latestUploadedAt)) {
        g.latestUploadedAt = p.uploadedAt;
      }
    }

    const list = Array.from(groups.values());
    list.sort((a, b) => String(b.latestUploadedAt || '').localeCompare(String(a.latestUploadedAt || '')));

    const { toUrl } = await buildKeyUrlCache();
    const parts = [];
    for (const g of list) {
      g.photos.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));

      const thumbs = [];
      for (const p of g.photos) {
        const fullUrl = await toUrl(p.key);
        if (!fullUrl) continue;
        const thumbUrl = await toUrl(p.thumbKey || p.key);
        const imgUrl = thumbUrl || fullUrl;
        const filename = p.originalName || String(p.key).split('/').pop() || '';
        thumbs.push(
          `<a class="photo-thumb" href="${fullUrl.replaceAll('"', '&quot;')}" rel="noopener" data-uploader="${escapeHtml(p.uploader)}" data-filename="${escapeHtml(filename)}" data-key="${escapeHtml(String(p.key))}"><img alt="Tournament photo" src="${imgUrl.replaceAll('"', '&quot;')}" loading="lazy"></a>`
        );
      }
      if (!thumbs.length) continue;

      parts.push(`
        <div class="year-title">${escapeHtml(g.year)}</div>
        <div class="photos-group">
          <div class="photos-group-header">
            <div class="photos-group-title">${escapeHtml(g.uploader)}</div>
            <div class="photos-group-meta">${escapeHtml(formatGroupMeta(g))}</div>
          </div>
          <div class="photos-grid">
            ${thumbs.join('')}
          </div>
        </div>
      `);
    }

    streamEl.innerHTML = parts.join('');
  }

  async function renderByTournament(photos, streamEl) {
    // Year desc; within each year: uploader groups by earliest upload asc; photos desc.
    const byYear = new Map(); // year -> Map<uploader, group>
    for (const p of photos) {
      if (!byYear.has(p.year)) byYear.set(p.year, new Map());
      const byUploader = byYear.get(p.year);
      if (!byUploader.has(p.uploader)) {
        byUploader.set(p.uploader, {
          mode: SORT_TOURNAMENT,
          year: p.year,
          uploader: p.uploader,
          firstUploadedAt: '',
          photos: []
        });
      }
      const g = byUploader.get(p.uploader);
      g.photos.push(p);
      if (p.uploadedAt && (!g.firstUploadedAt || p.uploadedAt < g.firstUploadedAt)) {
        g.firstUploadedAt = p.uploadedAt;
      }
    }

    const years = Array.from(byYear.keys()).sort((a, b) => String(b).localeCompare(String(a)));
    const { toUrl } = await buildKeyUrlCache();
    const parts = [];

    for (const year of years) {
      parts.push(`<div class="year-title">${escapeHtml(year)}</div>`);
      const groups = Array.from(byYear.get(year).values());
      groups.sort((a, b) => String(a.firstUploadedAt || '').localeCompare(String(b.firstUploadedAt || '')));

      for (const g of groups) {
        g.photos.sort((a, b) => String(b.uploadedAt || '').localeCompare(String(a.uploadedAt || '')));

        const thumbs = [];
        for (const p of g.photos) {
          const fullUrl = await toUrl(p.key);
          if (!fullUrl) continue;
          const thumbUrl = await toUrl(p.thumbKey || p.key);
          const imgUrl = thumbUrl || fullUrl;
          const filename = p.originalName || String(p.key).split('/').pop() || '';
          thumbs.push(
            `<a class="photo-thumb" href="${fullUrl.replaceAll('"', '&quot;')}" rel="noopener" data-uploader="${escapeHtml(p.uploader)}" data-filename="${escapeHtml(filename)}" data-key="${escapeHtml(String(p.key))}"><img alt="Tournament photo" src="${imgUrl.replaceAll('"', '&quot;')}" loading="lazy"></a>`
          );
        }
        if (!thumbs.length) continue;

        parts.push(`
          <div class="photos-group">
            <div class="photos-group-header">
              <div class="photos-group-title">${escapeHtml(g.uploader)}</div>
              <div class="photos-group-meta">${thumbs.length} photo${thumbs.length === 1 ? '' : 's'}</div>
            </div>
            <div class="photos-grid">
              ${thumbs.join('')}
            </div>
          </div>
        `);
      }
    }

    streamEl.innerHTML = parts.join('');
  }

  function showEmpty(messageHtml) {
    const emptyEl = document.getElementById('empty');
    const streamEl = document.getElementById('stream');
    if (streamEl) streamEl.innerHTML = '';
    if (!emptyEl) return;
    emptyEl.style.display = 'block';
    emptyEl.innerHTML = messageHtml;
  }

  function hideEmpty() {
    const emptyEl = document.getElementById('empty');
    if (emptyEl) emptyEl.style.display = 'none';
  }

  async function render() {
    const streamEl = document.getElementById('stream');
    if (!streamEl) return;

    const mode = getSortMode();
    setActiveSortButtons(mode);
    updateSubtitle(mode);

    if (!(window.WhistMedia && typeof window.WhistMedia.getTournamentMeta === 'function')) {
      showEmpty(`<strong>Photo stream not available</strong>Media config wasn’t loaded.`);
      return;
    }
    if (!(window.WhistMedia && typeof window.WhistMedia.publicUrlForKey === 'function')) {
      showEmpty(`<strong>Photo stream not available</strong>Media URL helper wasn’t loaded.`);
      return;
    }
    if (!(window.WhistMedia && typeof window.WhistMedia.listPrefix === 'function')) {
      showEmpty(`<strong>Photo stream not available</strong>Media listing helper wasn’t loaded.`);
      return;
    }

    showEmpty(`<strong>Loading photos…</strong>Please wait.`);

    const photos = await loadAllPhotos();
    if (!photos.length) {
      showEmpty(`<strong>No photos found</strong>There aren’t any tournament photos uploaded yet.`);
      return;
    }

    hideEmpty();

    if (mode === SORT_TOURNAMENT) {
      await renderByTournament(photos, streamEl);
    } else {
      await renderLatest(photos, streamEl);
    }

    // Bind lightbox to all rendered thumbnails (in DOM order).
    if (window.WhistLightbox && typeof window.WhistLightbox.bindAnchors === 'function') {
      window.WhistLightbox.bindAnchors(streamEl.querySelectorAll('a.photo-thumb'));
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    // SPA-ish behavior: avoid full reload when toggling sort buttons.
    const latest = document.getElementById('sort-latest');
    const tournament = document.getElementById('sort-tournament');

    const onClick = (mode) => (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      const url = new URL(window.location.href);
      url.searchParams.set('sort', mode);
      window.history.replaceState({}, '', url.toString());
      render().catch(() => {
        showEmpty(`<strong>Unable to load photos</strong>Please try again later.`);
      });
    };

    if (latest) latest.addEventListener('click', onClick(SORT_LATEST));
    if (tournament) tournament.addEventListener('click', onClick(SORT_TOURNAMENT));

    render().catch(() => {
      showEmpty(`<strong>Unable to load photos</strong>Please try again later.`);
    });
  });
})();


