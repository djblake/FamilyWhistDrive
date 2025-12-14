# Hall of Fame + Stats Ideas Backlog

This document is our running backlog of **Hall of Fame** sections and **player profile** stats/visualizations we may implement.

## Principles
- **Mix**: target a blend of “serious stats” and “fun family awards”.
- **Data-first**: each idea should declare what it needs from the raw data (or from player metadata like DOB).
- **Reproducible**: where possible, stats should be computable purely from the standardized scorecards.

---

## A) Championship records (serious)

### A1) Most championships
- **Definition**: count of tournaments won (overall champion).
- **Display**: leaderboard + per-player count + list of winning years.
- **Data needed**: tournament winners derivable from tournament standings (already computed).

### A2) Most consecutive tournament championships
- **Definition**: longest streak of winning *tournaments* in consecutive tournament years (or consecutive tournaments held).
- **Display**: “Longest championship streak” card + table of top streaks.
- **Data needed**: champion per year.

### A3) Most consecutive *round wins* across tournament boundaries (your example)
- **Definition**: the longest streak of **majority wins** across years.
  - A “win” is: player’s partnership scores **≥ 7 tricks** in a round.
  - Example: win last 3 rounds of year N, plus first 2 rounds of year N+1 → streak = 5.
- **Data needed**: per-round result outcomes per player/partnership.

### A4) Oldest winner / youngest winner
- **Definition**: age at tournament win.
- **Display**: record holder + year + age.
- **Data needed**: **player birth date**.
- **Note**: we’ll need to add DOB fields to players metadata (and decide privacy scope).

---

## B) Big-round performance (serious + celebratory)

### B1) Most 11+ trick rounds
- **Definition**: count of rounds where a partnership took ≥ 11 tricks.
- **Display**: leaderboard + per-player totals + per-partnership totals.
- **Data needed**: round tricks per partnership.

### B2) Most 12+ trick rounds
- Same as above, threshold ≥ 12.

### B3) Hall of Fame: every 12+ trick round (chronological)
- **Definition**: list every instance of ≥ 12 tricks, sorted by **year → round → table**.
- **Display**: timeline table showing year/round/table + partnership + opponents + tricks.
- **Data needed**: year/round/table + partnership players + tricks + opponent tricks.

### B4) Hall of Fame: every 13-trick round (chronological)
- Same as above, threshold = 13.
- **Note**: currently “yet to happen” — keep the UI but show “none yet”.

---

## C) Tournament-level records (serious)

### C1) Best average tricks for a single tournament (as a table)
- **Definition**: we want **both**:
  - **Average tricks**: average partnership tricks-per-round for a player within a tournament year.
  - **Average margin**: average (partnership tricks − opponent tricks) per round for that player within a tournament year.
- **Display**: top N performances: player(s) + year + average.
- **Data needed**: per-round tricks by player/partnership for that year.

---

## D) Player profile additions (serious)

### D1) Highest ever seed ranking + last year achieved
- **Definition**: best (lowest numeric) seed rank position ever achieved.
- **Display**: “Peak seed rank: #X (last achieved YEAR)”.
- **Data needed**: seed ranks per year (must be derived from stats per tournament/year).

### D2) Seed ranking over career (graph)
- **Definition**: time series of seed rank by year.
- **Display**: simple line chart: X = year, Y = rank (lower is better).
- **Data needed**: per-year seed rank.
- **Note**: we can implement this as lightweight SVG/Canvas in plain JS.

---

## E) Additional Hall of Fame ideas (mix)

### E1) “Most Improved”
- **Definition**: largest positive change in seed rank from one year to the next (or over 3-year window).
- **Display**: biggest jumps up per year + all-time.
- **Data needed**: seed rank time series.

### E2) “Most Consistent”
- **Definition**: lowest variance in finish percentile (or seed points) over last N tournaments.
- **Data needed**: finish percentile per year.

### E3) “Giant Killer”
- **Definition**: most wins against higher-seeded opponents at the same table.
- **Data needed**: seed rank at time of tournament + matchups per round.

### E4) “Clutch Performer”
- **Definition**: best average performance in later rounds (e.g., rounds 16–20) vs earlier rounds.
- **Data needed**: round number + performance metric.

### E5) “Trump Suit Specialist”
- **Definition**: highest win rate / highest average tricks when a given suit is trump.
- **Data needed**: trump suit per round (already derived via rotation logic if stable).

### E6) “Best Partnership” (dynamic)
- **Definition**: highest win rate / best average tricks / best average finish when paired together (min rounds together threshold).
- **Data needed**: partnership identity per round across all tournaments.

### E7) “Most Loyal Partner” / “Most Different Partners”
- **Definition**: fewest unique partners (min tournaments threshold) vs most unique partners.
- **Data needed**: partner IDs per round.

### E8) “Nemesis” (per-player)
- **Definition**: opponent player they lose to most often (or lowest win rate against).
- **Data needed**: head-to-head outcomes per round.

### E9) “Table Terror”
- **Definition**: most 10+ trick rounds; or highest average tricks at table-level.
- **Data needed**: tricks by round.

### E10) “Comeback King/Queen”
- **Definition**: best improvement within a tournament from first half to second half (rank percentile or average tricks).
- **Data needed**: per-round performance + ability to split tournament into halves.

### E11) “Booby Magnet” (expanded)
- **Definition**: booby wins, booby rate, and streaks of non-booby years.
- **Data needed**: last-place finishes per year.

### E12) “Attendance Ironman”
- **Definition**: most tournaments played; longest attendance streak; “returned after X years”.
- **Data needed**: participation by year.

### E13) “Most Volatile”
- **Definition**: biggest swings year-to-year in finish percentile.
- **Data needed**: finish percentile time series.

### E14) “Perfect Table”
- **Definition**: any 13-trick rounds (and in future: partnership with 0-trick opponents).
- **Data needed**: tricks by round.

### E15) “Record Book by Year”
- **Idea**: each year page includes “year awards”: champion, booby, best round, best partnership, biggest upset.
- **Data needed**: per-year stats.

---

## F) Data/metadata gaps to decide
- **Player DOB**: required for oldest/youngest winner. Decide:
  - store full DOB vs just birth year; and privacy expectations for family site.
- **Definitions**: confirm the meaning of:
  - “round win” / “game win” across tournament boundaries,
  - “best average tricks for a single tournament”.


