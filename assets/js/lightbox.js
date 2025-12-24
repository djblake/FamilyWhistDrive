(() => {
  const STYLE_ID = 'whist-lightbox-style';
  const ROOT_ID = 'whist-lightbox-root';

  const ensureStyle = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .whist-lightbox {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1.25rem;
        background: rgba(0,0,0,0.72);
      }
      .whist-lightbox[aria-hidden="false"] { display: flex; }
      .whist-lightbox__panel {
        width: min(1040px, 96vw);
        max-height: 92vh;
        position: relative;
        border-radius: 18px;
        background: rgba(15, 23, 42, 0.92);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 24px 70px rgba(0,0,0,0.55);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      }
      .whist-lightbox__media {
        position: relative;
        flex: 1 1 auto;
        min-height: 0; /* allow img to shrink within max-height panel */
      }
      .whist-lightbox__img {
        display: block;
        width: 100%;
        height: auto;
        max-height: 100%;
        object-fit: contain;
        background: #0b1220;
      }
      .whist-lightbox__captionbar {
        flex: 0 0 auto;
        padding: 0.75rem 0.9rem;
        display: flex;
        gap: 0.75rem;
        align-items: center;
        justify-content: space-between;
        background: rgba(255,255,255,0.06);
        border-top: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.92);
      }
      .whist-lightbox__caption {
        font-size: 0.85rem;
        font-weight: 700;
        line-height: 1.25;
        max-width: 100%;
        white-space: normal;
      }
      .whist-lightbox__caption code {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 0.82rem;
        color: rgba(255,255,255,0.88);
        word-break: break-all;
      }
      .whist-lightbox__goto {
        flex: 0 0 auto;
        white-space: nowrap;
      }
      .whist-lightbox__close {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        z-index: 2;
      }
      .whist-lightbox__nav {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .whist-lightbox__btn {
        pointer-events: auto;
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        width: 44px;
        height: 44px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.18);
        background: rgba(15, 23, 42, 0.65);
        color: rgba(255,255,255,0.94);
        font-size: 24px;
        font-weight: 900;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
      }
      .whist-lightbox__btn:hover {
        background: rgba(15, 23, 42, 0.85);
        border-color: rgba(255,255,255,0.28);
      }
      .whist-lightbox__btn:disabled {
        opacity: 0.35;
        cursor: default;
      }
      .whist-lightbox__prev { left: 0.75rem; }
      .whist-lightbox__next { right: 0.75rem; }
      @media (max-width: 520px) {
        .whist-lightbox { padding: 0.75rem; }
        .whist-lightbox__btn { width: 40px; height: 40px; font-size: 22px; }
        .whist-lightbox__caption { font-size: 0.8rem; }
      }
    `;
    document.head.appendChild(style);
  };

  const ensureDom = () => {
    ensureStyle();
    let root = document.getElementById(ROOT_ID);
    if (root) return root;

    root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'whist-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `
      <div class="whist-lightbox__panel" role="document">
        <button type="button" class="btn btn-secondary whist-lightbox__close" aria-label="Close">Close</button>
        <div class="whist-lightbox__media">
          <img class="whist-lightbox__img" alt="Tournament photo">
          <div class="whist-lightbox__nav" aria-hidden="true">
            <button type="button" class="whist-lightbox__btn whist-lightbox__prev" aria-label="Previous photo">‹</button>
            <button type="button" class="whist-lightbox__btn whist-lightbox__next" aria-label="Next photo">›</button>
          </div>
        </div>
        <div class="whist-lightbox__captionbar">
          <div class="whist-lightbox__caption" aria-live="polite"></div>
          <a class="btn btn-secondary whist-lightbox__goto" href="#" style="display:none;">Go to gallery</a>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  };

  let items = [];
  let idx = 0;
  let goToHref = '';
  let goToLabel = 'Go to gallery';

  const render = () => {
    const root = ensureDom();
    const img = root.querySelector('.whist-lightbox__img');
    const btnPrev = root.querySelector('.whist-lightbox__prev');
    const btnNext = root.querySelector('.whist-lightbox__next');
    const captionEl = root.querySelector('.whist-lightbox__caption');
    const goToEl = root.querySelector('.whist-lightbox__goto');
    if (!img || !btnPrev || !btnNext) return;

    const hasMany = items.length > 1;
    btnPrev.style.display = hasMany ? 'inline-flex' : 'none';
    btnNext.style.display = hasMany ? 'inline-flex' : 'none';

    const cur = items[idx] || null;
    const url = cur && cur.url ? cur.url : '';
    img.src = url;
    btnPrev.disabled = !hasMany;
    btnNext.disabled = !hasMany;

    if (captionEl) {
      captionEl.textContent = cur && cur.caption ? String(cur.caption) : '';
    }
    if (goToEl) {
      if (goToHref) {
        goToEl.href = goToHref;
        goToEl.textContent = goToLabel || 'Go to gallery';
        goToEl.style.display = 'inline-flex';
      } else {
        goToEl.style.display = 'none';
      }
    }
  };

  const normalizeItems = (arr) => {
    const raw = Array.isArray(arr) ? arr : [];
    const out = [];
    for (const it of raw) {
      if (typeof it === 'string') {
        const u = String(it || '').trim();
        if (u) out.push({ url: u, caption: '' });
      } else if (it && typeof it === 'object') {
        const u = String(it.url || '').trim();
        if (u) out.push({ url: u, caption: String(it.caption || '') });
      }
    }
    return out;
  };

  const open = (next, startIndex = 0, options = {}) => {
    items = normalizeItems(next);
    if (!items.length) return;
    idx = Math.max(0, Math.min(items.length - 1, Number(startIndex) || 0));
    goToHref = String(options && options.goToHref ? options.goToHref : (options && options.galleryHref ? options.galleryHref : '')).trim();
    goToLabel = String(options && (options.goToLabel || options.galleryLabel) ? (options.goToLabel || options.galleryLabel) : 'Go to gallery');

    const root = ensureDom();
    root.setAttribute('aria-hidden', 'false');
    render();
  };

  const close = () => {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.setAttribute('aria-hidden', 'true');
    const img = root.querySelector('.whist-lightbox__img');
    if (img) img.removeAttribute('src');
    items = [];
    idx = 0;
    goToHref = '';
    goToLabel = 'Go to gallery';
  };

  const step = (delta) => {
    if (!items.length) return;
    idx = (idx + delta + items.length) % items.length;
    render();
  };

  const buildCaptionFromDataset = (ds) => {
    if (!ds) return '';
    const uploader = String(ds.uploader || '').trim();
    const filename = String(ds.filename || '').trim();
    const key = String(ds.key || '').trim();
    const parts = [];
    if (uploader) parts.push(`Uploader: ${uploader}`);
    if (filename) parts.push(`File: ${filename}`);
    if (key) parts.push(`Key: ${key}`);
    return parts.join(' • ');
  };

  const bindAnchors = (anchors, options = {}) => {
    const list = Array.from(anchors || []).filter(a => a && a.getAttribute);
    const links = list
      .map(a => ({ a, href: a.getAttribute('href') || '', caption: buildCaptionFromDataset(a.dataset) }))
      .filter(x => x.href && x.href !== '#');
    const nextItems = links.map(x => ({ url: x.href, caption: x.caption || '' }));
    if (!nextItems.length) return;

    links.forEach((x, i) => {
      x.a.addEventListener('click', (e) => {
        // Allow open-in-new-tab modifiers
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(nextItems, i, options);
      });
    });
  };

  const wireEventsOnce = () => {
    const root = ensureDom();
    if (root.dataset.wired === '1') return;
    root.dataset.wired = '1';

    const closeBtn = root.querySelector('.whist-lightbox__close');
    const btnPrev = root.querySelector('.whist-lightbox__prev');
    const btnNext = root.querySelector('.whist-lightbox__next');
    const panel = root.querySelector('.whist-lightbox__panel');

    if (closeBtn) closeBtn.addEventListener('click', close);
    if (btnPrev) btnPrev.addEventListener('click', () => step(-1));
    if (btnNext) btnNext.addEventListener('click', () => step(1));

    // Click-outside-to-close
    root.addEventListener('click', (e) => {
      if (!panel) return close();
      if (e.target === root) close();
    });

    // ESC + arrow keys
    window.addEventListener('keydown', (e) => {
      const openNow = root.getAttribute('aria-hidden') === 'false';
      if (!openNow) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  };

  // Expose a tiny API.
  window.WhistLightbox = {
    open,
    close,
    bindAnchors,
    ensure: () => {
      ensureDom();
      wireEventsOnce();
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wireEventsOnce(), { once: true });
  } else {
    wireEventsOnce();
  }
})();


