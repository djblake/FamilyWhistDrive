# Ruston Family Whist Drive

> **The World's Most Prestigious Family Tournament Website**  
> *Immortalizing 40 Years of Championship Excellence*

[![Website](https://img.shields.io/badge/Website-rustonwhistdrive.pages.dev-blue)](https://rustonwhistdrive.pages.dev)
[![Status](https://img.shields.io/badge/Status-In%20Development-yellow)](#)
[![Started](https://img.shields.io/badge/Started-July%202024-green)](#)

## 🎴 About the Tournament

The Ruston Family Whist Drive is a legendary annual Partners Whist tournament that has been running for **40 consecutive years** since 1984. This website serves as the official digital archive, showcasing four decades of family rivalry, strategic brilliance, and unforgettable moments.

### Tournament Format
- **Partners Whist** (4 players, partnerships)
- **16 Rounds** per tournament
- **Trump Rotation**: Hearts → Diamonds → Spades → Clubs (×4 cycles)
- **13 Tricks** per round
- **Partnership Rotation** between rounds for fairness

## 🏆 Website Features

### 📊 Tournament Archive
- Complete historical record of all 40 tournaments
- Round-by-round scorecards with partnership tracking
- Original scorecard photos for authenticity
- Tournament-specific statistics and highlights

### 👥 Player Profiles
- Comprehensive career statistics for every player
- Tournament history with age progression
- Achievement tracking (wins, top-3 finishes, "booby prizes")
- Head-to-head records and partnership analysis

### 📈 Advanced Analytics
- Player leaderboards with multiple ranking systems
- Tournament progress visualizations (horse race-style charts)
- Partnership chemistry analysis
- Performance trends over decades

### 📸 Photo Galleries
- Tournament photos automatically loaded from folders
- Responsive gallery with lightbox functionality
- Memories from 40 years of family gatherings

## 🛠️ Technical Architecture

### Tech Stack
- **Frontend**: Pure HTML/CSS/JavaScript (no frameworks)
- **Styling**: Card-themed design with championship elegance
- **Data**: JSON files derived from CSV scorecards
- **Charts**: Chart.js for interactive visualizations
- **Hosting**: Cloudflare Pages (free tier)

### Key Design Decisions
- **Scorecard-Driven Architecture**: All tournament structure derived from scorecard data
- **Static Site**: No server required, perfect for free hosting
- **Mobile-First**: Optimized for sharing at family gatherings
- **Progressive Enhancement**: Works without JavaScript, enhanced with it

## 📁 Project Structure

```
WhistWebsite/
├── index.html                    # Main tournament hub
├── assets/
│   ├── css/main.css             # Card-themed styles
│   ├── js/main.js               # Tournament data management
│   └── images/                  # Site assets
├── data/                        # JSON tournament data
│   ├── tournaments.json         # Tournament metadata
│   ├── players.json             # Player profiles
│   └── scorecards/              # Individual tournament data
├── tournaments/                 # Tournament pages
│   └── [year]/
│       ├── index.html           # Tournament results
│       └── photos/              # Tournament photos
├── players/                     # Player profile pages
├── leaderboard/                 # Rankings and statistics
├── stats/                       # Advanced analytics
├── CLAUDE.md                    # Development context
├── PROJECT_CHECKLIST.md         # Task tracking
└── DATA_STRUCTURE.md            # Data model documentation
```

## 🚀 Getting Started

### Prerequisites
- Modern web browser
- Local web server (optional, for development)

### Development Setup
1. **Clone the repository**
   ```bash
   git clone [repository-url]
   cd WhistWebsite
   ```

2. **Start local development server** (optional)
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

3. **Open in browser**
   ```
   http://localhost:8000
   ```

### Data Management
The website uses a CSV-to-JSON conversion system:

1. **Input**: Tournament scorecards in CSV format
2. **Processing**: JavaScript calculates all tournament structure
3. **Output**: Rich analytics and visualizations

#### CSV Format
```csv
Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas Championship,2023,1,Hearts,James Ruston,Mary Wilson,7,David Smith,Emma Jones,6
```

## 📊 Data Model

### Core Concept: Derived Tournament Structure
Rather than storing tournament structure separately, everything is calculated from scorecard data:

- **Partnerships**: Derived from Player1+Player2 combinations
- **Table Assignments**: Calculated from opponent pairings
- **Head-to-Head Records**: Aggregated across all tournaments
- **Player Statistics**: Computed from individual performance data

### Key Statistics Calculated
- **Player Performance**: Win rates, average tricks, championship history
- **Partnership Analysis**: Most successful combinations, chemistry ratings
- **Tournament Metrics**: Competitive balance, scoring patterns
- **Historical Trends**: Performance evolution over 40 years

## 🎨 Design Philosophy

### Championship Elegance
- Over-the-top tournament presentation
- Professional sports-style statistics
- Humorous "world's most prestigious" language
- Family warmth with competitive spirit

### Playing Card Aesthetics
- Card suit symbols (♠ ♥ ♦ ♣) as design elements
- Red and black color scheme
- Card-like layout components
- Championship gold accents

## 🔄 Annual Update Process

1. **Collect Scorecards**: Gather physical scorecards from tournament
2. **Data Entry**: Convert to CSV format
3. **Upload**: Add CSV to data folder
4. **Automatic Processing**: Site recalculates all statistics
5. **Photo Upload**: Add tournament photos to photos folder
6. **Deploy**: Push to GitHub, Cloudflare Pages auto-deploys

## 📱 Mobile Optimization

The site is designed for mobile-first usage:
- Family members sharing results at gatherings
- Quick access to player statistics
- Responsive photo galleries
- Touch-friendly navigation

## 🚧 Development Status

### ✅ Completed
- [x] Project foundation and architecture
- [x] Card-themed design system
- [x] Main tournament hub page
- [x] Comprehensive documentation

### 🚧 In Progress
- [ ] Data structure implementation
- [ ] Sample tournament generation
- [ ] Player profile system

### 📋 Planned
- [ ] Photo gallery system
- [ ] Interactive charts and analytics
- [ ] CSV import functionality
- [ ] Cloudflare Pages deployment

See [PROJECT_CHECKLIST.md](PROJECT_CHECKLIST.md) for detailed progress tracking.

## 🎯 Success Metrics

- **Completeness**: All 40 years of tournament data preserved
- **Accuracy**: Statistics calculated correctly from scorecard data
- **Usability**: Easy navigation and mobile optimization
- **Performance**: Fast loading across all devices
- **Maintainability**: Simple annual update process

## 🤝 Contributing

<!-- Cache refresh - 2024-12-20 -->

This is a family project, but suggestions are welcome! Key areas:
- Historical accuracy of tournament data
- Additional statistical analysis ideas
- Design improvements for mobile experience
- Performance optimizations

## 📜 License

This project is a private family archive. All tournament data and photos remain property of the Ruston family.

## 🏅 Hall of Fame

*To be populated with championship winners and legendary moments...*

---

**Built with ❤️ for the Ruston Family**  
*Celebrating 40 Years of Championship Excellence*