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
  `.trim();

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

    // Add a visible admin uploader link in the footer bottom.
    try {
      const footerP = document.querySelector('.footer .footer-bottom p');
      if (footerP && !footerP.querySelector('[data-admin-uploader-link]')) {
        const sep = document.createTextNode(' | ');
        const a = document.createElement('a');
        a.href = '/admin/media-upload.html';
        a.textContent = 'Media uploads';
        a.setAttribute('data-admin-uploader-link', 'true');
        footerP.appendChild(sep);
        footerP.appendChild(a);
      }
    } catch (_) {
      // ignore
    }
  };

  if (document.readyState === 'loading') {
    // Run after other DOMContentLoaded handlers (some pages mutate footer late).
    document.addEventListener('DOMContentLoaded', () => setTimeout(injectFooterNav, 0));
  } else {
    setTimeout(injectFooterNav, 0);
  }

  // Safety net: run once more after full load in case another script
  // overwrites footer content after DOMContentLoaded.
  window.addEventListener('load', () => setTimeout(injectFooterNav, 0), { once: true });
})();





