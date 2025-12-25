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
      injectFooterNav();
      injectFooterBottom();
    }, 0));
  } else {
    setTimeout(() => {
      injectFooterNav();
      injectFooterBottom();
    }, 0);
  }

  // Safety net: run once more after full load in case another script
  // overwrites footer content after DOMContentLoaded.
  window.addEventListener('load', () => setTimeout(() => {
    injectFooterNav();
    injectFooterBottom();
  }, 0), { once: true });
})();





