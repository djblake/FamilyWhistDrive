# Ruston Family Whist Drive - Development Context

## Project Overview
Building a website to immortalize 40 years of family Partners Whist tournaments. The site will showcase comprehensive tournament history, player statistics, and family memories with a humorous, over-the-top championship theme.

**Website URL**: rustonwhistdrive.pages.dev  
**Hosting**: Cloudflare Pages (free tier)  
**Started**: 2024-07-02

## Key Project Requirements

### Core Features
- **Player Profiles**: Deep statistics, tournament history, career achievements
- **Tournament Archive**: Complete historical tournament data (40 years)
- **Leaderboards**: Multiple ranking systems (overall, recent form, championships)
- **Photo Galleries**: Auto-populated from tournament photo folders
- **Interactive Charts**: Tournament progress visualization
- **Annual Updates**: CSV upload triggers automatic site rebuild

### Technical Architecture
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Data**: JSON files + client-side CSV processing
- **Styling**: Card-themed design with playing card aesthetics
- **Charts**: Chart.js for visualizations
- **Responsive**: Mobile-optimized design

## Partners Whist Game Rules (for context)
- 4 players in partnerships (partners sit opposite)
- 16 rounds per tournament
- Trump suit rotation: Hearts → Diamonds → Spades → Clubs (repeats 4 times)
- 13 tricks per round, partnerships rotate between rounds
- Scoring: 1 point per trick over 6 for each partnership

## Official Tournament Structure (CRITICAL)
**Tournament Generator**: https://www.devenezia.com/downloads/round-robin/rounds.php

### 20-Player Tournament Format
- **Players**: 20 total (numbered 1-20 for scheduling)
- **Tables**: 5 tables with 4 players each (2 partnerships per table)
- **Rounds**: 20 total (19 unique + Round 20 = Round 1 repeat)
- **Algorithm**: "Whist" format ensures each player partners with every other player exactly once
- **Partnership Rotation**: Balanced system where no partnership repeats over 19 rounds

### Tournament Schedule Structure
```
Round 1: Table 1 (P1,P13 vs P18,P2), Table 2 (P19,P7 vs P15,P3), etc.
Round 2: Partnership rotation ensures balanced competition
...
Round 19: Complete partnership cycle
Round 20: Repeat Round 1 (standard Whist practice)
```

### Trump Suit Mapping (20 rounds)
- **Rounds 1-4**: Hearts, Diamonds, Spades, Clubs (Cycle 1)
- **Rounds 5-8**: Hearts, Diamonds, Spades, Clubs (Cycle 2)
- **Rounds 9-12**: Hearts, Diamonds, Spades, Clubs (Cycle 3)
- **Rounds 13-16**: Hearts, Diamonds, Spades, Clubs (Cycle 4)
- **Rounds 17-20**: Hearts, Diamonds, Spades, Clubs (Cycle 5 - first 4)

## Critical Data Architecture Decision
**Reverse-Engineer Tournament Structure**: All tournament organization (partnerships, table assignments, opponent tracking) will be calculated from scorecard data rather than stored separately. This ensures single source of truth and enables rich analytics.

### CSV Data Structure
```csv
Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas Championship,2023,1,Hearts,James Ruston,Mary Wilson,7,David Smith,Emma Jones,6
```

### Derived Information
- Table assignments per round
- Partnership combinations
- Head-to-head records
- Player statistics
- Tournament progression

## Current Progress

### ✅ Completed
1. Basic project structure with directories
2. Main HTML page with championship theme
3. Card-themed CSS framework with responsive design
4. Basic JavaScript foundation with data management structure

### 🚧 In Progress
1. Creating persistent documentation files

### 📋 Next Steps
1. Complete documentation (PROJECT_CHECKLIST.md, README.md, DATA_STRUCTURE.md)
2. Build scorecard data model and calculation engine
3. Generate realistic sample tournament data
4. Create tournament and player pages

## File Structure
```
WhistWebsite/
├── index.html                    # Main tournament hub
├── assets/
│   ├── css/main.css             # Card-themed styles
│   ├── js/main.js               # Tournament data management
│   └── images/                  # Site assets
├── data/                        # JSON tournament data
├── tournaments/                 # Individual tournament pages
│   └── [year]/
│       ├── index.html           # Tournament results
│       └── photos/              # Tournament photos
├── players/                     # Player profile pages
├── leaderboard/                 # Rankings and statistics
├── stats/                       # Advanced analytics
├── CLAUDE.md                    # This file
├── PROJECT_CHECKLIST.md         # Task tracking
├── README.md                    # Project overview
└── DATA_STRUCTURE.md            # Data model documentation
```

## Design Themes
- **Championship Elegance**: Over-the-top tournament presentation
- **Playing Card Aesthetics**: Suit symbols, card-like layouts
- **Family Humor**: Tongue-in-cheek "most prestigious tournament" language
- **Color Scheme**: Card reds/blacks, championship gold, elegant typography

## Development Notes

### Session 1 (2024-07-02)
- Initial project setup and architecture discussion
- Decided on Cloudflare Pages hosting with free .pages.dev subdomain
- Created foundation HTML/CSS/JS files
- Established card-themed design system
- Key insight: Tournament structure should be derived from scorecard data
- **MAJOR DISCOVERY**: Found official tournament scheduling tool (devenezia.com)
- Confirmed 20-player format with balanced partnership rotation algorithm
- Understanding: 20 rounds (19 unique + 1 repeat) with 5 tables per round

### Key Decisions Made
1. **Hosting**: Cloudflare Pages with rustonwhistdrive.pages.dev
2. **Tech Stack**: Vanilla HTML/CSS/JS for simplicity and cost
3. **Data Model**: Scorecard-driven architecture
4. **Photos**: Auto-populated from tournament photo folders
5. **Updates**: Annual CSV upload workflow

## Commands to Remember
```bash
# Development server (if needed)
python -m http.server 8000

# Deploy to Cloudflare Pages
# Automatic deployment via GitHub integration
# Push to main branch triggers rebuild at rustonwhistdrive.pages.dev
git add .
git commit -m "Deploy updates"
git push origin main
```

## Deployment Status
- **Current URL**: https://rustonwhistdrive.pages.dev
- **Hosting**: Cloudflare Pages (free tier)
- **Auto-Deploy**: Connected to GitHub repo djblake/FamilyWhistDrive
- **Latest Deploy**: Google Sheets integration completed (2025-07-02)

## Future Enhancements (Post-MVP)
- Custom domain upgrade (rustonwhistdrive.com)
- Advanced player analytics
- Tournament prediction algorithms
- Social sharing features
- Mobile app companion

## Important Context for Future Sessions
- This is a family project celebrating 40 years of tradition
- Balance professional tournament presentation with family humor
- Data integrity is crucial - 40 years of history must be preserved
- Annual update workflow must be simple for non-technical family members
- Site should work perfectly on mobile for sharing at family gatherings