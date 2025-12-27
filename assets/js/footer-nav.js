(() => {
  const DEFAULT_SUBTITLE = `Est. 1985 • The World's Most Elite Family Tournament`;
  const subtitleForPath = (pathname) => {
    const p = String(pathname || '/');
    if (p.startsWith('/admin')) return 'Admin';
    if (p.startsWith('/upload')) return 'Uploads';
    return DEFAULT_SUBTITLE;
  };

  const isActiveLink = (hrefPath, currentPath) => {
    const cur = String(currentPath || '/');
    const target = String(hrefPath || '/');

    // Home: active on "/" or "/index.html"
    if (target === '/') {
      return cur === '/' || cur === '/index.html';
    }

    // Directory pages: treat "/tournaments/" active for "/tournaments/..." etc.
    if (target.endsWith('/')) {
      return cur === target || cur.startsWith(target);
    }

    return cur === target;
  };

  const buildHeaderHtml = () => {
    const path = (typeof window !== 'undefined' && window.location) ? window.location.pathname : '/';
    const subtitle = subtitleForPath(path);

    const links = [
      { label: 'Home', href: '/' },
      { label: 'Tournaments', href: '/tournaments/' },
      { label: 'Tables', href: '/tables/' },
      { label: 'Players', href: '/players/' },
      { label: 'Hall of Fame', href: '/leaderboard/' },
      { label: 'Statistics', href: '/stats/' },
    ];

    const nav = links.map(l => {
      const active = isActiveLink(l.href, path) ? ' active' : '';
      return `<a href="${l.href}" class="nav-link${active}">${l.label}</a>`;
    }).join('');

    return `
      <div class="header-content">
        <div class="logo-section">
          <div class="card-suits"><span class="heart">♥</span> <span class="club">♣</span> <span class="diamond">♦</span> <span class="spade">♠</span></div>
          <h1 class="site-title">Ruston Family Whist Drive</h1>
          <p class="site-subtitle">${subtitle}</p>
        </div>
        <nav class="main-nav">
          ${nav}
        </nav>
      </div>
    `.trim();
  };

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
      <p><a href="/history/">History</a></p>
      <p><a href="/memorial/">Memorial</a></p>
      <p><a href="/families/">Family tree</a></p>
    </div>
    <div class="footer-section">
      <h4>Admin</h4>
      <p><a href="/admin/">Admin tools</a></p>
    </div>
  `.trim();

  const FOOTER_BOTTOM_TEXT = 'Ruston Family Whist Drive. Est. 1985. © 2024 David Blake. Site created by David Blake.';

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

  const maybePlayPostLoginTune = () => {
    let tune = null;
    try {
      tune = sessionStorage.getItem('whist_post_login_tune');
    } catch (_) {
      tune = null;
    }
    if (tune !== 'ParrotTune1Short') return;

    const urlM4a = '/assets/audio/ParrotTune1Short.m4a';
    const urlMp3 = '/assets/audio/ParrotTune1Short.mp3';

    const clear = () => {
      try { sessionStorage.removeItem('whist_post_login_tune'); } catch (_) {}
    };

    // Try immediately; if blocked, retry on first interaction.
    playAudioUrl(urlM4a).then((ok) => {
      if (ok) {
        clear();
        return;
      }
      playAudioUrl(urlMp3).then((ok2) => {
        if (ok2) {
          clear();
          return;
        }
        const onFirst = async () => {
          const ok3 = await playAudioUrl(urlM4a) || await playAudioUrl(urlMp3);
          if (ok3) clear();
        };
        window.addEventListener('pointerdown', onFirst, { once: true });
        window.addEventListener('keydown', onFirst, { once: true });
      });
    });
  };

  const injectHeaderParrot = () => {
    const headerContainer = document.querySelector('.header .container');
    if (!headerContainer) return;
    if (headerContainer.querySelector('.header-parrot-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'header-parrot-btn';
    btn.setAttribute('aria-label', 'Play parrot sound');

    const img = document.createElement('img');
    img.className = 'header-parrot-img';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'eager';
    img.src = '/assets/images/WhistParrot_64.png';
    img.srcset = '/assets/images/WhistParrot_64.png 64w, /assets/images/WhistParrot_256.png 256w, /assets/images/WhistParrot.png 1024w';
    img.sizes = '84px';

    btn.appendChild(img);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      playParrotSound();
    });

    headerContainer.insertBefore(btn, headerContainer.firstChild);
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

  const injectHeaderNav = () => {
    const placeholders = Array.from(document.querySelectorAll('[data-header-nav]'));
    if (!placeholders.length) return;
    const html = buildHeaderHtml();
    for (const el of placeholders) {
      try {
        el.outerHTML = html;
      } catch (_) {
        el.innerHTML = html;
      }
    }
  };

  const updateHeaderCompactMode = () => {
    const header = document.querySelector('.header');
    const nav = document.querySelector('.main-nav');
    if (!header || !nav) return;

    const links = Array.from(nav.querySelectorAll('.nav-link'));
    if (!links.length) return;

    const firstTop = links[0].offsetTop;
    const wrapped = links.some(a => a.offsetTop > firstTop + 2);
    header.classList.toggle('header--compact', wrapped);
  };

  if (document.readyState === 'loading') {
    // Run after other DOMContentLoaded handlers (some pages mutate footer late).
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => {
      maybePlayPostLoginTune();
      injectHeaderNav();
      injectHeaderParrot();
      updateHeaderCompactMode();
      injectFooterNav();
      injectFooterBottom();
    }, 0));
  } else {
    setTimeout(() => {
      maybePlayPostLoginTune();
      injectHeaderNav();
      injectHeaderParrot();
      updateHeaderCompactMode();
      injectFooterNav();
      injectFooterBottom();
    }, 0);
  }

  // Safety net: run once more after full load in case another script
  // overwrites footer content after DOMContentLoaded.
  window.addEventListener('load', () => setTimeout(() => {
    maybePlayPostLoginTune();
    injectHeaderNav();
    injectHeaderParrot();
    updateHeaderCompactMode();
    injectFooterNav();
    injectFooterBottom();
  }, 0), { once: true });

  window.addEventListener('resize', () => {
    // Recompute after layout settles.
    requestAnimationFrame(updateHeaderCompactMode);
  });
})();





