const fs = require('fs');
const path = require('path');

// Ensure fetch exists (Node 18+ has fetch, but keep compatibility)
if (typeof fetch === 'undefined') {
  // eslint-disable-next-line global-require
  global.fetch = require('node-fetch');
}

const { TournamentEngine } = require(path.join('..', 'assets', 'js', 'tournament-engine.js'));

const SHEET_ID = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
const CACHE_DIR = path.join(__dirname, '..', 'assets', 'cache');
const RAW_PATH = path.join(CACHE_DIR, 'raw-data.json');
const STATS_PATH = path.join(CACHE_DIR, 'stats.json');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function buildRaw() {
  const engine = new TournamentEngine();
  await engine.loadFromGoogleSheets(SHEET_ID, { bypassCache: true, preferCache: false });
  const rawCache = engine.exportRawCache();
  ensureDir(CACHE_DIR);
  writeJson(RAW_PATH, rawCache);
  process.stdout.write(`Wrote ${RAW_PATH} (rawHash=${rawCache.rawHash})\n`);
  return rawCache;
}

async function buildStats(rawCache) {
  let raw = rawCache;
  if (!raw) {
    raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  }
  const engine = new TournamentEngine();
  engine.importRawCache(raw);
  engine.processRawScorecards();
  const statsCache = engine.exportStatsCache(raw.rawHash);
  ensureDir(CACHE_DIR);
  writeJson(STATS_PATH, statsCache);
  process.stdout.write(`Wrote ${STATS_PATH} (rawHash=${raw.rawHash}, statsAlgorithmVersion=${statsCache.statsAlgorithmVersion})\n`);
  return statsCache;
}

async function main() {
  const mode = (process.argv[2] || 'all').toLowerCase();
  if (mode !== 'raw' && mode !== 'stats' && mode !== 'all') {
    process.stderr.write('Usage: node scripts/build-cache.js [raw|stats|all]\n');
    process.exit(2);
  }

  if (mode === 'raw') {
    await buildRaw();
    return;
  }
  if (mode === 'stats') {
    await buildStats(null);
    return;
  }

  const raw = await buildRaw();
  await buildStats(raw);
}

main().catch((err) => {
  process.stderr.write((err && err.stack) ? err.stack : String(err));
  process.stderr.write('\n');
  process.exit(1);
});


