/**
 * Ruston Family Whist Drive - Main JavaScript
 * Tournament data management and interactive features
 */

// Global tournament data
let tournamentEngine = null;
let sampleDataGenerator = null;
let currentTournament = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('🎴 Ruston Family Whist Drive - Loading Championship Data...');
    
    // Initialize tournament engine
    tournamentEngine = new TournamentEngine();
    sampleDataGenerator = new SampleDataGenerator();
    
    // Load data
    loadTournamentData();
    
    // Initialize UI components
    initializeNavigation();
    
    // Add smooth scrolling
    initializeSmoothScrolling();
    
    console.log('✨ Championship website loaded successfully!');
}

/**
 * Load tournament and player data
 */
async function loadTournamentData() {
    try {
        // Load sample CSV data and process it
        await loadAndProcessSampleData();
        
        // Update UI with processed data
        updateTournamentStats();
        
    } catch (error) {
        console.error('Error loading tournament data:', error);
        // Fallback to basic sample data
        loadBasicSampleData();
    }
}

/**
 * Load and process sample CSV data using the tournament engine
 */
async function loadAndProcessSampleData() {
    try {
        // Generate sample tournament data
        const sampleCSV = sampleDataGenerator.generateTournament('Christmas Championship', 2023, 8);
        
        // Process the CSV data
        const recordsProcessed = await tournamentEngine.processScorecardCSV(sampleCSV);
        console.log(`✅ Processed ${recordsProcessed} scorecard records`);
        
        // Get processed data
        const tournaments = tournamentEngine.getAllTournaments();
        const players = tournamentEngine.getAllPlayers();
        
        console.log(`📊 Tournament data loaded:`, {
            tournaments: tournaments.length,
            players: players.length
        });
        
        // Store in global variables for UI updates
        window.processedTournaments = tournaments;
        window.processedPlayers = players;
        
    } catch (error) {
        console.error('Error processing sample data:', error);
        throw error;
    }
}

/**
 * Load sample tournament data
 */
function loadSampleData() {
    // Sample data structure - will be replaced with JSON files
    tournamentData = {
        "2023": {
            year: 2023,
            title: "Christmas Championship",
            date: "2023-12-25",
            players: 12,
            rounds: 16,
            winner: "Margaret Ruston",
            runner_up: "James Wilson",
            total_tricks: 208,
            rounds_data: []
        },
        "2022": {
            year: 2022,
            title: "Ruby Anniversary Cup",
            date: "2022-12-25",
            players: 14,
            rounds: 16,
            winner: "Emma Ruston",
            runner_up: "David Wilson",
            total_tricks: 224,
            rounds_data: []
        },
        "2021": {
            year: 2021,
            title: "COVID Comeback Classic",
            date: "2021-12-25",
            players: 10,
            rounds: 16,
            winner: "David Wilson",
            runner_up: "Margaret Ruston",
            total_tricks: 160,
            rounds_data: []
        }
    };
    
    playerData = {
        "margaret-ruston": {
            id: "margaret-ruston",
            name: "Margaret Ruston",
            nickname: "The Ace",
            birth_date: "1965-03-15",
            tournaments_played: 35,
            career_wins: 127,
            tournament_victories: 8,
            top_three_finishes: 23,
            booby_prizes: 2,
            average_tricks_per_round: 6.8,
            best_year: 2023,
            profile_image: "margaret-ruston.jpg"
        },
        "james-ruston-sr": {
            id: "james-ruston-sr",
            name: "James Ruston Sr.",
            nickname: "The Master",
            birth_date: "1940-07-22",
            tournaments_played: 40,
            career_wins: 156,
            tournament_victories: 12,
            top_three_finishes: 28,
            booby_prizes: 1,
            average_tricks_per_round: 7.1,
            best_year: 1995,
            profile_image: "james-ruston-sr.jpg"
        },
        "emma-ruston": {
            id: "emma-ruston",
            name: "Emma Ruston",
            nickname: "The Prodigy",
            birth_date: "2006-11-08",
            tournaments_played: 6,
            career_wins: 34,
            tournament_victories: 1,
            top_three_finishes: 4,
            booby_prizes: 0,
            average_tricks_per_round: 6.9,
            best_year: 2022,
            profile_image: "emma-ruston.jpg"
        }
    };
}

/**
 * Calculate comprehensive player statistics
 */
function calculatePlayerStats() {
    Object.keys(playerData).forEach(playerId => {
        const player = playerData[playerId];
        
        // Calculate age
        player.current_age = calculateAge(player.birth_date);
        
        // Calculate win percentage
        player.win_percentage = ((player.career_wins / (player.tournaments_played * 16)) * 100).toFixed(1);
        
        // Calculate championship rate
        player.championship_rate = ((player.tournament_victories / player.tournaments_played) * 100).toFixed(1);
        
        // Calculate average finishing position (estimated)
        player.average_position = calculateAveragePosition(player);
        
        // Calculate years active
        const firstYear = 1984 + Math.floor(Math.random() * 10); // Random start year
        player.years_active = 2024 - firstYear;
        player.first_tournament = firstYear;
    });
}

/**
 * Calculate age from birth date
 */
function calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

/**
 * Calculate average finishing position for a player
 */
function calculateAveragePosition(player) {
    // Estimate based on win rate and tournament victories
    const winRate = player.career_wins / (player.tournaments_played * 16);
    const championshipRate = player.tournament_victories / player.tournaments_played;
    
    // Simple estimation - better players have lower average positions
    const basePosition = 6; // Middle position for average player
    const adjustment = (winRate - 0.4) * 10 + (championshipRate * 5);
    
    return Math.max(1, Math.min(12, Math.round(basePosition - adjustment)));
}

/**
 * Update tournament statistics in the UI
 */
function updateTournamentStats() {
    if (!window.processedTournaments || !window.processedPlayers) {
        console.log('📊 Tournament data not yet loaded, using placeholder stats');
        return;
    }
    
    const tournaments = window.processedTournaments;
    const players = window.processedPlayers;
    
    // Calculate real statistics
    const totalRounds = tournaments.reduce((sum, tournament) => sum + tournament.total_rounds, 0);
    const totalTricks = tournaments.reduce((sum, tournament) => {
        return sum + tournament.final_standings.reduce((trickSum, standing) => trickSum + standing.total_tricks, 0);
    }, 0);
    
    // Update stats in hero section
    updateStatIfExists('.stat-number', 0, 40); // 40 years (placeholder)
    updateStatIfExists('.stat-number', 1, totalRounds);
    updateStatIfExists('.stat-number', 2, totalTricks);
    updateStatIfExists('.stat-number', 3, '∞'); // Memories (keep as infinity symbol)
    
    console.log(`📈 Updated UI with stats:`, {
        tournaments: tournaments.length,
        totalRounds,
        totalTricks,
        players: players.length
    });
}

/**
 * Update a stat element if it exists
 */
function updateStatIfExists(selector, index, value) {
    const elements = document.querySelectorAll(selector);
    if (elements[index]) {
        elements[index].textContent = value.toLocaleString();
    }
}

/**
 * Initialize navigation functionality
 */
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;
    
    navLinks.forEach(link => {
        // Highlight active navigation item based on current path
        const href = link.getAttribute('href');
        if (href && currentPath.includes(href)) {
            link.classList.add('active');
        }
        
        // Add click handler for navigation
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active class to clicked link
            this.classList.add('active');
        });
    });
}

/**
 * Initialize smooth scrolling for anchor links
 */
function initializeSmoothScrolling() {
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

/**
 * Utility function to format dates
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

/**
 * Utility function to format numbers with commas
 */
function formatNumber(num) {
    return num.toLocaleString();
}

/**
 * Get player ranking based on various criteria
 */
function getPlayerRanking(criteria = 'overall') {
    const players = Object.values(playerData);
    
    switch (criteria) {
        case 'championships':
            return players.sort((a, b) => b.tournament_victories - a.tournament_victories);
        case 'career_wins':
            return players.sort((a, b) => b.career_wins - a.career_wins);
        case 'win_percentage':
            return players.sort((a, b) => parseFloat(b.win_percentage) - parseFloat(a.win_percentage));
        case 'recent_form':
            // Sort by recent performance (simplified)
            return players.sort((a, b) => {
                const aScore = (a.tournament_victories * 10) + parseFloat(a.win_percentage);
                const bScore = (b.tournament_victories * 10) + parseFloat(b.win_percentage);
                return bScore - aScore;
            });
        default:
            // Overall ranking combining multiple factors
            return players.sort((a, b) => {
                const aScore = (a.tournament_victories * 5) + 
                              (parseFloat(a.win_percentage) * 2) + 
                              (a.career_wins * 0.1);
                const bScore = (b.tournament_victories * 5) + 
                              (parseFloat(b.win_percentage) * 2) + 
                              (b.career_wins * 0.1);
                return bScore - aScore;
            });
    }
}

/**
 * Export functions for use in other scripts
 */
window.WhistDrive = {
    tournamentData,
    playerData,
    getPlayerRanking,
    formatDate,
    formatNumber,
    calculateAge
};