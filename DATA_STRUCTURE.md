# Data Structure Documentation

## Overview
The Ruston Family Whist Drive website uses a **scorecard-driven architecture** where all tournament structure, player statistics, and analytics are derived from the raw scorecard data. This ensures a single source of truth and enables rich analytical capabilities.

## Core Principle: Reverse Engineering from Scorecards

Instead of storing tournament structure separately, we calculate everything from the scorecard entries:
- **Partnerships**: Who played with whom in each round
- **Table Assignments**: Which players sat at the same table
- **Tournament Progression**: How scores changed throughout the tournament
- **Player Statistics**: Career metrics calculated from all scorecards

## Official Tournament Structure Reference

### Partnership Scheduling Source
**Tool**: https://www.devenezia.com/downloads/round-robin/rounds.php
- **Format**: Table-based Whist algorithm
- **Players**: 20 total (numbered 1-20 for scheduling)
- **Structure**: 5 tables × 4 players per round
- **Algorithm**: Balanced partnerships - each player partners with every other exactly once over 19 rounds
- **Round 20**: Repeats Round 1 (standard Whist practice)

### Tournament Structure Validation
The official schedule provides the ground truth for:
- **Partnership combinations per round**
- **Table assignments and player rotations** 
- **Balanced competition verification**
- **Historical tournament reconstruction accuracy**

---

## Input Data Format

### CSV Scorecard Structure
The primary input is a CSV file containing all tournament scorecards:

```csv
Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas Championship,2023,1,Hearts,James Ruston,Mary Wilson,7,David Smith,Emma Jones,6
Christmas Championship,2023,1,Hearts,David Smith,Emma Jones,6,James Ruston,Mary Wilson,7
Christmas Championship,2023,2,Diamonds,James Ruston,Sarah Brown,8,Tom Wilson,Mary Wilson,5
Christmas Championship,2023,2,Diamonds,Tom Wilson,Mary Wilson,5,James Ruston,Sarah Brown,8
```

### Field Descriptions
| Field | Description | Example |
|-------|-------------|---------|
| `Tournament` | Tournament name/title | "Christmas Championship" |
| `Year` | Tournament year | 2023 |
| `Round` | Round number (1-16) | 1 |
| `Trump_Suit` | Trump suit for the round | "Hearts", "Diamonds", "Spades", "Clubs" |
| `Player1` | First player in partnership | "James Ruston" |
| `Player2` | Second player in partnership | "Mary Wilson" |
| `Tricks_Won` | Number of tricks won by this partnership | 7 |
| `Opponent1` | First opposing player | "David Smith" |
| `Opponent2` | Second opposing player | "Emma Jones" |
| `Opponent_Tricks` | Tricks won by opposing partnership | 6 |

### Data Validation Rules
- **Trick Total**: `Tricks_Won + Opponent_Tricks = 13` (all tricks accounted for)
- **Partnership Consistency**: Each round must have exactly 2 scorecard entries (one per partnership)
- **Trump Rotation**: Suits must follow Hearts→Diamonds→Spades→Clubs pattern
- **Player Names**: Consistent spelling across all tournaments
- **Round Sequence**: Rounds 1-16 for each tournament

---

## Derived Data Structures

### Tournament Structure
From the CSV data, we calculate:

```javascript
{
  "tournament_id": "christmas_championship_2023",
  "meta": {
    "name": "Christmas Championship",
    "year": 2023,
    "date": "2023-12-25",
    "total_players": 12,
    "total_rounds": 16,
    "winner": "James Ruston",
    "runner_up": "Mary Wilson"
  },
  "rounds": [
    {
      "round": 1,
      "trump_suit": "Hearts",
      "tables": [
        {
          "table": 1,
          "partnerships": [
            {
              "players": ["James Ruston", "Mary Wilson"],
              "tricks": 7,
              "opponents": ["David Smith", "Emma Jones"]
            },
            {
              "players": ["David Smith", "Emma Jones"],
              "tricks": 6,
              "opponents": ["James Ruston", "Mary Wilson"]
            }
          ]
        }
      ]
    }
  ]
}
```

### Player Profiles
Aggregated statistics for each player:

```javascript
{
  "player_id": "james_ruston",
  "profile": {
    "name": "James Ruston",
    "nickname": "The Master",
    "birth_date": "1965-03-15",
    "profile_image": "james_ruston.jpg"
  },
  "career_stats": {
    "tournaments_played": 35,
    "first_tournament": 1985,
    "last_tournament": 2023,
    "total_rounds": 560,
    "total_tricks": 3808,
    "average_tricks_per_round": 6.8,
    "tournament_victories": 8,
    "runner_up_finishes": 12,
    "top_three_finishes": 23,
    "booby_prizes": 2,
    "win_percentage": 68.0
  },
  "tournament_history": [
    {
      "year": 2023,
      "tournament": "Christmas Championship",
      "final_position": 1,
      "total_tricks": 112,
      "age_at_tournament": 58,
      "notable_achievements": ["Tournament Winner", "Most 11-tricks (3)"]
    }
  ]
}
```

### Partnership Analysis
Calculated from partnership combinations:

```javascript
{
  "partnership_id": "james_ruston_mary_wilson",
  "players": ["James Ruston", "Mary Wilson"],
  "stats": {
    "times_partnered": 15,
    "total_tricks": 105,
    "average_tricks": 7.0,
    "success_rate": 0.73,
    "best_tournament": "Christmas Championship 2023",
    "chemistry_rating": "Excellent"
  }
}
```

---

## Statistical Calculations

### Player Performance Metrics

#### Basic Statistics
- **Tricks Per Round**: `total_tricks / total_rounds`
- **Win Percentage**: `(tricks_over_6.5 / total_rounds) * 100`
- **Tournament Win Rate**: `tournament_victories / tournaments_played`

#### Advanced Metrics
- **Consistency Score**: Standard deviation of round scores
- **Clutch Performance**: Performance in final rounds vs. early rounds
- **Trump Suit Preferences**: Best/worst performing trump suits
- **Age-Adjusted Performance**: Performance relative to age

### Tournament Analysis

#### Competitive Balance
- **Score Distribution**: How spread out final scores were
- **Lead Changes**: How often the leader changed throughout rounds
- **Margin of Victory**: Difference between winner and runner-up

#### Historical Trends
- **Performance Evolution**: How players improved/declined over time
- **Tournament Difficulty**: Average score changes year-over-year
- **Participation Patterns**: Which players played together most often

---

## Data Processing Pipeline

### 1. CSV Import
```javascript
// Read CSV file
const csvData = await readCSV('tournament_2023.csv');

// Validate data integrity
validateScorecards(csvData);

// Parse into structured format
const tournaments = parseTournamentData(csvData);
```

### 2. Tournament Structure Derivation
```javascript
// Calculate partnerships per round
const partnerships = derivePartnerships(csvData);

// Determine table assignments
const tables = calculateTableAssignments(partnerships);

// Track tournament progression
const progression = calculateProgression(csvData);
```

### 3. Player Statistics Calculation
```javascript
// Aggregate player performance
const playerStats = calculatePlayerStats(csvData);

// Calculate career metrics
const careerStats = calculateCareerStats(playerStats);

// Generate player profiles
const profiles = generatePlayerProfiles(careerStats);
```

### 4. Advanced Analytics
```javascript
// Partnership analysis
const partnershipStats = analyzePartnerships(csvData);

// Head-to-head records
const headToHead = calculateHeadToHead(csvData);

// Historical trends
const trends = analyzeTrends(csvData);
```

---

## File Storage Structure

### Data Directory Layout
```
data/
├── raw/
│   ├── tournament_1984.csv
│   ├── tournament_1985.csv
│   └── ...
├── processed/
│   ├── tournaments.json
│   ├── players.json
│   ├── partnerships.json
│   └── statistics.json
└── cache/
    ├── leaderboards.json
    └── analytics.json
```

### JSON Output Format
Processed data is stored in JSON format for efficient website loading:

- **tournaments.json**: All tournament metadata and results
- **players.json**: Complete player profiles and statistics
- **partnerships.json**: Partnership analysis and chemistry data
- **statistics.json**: Advanced analytics and historical trends

---

## Data Integrity Measures

### Validation Checks
1. **Scorecard Completeness**: Every round has complete data
2. **Mathematical Consistency**: Tricks always sum to 13
3. **Partnership Logic**: No player partners with themselves
4. **Trump Suit Sequence**: Correct rotation pattern
5. **Name Consistency**: Player names spelled identically

### Error Handling
- **Missing Data**: Graceful degradation with clear indicators
- **Inconsistent Names**: Fuzzy matching with manual review
- **Invalid Scores**: Highlight problematic entries for correction
- **Duplicate Entries**: Detect and resolve duplicate scorecards

### Data Quality Metrics
- **Completeness**: Percentage of expected data present
- **Consistency**: How well data follows expected patterns
- **Accuracy**: Validation against known tournament facts

---

## Performance Considerations

### Calculation Efficiency
- **Incremental Processing**: Only recalculate changed data
- **Caching Strategy**: Cache expensive calculations
- **Lazy Loading**: Calculate detailed stats on demand

### Storage Optimization
- **Data Compression**: Minimize JSON file sizes
- **Selective Loading**: Load only needed data per page
- **Image Optimization**: Compress and optimize photos

---

## Future Enhancements

### Additional Data Sources
- **Photo Metadata**: Extract tournament photos automatically
- **Player Interviews**: Qualitative data about memorable moments
- **Weather Data**: Correlation with tournament performance

### Advanced Analytics
- **Predictive Modeling**: Forecast tournament outcomes
- **Machine Learning**: Identify performance patterns
- **Network Analysis**: Social connections and partnerships

### Real-Time Features
- **Live Tournament Tracking**: Input scores during tournaments
- **Progressive Statistics**: Update stats as tournament progresses
- **Mobile Scorecard Entry**: Streamlined data input process

---

This data structure enables comprehensive analysis of 40 years of tournament history while maintaining simplicity and data integrity.