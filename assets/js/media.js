(() => {
  const state = {
    cfgLoaded: false,
    publicBaseUrl: '',
    gatewayBaseUrl: ''
  };

  function trimSlash(s) {
    return String(s || '').replace(/\/+$/, '');
  }

  function joinUrl(base, path) {
    const b = trimSlash(base);
    const p = String(path || '').replace(/^\/+/, '');
    if (!b || !p) return '';
    return `${b}/${p}`;
  }

  async function loadConfig() {
    if (state.cfgLoaded) return;
    state.cfgLoaded = true;
    try {
      const res = await fetch('/api/media/config', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json();
      state.publicBaseUrl = String(json?.publicBaseUrl || '');
      state.gatewayBaseUrl = String(json?.gatewayBaseUrl || '');
    } catch (_) {
      // ignore
    }
  }

  async function getPublicBaseUrl() {
    await loadConfig();
    return state.publicBaseUrl;
  }

  async function publicUrlForKey(key) {
    await loadConfig();
    const gateway = trimSlash(state.gatewayBaseUrl);
    if (gateway) {
      return joinUrl(gateway, key);
    }
    const base = trimSlash(state.publicBaseUrl);
    return base ? joinUrl(base, key) : '';
  }

  function avatarKey(playerId, variant = 'large') {
    const id = String(playerId || '').trim();
    const v = String(variant || 'large').toLowerCase();
    if (!id) return '';
    if (v === 'small' || v === 'sm' || v === 'thumb' || v === 'thumbnail') {
      return `avatars/${id}_sm.jpg`;
    }
    return `avatars/${id}.jpg`;
  }

  async function avatarUrl(playerId, variant = 'large') {
    const key = avatarKey(playerId, variant);
    return key ? await publicUrlForKey(key) : '';
  }

  function scorecardScanKey(year, round, table) {
    return `scorecards/${year}/r${Number(round)}/t${Number(table)}.jpg`;
  }

  async function scorecardScanUrl(year, round, table) {
    const key = scorecardScanKey(year, round, table);
    return await publicUrlForKey(key);
  }

  function playerScorecardKey(year, playerId) {
    const y = String(year);
    const id = String(playerId);
    return `player-scorecards/${y}/${y}_${id}.jpg`;
  }

  async function playerScorecardUrl(year, playerId) {
    const key = playerScorecardKey(year, playerId);
    return await publicUrlForKey(key);
  }

  async function getTournamentMeta(year) {
    try {
      const res = await fetch(`/api/media/meta?year=${encodeURIComponent(String(year))}`, { cache: 'no-store' });
      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  async function listPrefix(prefix, { delimiter = '', limit = 2000 } = {}) {
    const url = new URL('/api/media/list', window.location.origin);
    url.searchParams.set('prefix', prefix);
    if (delimiter) url.searchParams.set('delimiter', delimiter);
    if (limit) url.searchParams.set('limit', String(limit));
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  }

  window.WhistMedia = {
    getPublicBaseUrl,
    publicUrlForKey,
    avatarKey,
    avatarUrl,
    scorecardScanKey,
    scorecardScanUrl,
    playerScorecardKey,
    playerScorecardUrl,
    getTournamentMeta,
    listPrefix
  };
})();

