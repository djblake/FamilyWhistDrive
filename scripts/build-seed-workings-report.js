const fs = require('fs');
const path = require('path');

const { TournamentEngine } = require(path.join('..', 'assets', 'js', 'tournament-engine.js'));

const RAW_PATH = path.join(__dirname, '..', 'assets', 'cache', 'raw-data.json');
const OUT_PATH = path.join(__dirname, '..', 'reports', 'seed_workings_all_players.txt');

function padRight(s, n) {
  const str = String(s);
  if (str.length >= n) return str;
  return str + ' '.repeat(n - str.length);
}

function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(decimals);
}

function fmtMult(n, decimals = 3) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return Number(n).toFixed(decimals);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const engine = new TournamentEngine();
  engine.importRawCache(raw);
  engine.processRawScorecards();

  const ordered = engine.getAllTournamentsUnique('desc');
  const mostRecentYear = ordered?.[0]?.year ?? null;
  const lastWindowYears = ordered.slice(0, 7).map((t) => t.year);

  const rankings = engine.computeOfficialSeedRankingsForTournaments(ordered, true);

  const lines = [];
  lines.push('Seed workings report (all players)');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Most recent year: ${mostRecentYear ?? '—'}`);
  lines.push(`Last-7 tournaments: ${lastWindowYears.join(', ')}`);
  lines.push('Recency weights: 0:1, 1:0.9, 2:0.82, 3:0.74, 4:0.62, 5:0.48, 6:0.3');
  lines.push('Achievement smoothing: carry-only + forward. Win/podium does NOT multiply its own tournament; it creates a carry signal that applies to the NEXT 2 tournaments the player plays (chronological future). Carry persists across non-participation and can apply on win/podium tournaments (from earlier carry).');
  lines.push('Carry signals: win=1.25, podium(2nd/3rd)=1.10 (stackable)');
  lines.push('Recent consistency/bad-finish multipliers require >=4 played tournaments in the last-6 window.');
  lines.push('Legacy win steps: 1.05, 1.04, 1.03, 1.02, 1.01');
  lines.push('Legacy podium steps: 1.03, 1.025, 1.02, 1.015, 1.01, 1.005');
  if (mostRecentYear !== null) {
    const start = mostRecentYear - 15;
    const end = mostRecentYear - 8;
    lines.push(`Legacy podium year window: 8–15 years ago => ${start}..${end}`);
  }
  lines.push('');
  lines.push('========================================');
  lines.push('');

  rankings.forEach((r, idx) => {
    const name = r.name;
    const info = engine.explainOfficialSeedPointsForPlayer(name, true);

    lines.push(`#${idx + 1} ${name} (${name}) — engine=${r.seed_points} pts`);

    const posBits = (info.lastWindowYears || []).map((y, i2) => {
      const p = info.lastWindowPositions?.[i2];
      return `${y}:${p == null ? '—' : p}`;
    });
    lines.push(`Last-7 positions: ${posBits.join('  ')}`);

    lines.push(`Subtotal (Σ last-7 contributions below): ${fmtNum(info.subtotal, 2)}`);
    lines.push(`Approx total after end multipliers: ${r.seed_points}`);
    lines.push(`Legacy wins outside window: ${info.legacyWinsOutsideWindow ?? 0}`);
    lines.push(`Legacy podiums (2nd/3rd) 8–15y ago outside window: ${info.legacyPodiumsOutsideWindow ?? 0}`);

    const endMults = (info.endMultipliers || []).map((m) => `${m.label}×${fmtNum(m.mult, 2)}`);
    lines.push(`End multipliers: ${endMults.length ? endMults.join(' × ') : '—'}`);

    lines.push('Workings (last-7):');
    (info.contributions || []).slice(0, 7).forEach((c) => {
      if (!c.played) {
        lines.push(`  - idx${c.idx} ${c.year}: not played → carry=${fmtMult(c.carry)} (carry persists)`);
        return;
      }

      const shared = c.shared ? ' (shared)' : '';
      const signal = c.achLabel ? ` [${c.achLabel}]` : '';
      lines.push(
        `  - idx${c.idx} ${c.year}: pos ${c.position} → base ${c.basePoints} × w${c.idx}(${fmtNum(c.recencyWeight, 2)}) × carry=${fmtMult(c.carry)} = ${fmtNum(c.points, 2)}${shared}${signal}`
      );
    });

    lines.push('');
  });

  ensureDir(path.dirname(OUT_PATH));
  fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
  process.stdout.write(`Wrote ${OUT_PATH}\n`);
}

main();


