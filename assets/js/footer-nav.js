(() => {
  const NAV_HTML = `
    <div class="footer-section">
      <h4>Explore</h4>
      <p><a href="/tournaments/">Tournaments</a></p>
      <p><a href="/tables/">Tables</a></p>
      <p><a href="/players/">Players</a></p>
    </div>
    <div class="footer-section">
      <h4>Records</h4>
      <p><a href="/leaderboard/">Hall of Fame</a></p>
      <p><a href="/stats/">Statistics</a></p>
    </div>
    <div class="footer-section">
      <h4>Family</h4>
      <p><a href="/memorial/">Memorial</a></p>
      <p><a href="/families/">Family tree</a></p>
    </div>
    <div class="footer-section">
      <h4>Admin</h4>
      <p><a href="/admin/">Admin tools</a></p>
    </div>
  `.trim();

  const FOOTER_BOTTOM_TEXT = 'Ruston Family Whist Drive. Est. 1984. © 2024 David Blake. Site created by David Blake.';

  const pickWeighted = (items) => {
    // items: [{ value, weight }]
    const list = Array.isArray(items) ? items : [];
    const total = list.reduce((s, it) => s + (Number(it.weight) || 0), 0);
    if (!total) return list[0]?.value ?? null;
    let r = Math.random() * total;
    for (const it of list) {
      r -= (Number(it.weight) || 0);
      if (r <= 0) return it.value;
    }
    return list[list.length - 1]?.value ?? null;
  };

  const playAudioUrl = async (url) => {
    const u = String(url || '');
    if (!u) return false;
    try {
      const a = new Audio(u);
      a.volume = 1.0;
      const p = a.play();
      if (p && typeof p.then === 'function') {
        await p;
      }
      return true;
    } catch (_) {
      return false;
    }
  };

  const playParrotSound = async () => {
    const base = pickWeighted([
      { value: '/assets/audio/ParrotHelloTTM', weight: 20 },
      { value: '/assets/audio/ParrotTTM', weight: 40 },
      { value: '/assets/audio/ParrotTune1', weight: 20 },
      { value: '/assets/audio/ParrotTune2', weight: 20 }
    ]);
    if (!base) return;
    // Prefer m4a, but fall back to mp3 if you decide to export that way later.
    const ok = await playAudioUrl(`${base}.m4a`);
    if (!ok) {
      await playAudioUrl(`${base}.mp3`);
    }
  };

  const injectHeaderParrot = () => {
    const titles = Array.from(document.querySelectorAll('.site-title'));
    if (!titles.length) return;

    for (const titleEl of titles) {
      if (!titleEl || !(titleEl instanceof HTMLElement)) continue;
      if (titleEl.dataset && titleEl.dataset.parrotInjected === '1') continue;

      // Avoid double-inject if markup already contains a parrot button.
      const existing = titleEl.parentElement?.querySelector('.site-parrot-btn');
      if (existing) {
        titleEl.dataset.parrotInjected = '1';
        continue;
      }

      const row = document.createElement('div');
      row.className = 'site-title-row';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'site-parrot-btn';
      btn.setAttribute('aria-label', 'Play parrot sound');

      const img = document.createElement('img');
      img.className = 'site-parrot-img';
      img.alt = '';
      img.decoding = 'async';
      img.loading = 'eager';
      img.src = '/assets/images/WhistParrot_64.png';
      img.srcset = '/assets/images/WhistParrot_64.png 64w, /assets/images/WhistParrot_256.png 256w, /assets/images/WhistParrot.png 1024w';
      img.sizes = '56px';

      btn.appendChild(img);
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        playParrotSound();
      });

      const parent = titleEl.parentElement;
      if (!parent) continue;

      // Replace the title with a row that contains [parrot][title]
      parent.insertBefore(row, titleEl);
      row.appendChild(btn);
      row.appendChild(titleEl);

      titleEl.dataset.parrotInjected = '1';
    }
  };

  const injectFooterBottom = () => {
    // Standardize footer-bottom text everywhere (single source of truth).
    const bottoms = Array.from(document.querySelectorAll('.footer-bottom'));
    for (const b of bottoms) {
      const p = b.querySelector('p') || b;
      if (!p) continue;
      p.textContent = FOOTER_BOTTOM_TEXT;
    }
  };

  const injectFooterNav = () => {
    const placeholders = Array.from(document.querySelectorAll('[data-footer-nav]'));
    if (!placeholders.length) return;
    for (const el of placeholders) {
      try {
        el.outerHTML = NAV_HTML;
      } catch (_) {
        // Fallback: replace innerHTML if outerHTML replacement fails.
        el.innerHTML = NAV_HTML;
      }
    }

    // No extra footer-bottom links; navigation is fully defined above.
  };

  if (document.readyState === 'loading') {
    // Run after other DOMContentLoaded handlers (some pages mutate footer late).
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
      injectHeaderParrot();
      injectFooterNav();
      injectFooterBottom();
    }, 0));
  } else {
    setTimeout(() => {
      injectHeaderParrot();
      injectFooterNav();
      injectFooterBottom();
    }, 0);
  }

  // Safety net: run once more after full load in case another script
  // overwrites footer content after DOMContentLoaded.
  window.addEventListener('load', () => setTimeout(() => {
    injectHeaderParrot();
    injectFooterNav();
    injectFooterBottom();
  }, 0), { once: true });
})();





