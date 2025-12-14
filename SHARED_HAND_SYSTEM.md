# Shared Hand System Documentation

## Overview

The Whist tournament system now supports **shared hands** - situations where two or more players share a single hand position during a tournament round to achieve the correct number of players for partnerships.

## How It Works

### CSV Format
Shared hands are identified by the `+` symbol in player names:

```csv
Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas,2023,1,Hearts,James Ruston,Margaret Wilson,8,David Smith+Sarah Brown,Emma Jones,5
Christmas,2023,1,Hearts,David Smith+Sarah Brown,Emma Jones,5,James Ruston,Margaret Wilson,8
```

### Statistical Calculation

**Sums (Tricks, Tournament Totals):**
- Split equally between shared players
- Example: 6 tricks shared between David + Sarah = 3 tricks each for totals

**Averages (Per-round performance):**
- Applied to both players fully
- Example: 6 tricks average applied to both David and Sarah

**Tournament Rankings:**
- Based on combined individual + split shared tricks
- Ensures fair competition standings

## Player Statistics Structure

Each player maintains two sets of statistics:

### Combined Stats (Default Display)
- Includes both individual play and shared hand participation
- Used for default leaderboards and rankings
- Most comprehensive view of player performance

### Individual Stats (Detail View)
- Only tournaments/rounds where player competed alone
- Excludes any shared hand participation
- Shows "pure" individual performance

## Data Model

```javascript
playerData = {
  name: "David Smith",
  // Combined stats (default)
  tournaments_played: 18,
  total_tricks: 1247,      // Individual + shared (full credit for averages)
  tournament_wins: 3,
  average_tricks: 6.8,
  
  // Individual-only stats  
  individual: {
    tournaments_played: 15,
    total_tricks: 1089,    // Only solo tournaments
    tournament_wins: 2,
    average_tricks: 7.1
  },
  
  // Shared hand tracking
  shared_rounds: 12,
  shared_tricks: 32        // Split portions only
}
```

## Usage Examples

### Getting Player Stats
```javascript
// Combined stats (default)
const combinedStats = engine.getPlayerStats("David Smith", true);

// Individual-only stats
const individualStats = engine.getPlayerStats("David Smith", false);

// Check if player has shared hand history
const hasShared = engine.playerHasSharedHands("Some Player");
```

### Player Rankings
```javascript
// Rankings including shared hands (default)
const allRankings = engine.getPlayerRankings(true);

// Rankings excluding shared hands
const individualRankings = engine.getPlayerRankings(false);
```

## Testing

The shared-hand logic is exercised through real tournament data loads. No sample/dummy data helpers are shipped with the site.

## UI Integration

- **Default View**: Shows combined statistics (individual + shared)
- **Detail View**: Shows both individual and combined with breakdown
- **Historical Context**: Tournament history indicates which years had shared hands
- **Visual Indicators**: UI can show when shared hand data affects displayed statistics

## Benefits

1. **Fair Competition**: Tournament rankings use appropriately split scores
2. **Complete History**: No data loss when players share hands
3. **Flexible Analysis**: Can analyze individual vs collaborative performance
4. **Historical Accuracy**: Maintains complete tournament records
5. **Future Planning**: Helps identify when shared hands are needed

## Historical Data Migration

When preparing historical data with shared hands:

1. Identify tournaments where shared hands occurred
2. Update CSV files with `+` notation for shared player names
3. Reprocess tournament data to update statistics
4. Verify both individual and combined stats are calculated correctly

This system ensures complete statistical accuracy while maintaining the family tournament tradition of including everyone regardless of total player count.