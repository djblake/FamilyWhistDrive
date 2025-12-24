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
      }
      .whist-lightbox__img {
        display: block;
        width: 100%;
        height: auto;
        max-height: 92vh;
        object-fit: contain;
        background: #0b1220;
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
        <img class="whist-lightbox__img" alt="Tournament photo">
        <div class="whist-lightbox__nav" aria-hidden="true">
          <button type="button" class="whist-lightbox__btn whist-lightbox__prev" aria-label="Previous photo">‹</button>
          <button type="button" class="whist-lightbox__btn whist-lightbox__next" aria-label="Next photo">›</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);
    return root;
  };

  let urls = [];
  let idx = 0;

  const render = () => {
    const root = ensureDom();
    const img = root.querySelector('.whist-lightbox__img');
    const btnPrev = root.querySelector('.whist-lightbox__prev');
    const btnNext = root.querySelector('.whist-lightbox__next');
    if (!img || !btnPrev || !btnNext) return;

    const hasMany = urls.length > 1;
    btnPrev.style.display = hasMany ? 'inline-flex' : 'none';
    btnNext.style.display = hasMany ? 'inline-flex' : 'none';

    const cur = urls[idx] || '';
    img.src = cur;
    btnPrev.disabled = !hasMany;
    btnNext.disabled = !hasMany;
  };

  const open = (nextUrls, startIndex = 0) => {
    urls = Array.isArray(nextUrls) ? nextUrls.filter(Boolean) : [];
    if (!urls.length) return;
    idx = Math.max(0, Math.min(urls.length - 1, Number(startIndex) || 0));

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
    urls = [];
    idx = 0;
  };

  const step = (delta) => {
    if (!urls.length) return;
    idx = (idx + delta + urls.length) % urls.length;
    render();
  };

  const bindAnchors = (anchors) => {
    const list = Array.from(anchors || []).filter(a => a && a.getAttribute);
    const links = list
      .map(a => ({ a, href: a.getAttribute('href') || '' }))
      .filter(x => x.href && x.href !== '#');
    const fullUrls = links.map(x => x.href);
    if (!fullUrls.length) return;

    links.forEach((x, i) => {
      x.a.addEventListener('click', (e) => {
        // Allow open-in-new-tab modifiers
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        open(fullUrls, i);
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


