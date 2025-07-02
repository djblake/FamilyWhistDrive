/**
 * Tournament Data Processing Engine
 * Handles CSV scorecard data and derives tournament structure
 */

class TournamentEngine {
    constructor() {
        this.tournaments = new Map();
        this.players = new Map();
        this.partnerships = new Map();
        this.rawScorecards = [];
        
        // Official 20-player tournament schedule (from devenezia.com)
        this.officialSchedule = this.generateOfficialSchedule();
        
        // Trump suit rotation
        this.trumpSuits = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
    }

    /**
     * Generate the official 20-player tournament schedule
     * Based on devenezia.com Whist algorithm
     */
    generateOfficialSchedule() {
        const schedule = [];
        
        // Round 1-19 schedule (simplified representation)
        // This would contain the exact partnership combinations from the screenshot
        const rounds = [
            // Round 1
            {
                round: 1,
                tables: [
                    { table: 1, pairs: [[20, 1], [13, 18]], opponents: [[2, 19], [7, 15]] },
                    { table: 2, pairs: [[2, 19], [7, 15]], opponents: [[20, 1], [13, 18]] },
                    { table: 3, pairs: [[3, 16], [5, 6]], opponents: [[4, 11], [10, 14]] },
                    { table: 4, pairs: [[4, 11], [10, 14]], opponents: [[3, 16], [5, 6]] },
                    { table: 5, pairs: [[8, 17], [9, 12]], opponents: [[8, 17], [9, 12]] }
                ]
            }
            // Additional rounds would follow the same pattern
        ];
        
        // For now, generate a simplified schedule structure
        for (let round = 1; round <= 20; round++) {
            const trumpSuit = this.trumpSuits[(round - 1) % 4];
            const isRepeatRound = round === 20;
            const baseRound = isRepeatRound ? 1 : round;
            
            schedule.push({
                round: round,
                trump_suit: trumpSuit,
                is_repeat: isRepeatRound,
                base_round: baseRound,
                tables: this.generateRoundPartnerships(baseRound)
            });
        }
        
        return schedule;
    }

    /**
     * Generate partnership combinations for a specific round
     * This is a simplified version - in production would use the exact devenezia.com schedule
     */
    generateRoundPartnerships(round) {
        const tables = [];
        
        // Simplified partnership rotation algorithm
        // In production, this would match the exact devenezia.com output
        for (let table = 1; table <= 5; table++) {
            const baseOffset = (round - 1) * 2 + (table - 1) * 4;
            
            const pair1 = [
                ((baseOffset) % 20) + 1,
                ((baseOffset + 10) % 20) + 1
            ];
            
            const pair2 = [
                ((baseOffset + 1) % 20) + 1,
                ((baseOffset + 11) % 20) + 1
            ];
            
            tables.push({
                table: table,
                partnerships: [
                    { players: pair1, opponents: pair2 },
                    { players: pair2, opponents: pair1 }
                ]
            });
        }
        
        return tables;
    }

    /**
     * Process CSV scorecard data
     */
    async processScorecardCSV(csvData) {
        const lines = csvData.trim().split('\n');
        const headers = lines[0].split(',');
        
        this.rawScorecards = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const scorecard = {};
            
            headers.forEach((header, index) => {
                scorecard[header.trim()] = values[index]?.trim();
            });
            
            // Validate scorecard data
            if (this.validateScorecard(scorecard)) {
                this.rawScorecards.push(scorecard);
            }
        }
        
        // Process the scorecards into tournament structure
        this.processRawScorecards();
        
        return this.rawScorecards.length;
    }

    /**
     * Validate individual scorecard entry
     */
    validateScorecard(scorecard) {
        const required = ['Tournament', 'Year', 'Round', 'Trump_Suit', 'Player1', 'Player2', 'Tricks_Won', 'Opponent1', 'Opponent2', 'Opponent_Tricks'];
        
        // Check all required fields exist
        for (const field of required) {
            if (!scorecard[field]) {
                console.warn(`Missing field ${field} in scorecard:`, scorecard);
                return false;
            }
        }
        
        // Validate trick counts
        const tricks = parseInt(scorecard.Tricks_Won);
        const opponentTricks = parseInt(scorecard.Opponent_Tricks);
        
        if (tricks + opponentTricks !== 13) {
            console.warn(`Trick count doesn't add to 13:`, scorecard);
            return false;
        }
        
        // Validate trump suit
        if (!this.trumpSuits.includes(scorecard.Trump_Suit)) {
            console.warn(`Invalid trump suit:`, scorecard.Trump_Suit);
            return false;
        }
        
        return true;
    }

    /**
     * Process raw scorecards into structured tournament data
     */
    processRawScorecards() {
        // Group scorecards by tournament
        const tournamentGroups = this.groupScorecardsByTournament();
        
        // Process each tournament
        for (const [tournamentKey, scorecards] of tournamentGroups) {
            this.processTournament(tournamentKey, scorecards);
        }
        
        // Calculate player statistics
        this.calculatePlayerStatistics();
        
        // Calculate partnership statistics
        this.calculatePartnershipStatistics();
    }

    /**
     * Group scorecards by tournament and year
     */
    groupScorecardsByTournament() {
        const groups = new Map();
        
        for (const scorecard of this.rawScorecards) {
            const key = `${scorecard.Tournament}_${scorecard.Year}`;
            
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            
            groups.get(key).push(scorecard);
        }
        
        return groups;
    }

    /**
     * Process individual tournament
     */
    processTournament(tournamentKey, scorecards) {
        const [tournamentName, year] = tournamentKey.split('_');
        
        // Group by rounds
        const rounds = new Map();
        
        for (const scorecard of scorecards) {
            const roundNum = parseInt(scorecard.Round);
            
            if (!rounds.has(roundNum)) {
                rounds.set(roundNum, []);
            }
            
            rounds.get(roundNum).push(scorecard);
        }
        
        // Process each round
        const processedRounds = [];
        const playerScores = new Map();
        
        for (const [roundNum, roundScorecards] of rounds) {
            const roundData = this.processRound(roundNum, roundScorecards);
            processedRounds.push(roundData);
            
            // Track cumulative scores
            this.updatePlayerScores(playerScores, roundData);
        }
        
        // Calculate final standings
        const finalStandings = this.calculateFinalStandings(playerScores);
        
        // Store tournament data
        const tournament = {
            id: tournamentKey.toLowerCase().replace(/\s+/g, '_'),
            name: tournamentName,
            year: parseInt(year),
            rounds: processedRounds.sort((a, b) => a.round - b.round),
            final_standings: finalStandings,
            total_players: finalStandings.length,
            winner: finalStandings[0]?.player,
            runner_up: finalStandings[1]?.player,
            total_rounds: processedRounds.length
        };
        
        this.tournaments.set(tournamentKey, tournament);
    }

    /**
     * Process individual round
     */
    processRound(roundNum, scorecards) {
        const trumpSuit = scorecards[0]?.Trump_Suit;
        const tables = new Map();
        
        // Group scorecards by table (derived from partnerships)
        for (const scorecard of scorecards) {
            const partnership = [scorecard.Player1, scorecard.Player2].sort().join('_');
            const opposition = [scorecard.Opponent1, scorecard.Opponent2].sort().join('_');
            const tableKey = [partnership, opposition].sort().join('_vs_');
            
            if (!tables.has(tableKey)) {
                tables.set(tableKey, []);
            }
            
            tables.get(tableKey).push(scorecard);
        }
        
        // Process each table
        const processedTables = [];
        let tableNum = 1;
        
        for (const [tableKey, tableCards] of tables) {
            const tableData = {
                table: tableNum++,
                partnerships: tableCards.map(card => ({
                    players: [card.Player1, card.Player2],
                    tricks: parseInt(card.Tricks_Won),
                    opponents: [card.Opponent1, card.Opponent2]
                }))
            };
            
            processedTables.push(tableData);
        }
        
        return {
            round: roundNum,
            trump_suit: trumpSuit,
            tables: processedTables
        };
    }

    /**
     * Parse shared hands from player names containing "+"
     * Returns { players: [array], isShared: boolean }
     */
    parseSharedHand(playerName) {
        if (playerName.includes('+')) {
            const players = playerName.split('+').map(name => name.trim());
            return { players, isShared: true };
        }
        return { players: [playerName], isShared: false };
    }

    /**
     * Update cumulative player scores with shared hand support
     */
    updatePlayerScores(playerScores, roundData) {
        for (const table of roundData.tables) {
            for (const partnership of table.partnerships) {
                for (const playerName of partnership.players) {
                    const parsedPlayer = this.parseSharedHand(playerName);
                    
                    for (const actualPlayer of parsedPlayer.players) {
                        if (!playerScores.has(actualPlayer)) {
                            playerScores.set(actualPlayer, { 
                                total_tricks: 0, 
                                rounds_played: 0,
                                individual_tricks: 0,
                                individual_rounds: 0,
                                shared_tricks: 0,
                                shared_rounds: 0
                            });
                        }
                        
                        const playerData = playerScores.get(actualPlayer);
                        
                        if (parsedPlayer.isShared) {
                            // Split tricks equally among shared players
                            const splitTricks = partnership.tricks / parsedPlayer.players.length;
                            playerData.total_tricks += partnership.tricks; // Full credit for averages
                            playerData.shared_tricks += splitTricks; // Split credit for sums
                            playerData.shared_rounds += 1;
                        } else {
                            playerData.total_tricks += partnership.tricks;
                            playerData.individual_tricks += partnership.tricks;
                            playerData.individual_rounds += 1;
                        }
                        
                        playerData.rounds_played += 1;
                    }
                }
            }
        }
    }

    /**
     * Calculate final tournament standings
     */
    calculateFinalStandings(playerScores) {
        const standings = [];
        
        for (const [player, data] of playerScores) {
            // Use combined tricks for tournament standings (individual + split shared)
            const combinedTricks = data.individual_tricks + data.shared_tricks;
            
            standings.push({
                player: player,
                total_tricks: combinedTricks, // Combined total for rankings
                rounds_played: data.rounds_played,
                average_tricks: (data.total_tricks / data.rounds_played).toFixed(2), // Average using full trick credit
                individual_tricks: data.individual_tricks || 0,
                shared_tricks: data.shared_tricks || 0,
                individual_rounds: data.individual_rounds || 0,
                shared_rounds: data.shared_rounds || 0
            });
        }
        
        // Sort by combined tricks (descending)
        standings.sort((a, b) => b.total_tricks - a.total_tricks);
        
        // Add positions
        standings.forEach((standing, index) => {
            standing.position = index + 1;
        });
        
        return standings;
    }

    /**
     * Calculate comprehensive player statistics with shared hand support
     */
    calculatePlayerStatistics() {
        // This will calculate career stats across all tournaments
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const standing of tournament.final_standings) {
                const player = standing.player;
                
                if (!this.players.has(player)) {
                    this.players.set(player, {
                        name: player,
                        // Combined stats (default display)
                        tournaments_played: 0,
                        total_tricks: 0, // Combined individual + shared
                        total_rounds: 0,
                        tournament_wins: 0,
                        top_three_finishes: 0,
                        // Individual stats (solo play only)
                        individual: {
                            tournaments_played: 0,
                            total_tricks: 0,
                            total_rounds: 0,
                            tournament_wins: 0,
                            top_three_finishes: 0
                        },
                        // Shared hand tracking
                        shared_rounds: 0,
                        shared_tricks: 0,
                        tournament_history: []
                    });
                }
                
                const playerData = this.players.get(player);
                const hasSharedRounds = standing.shared_rounds > 0;
                
                // Combined stats (always updated)
                playerData.tournaments_played++;
                playerData.total_tricks += standing.total_tricks; // Combined total
                playerData.total_rounds += standing.rounds_played;
                playerData.shared_rounds += standing.shared_rounds || 0;
                playerData.shared_tricks += standing.shared_tricks || 0;
                
                if (standing.position === 1) {
                    playerData.tournament_wins++;
                }
                if (standing.position <= 3) {
                    playerData.top_three_finishes++;
                }
                
                // Individual stats (only if no shared rounds in this tournament)
                if (!hasSharedRounds) {
                    playerData.individual.tournaments_played++;
                    playerData.individual.total_tricks += standing.individual_tricks || standing.total_tricks;
                    playerData.individual.total_rounds += standing.individual_rounds || standing.rounds_played;
                    
                    if (standing.position === 1) {
                        playerData.individual.tournament_wins++;
                    }
                    if (standing.position <= 3) {
                        playerData.individual.top_three_finishes++;
                    }
                }
                
                playerData.tournament_history.push({
                    tournament: tournament.name,
                    year: tournament.year,
                    position: standing.position,
                    tricks: standing.total_tricks,
                    individual_tricks: standing.individual_tricks || 0,
                    shared_tricks: standing.shared_tricks || 0,
                    has_shared_rounds: hasSharedRounds
                });
            }
        }
        
        // Calculate averages for both combined and individual stats
        for (const [player, data] of this.players) {
            data.average_tricks = data.total_rounds > 0 ? (data.total_tricks / data.total_rounds).toFixed(2) : 0;
            data.individual.average_tricks = data.individual.total_rounds > 0 ? 
                (data.individual.total_tricks / data.individual.total_rounds).toFixed(2) : 0;
        }
    }

    /**
     * Get player statistics with option for individual vs combined
     */
    getPlayerStats(playerName, includeSharedHands = true) {
        const player = this.players.get(playerName);
        if (!player) return null;
        
        if (includeSharedHands) {
            // Return combined stats (default)
            return {
                name: player.name,
                tournaments_played: player.tournaments_played,
                total_tricks: player.total_tricks,
                total_rounds: player.total_rounds,
                average_tricks: player.average_tricks,
                tournament_wins: player.tournament_wins,
                top_three_finishes: player.top_three_finishes,
                shared_rounds: player.shared_rounds,
                shared_tricks: player.shared_tricks,
                win_percentage: player.tournaments_played > 0 ? 
                    ((player.tournament_wins / player.tournaments_played) * 100).toFixed(1) : 0,
                stat_type: 'combined'
            };
        } else {
            // Return individual-only stats
            return {
                name: player.name,
                tournaments_played: player.individual.tournaments_played,
                total_tricks: player.individual.total_tricks,
                total_rounds: player.individual.total_rounds,
                average_tricks: player.individual.average_tricks,
                tournament_wins: player.individual.tournament_wins,
                top_three_finishes: player.individual.top_three_finishes,
                win_percentage: player.individual.tournaments_played > 0 ? 
                    ((player.individual.tournament_wins / player.individual.tournaments_played) * 100).toFixed(1) : 0,
                stat_type: 'individual'
            };
        }
    }

    /**
     * Get all players ranked by combined stats
     */
    getPlayerRankings(includeSharedHands = true) {
        const rankings = [];
        
        for (const [playerName, playerData] of this.players) {
            const stats = this.getPlayerStats(playerName, includeSharedHands);
            if (stats) {
                rankings.push(stats);
            }
        }
        
        // Sort by tournament wins, then by total tricks
        rankings.sort((a, b) => {
            if (b.tournament_wins !== a.tournament_wins) {
                return b.tournament_wins - a.tournament_wins;
            }
            return b.total_tricks - a.total_tricks;
        });
        
        // Add ranking positions
        rankings.forEach((player, index) => {
            player.rank = index + 1;
        });
        
        return rankings;
    }

    /**
     * Check if a player has any shared hand history
     */
    playerHasSharedHands(playerName) {
        const player = this.players.get(playerName);
        return player ? player.shared_rounds > 0 : false;
    }

    /**
     * Calculate partnership statistics with shared hand awareness
     */
    calculatePartnershipStatistics() {
        // Analyze partnership combinations and success rates
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const round of tournament.rounds) {
                for (const table of round.tables) {
                    for (const partnership of table.partnerships) {
                        const partnershipKey = partnership.players.sort().join('_');
                        
                        if (!this.partnerships.has(partnershipKey)) {
                            this.partnerships.set(partnershipKey, {
                                players: partnership.players.sort(),
                                times_partnered: 0,
                                total_tricks: 0,
                                rounds_played: 0
                            });
                        }
                        
                        const partnershipData = this.partnerships.get(partnershipKey);
                        partnershipData.times_partnered++;
                        partnershipData.total_tricks += partnership.tricks;
                        partnershipData.rounds_played++;
                    }
                }
            }
        }
    }

    /**
     * Get tournament data by key
     */
    getTournament(tournamentKey) {
        return this.tournaments.get(tournamentKey);
    }

    /**
     * Get all tournaments
     */
    getAllTournaments() {
        return Array.from(this.tournaments.values()).sort((a, b) => b.year - a.year);
    }

    /**
     * Get player data
     */
    getPlayer(playerName) {
        return this.players.get(playerName);
    }

    /**
     * Get all players sorted by performance
     */
    getAllPlayers(sortBy = 'total_tricks') {
        const players = Array.from(this.players.values());
        
        switch (sortBy) {
            case 'tournament_wins':
                return players.sort((a, b) => b.tournament_wins - a.tournament_wins);
            case 'win_percentage':
                return players.sort((a, b) => {
                    const aWinPct = (a.total_tricks / a.total_rounds) * 100;
                    const bWinPct = (b.total_tricks / b.total_rounds) * 100;
                    return bWinPct - aWinPct;
                });
            default:
                return players.sort((a, b) => b.total_tricks - a.total_tricks);
        }
    }

    /**
     * Get partnership analysis
     */
    getPartnershipAnalysis() {
        return Array.from(this.partnerships.values())
            .sort((a, b) => (b.total_tricks / b.rounds_played) - (a.total_tricks / a.rounds_played));
    }

    /**
     * Export processed data as JSON
     */
    exportToJSON() {
        return {
            tournaments: Object.fromEntries(this.tournaments),
            players: Object.fromEntries(this.players),
            partnerships: Object.fromEntries(this.partnerships),
            generated_at: new Date().toISOString()
        };
    }

    /**
     * Create sample CSV data with shared hands for testing
     */
    generateSampleSharedHandCSV() {
        const csvData = `Tournament,Year,Round,Trump_Suit,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks
Christmas,2023,1,Hearts,James Ruston,Margaret Wilson,8,David Smith+Sarah Brown,Emma Jones,5
Christmas,2023,1,Hearts,David Smith+Sarah Brown,Emma Jones,5,James Ruston,Margaret Wilson,8
Christmas,2023,2,Diamonds,James Ruston,Emma Jones,7,Margaret Wilson,David Smith+Sarah Brown,6
Christmas,2023,2,Diamonds,Margaret Wilson,David Smith+Sarah Brown,6,James Ruston,Emma Jones,7`;
        
        return csvData;
    }

    /**
     * Test shared hand parsing with sample data
     */
    testSharedHands() {
        console.log('🧪 Testing Shared Hand System...');
        
        // Test the parsing function
        const testCases = [
            'James Ruston',
            'David Smith+Sarah Brown',
            'Tom Wilson + Jane Smith',
            'Player A+Player B+Player C'
        ];
        
        testCases.forEach(playerName => {
            const result = this.parseSharedHand(playerName);
            console.log(`Input: "${playerName}" -> Players: [${result.players.join(', ')}], Shared: ${result.isShared}`);
        });
        
        // Process sample data
        const sampleCSV = this.generateSampleSharedHandCSV();
        console.log('\n📄 Sample CSV with shared hands:');
        console.log(sampleCSV);
        
        // Process the sample data
        this.processScorecardCSV(sampleCSV).then(recordCount => {
            console.log(`\n✅ Processed ${recordCount} scorecard records`);
            
            // Show player stats
            console.log('\n👥 Player Statistics:');
            for (const [playerName, playerData] of this.players) {
                const combinedStats = this.getPlayerStats(playerName, true);
                const individualStats = this.getPlayerStats(playerName, false);
                const hasShared = this.playerHasSharedHands(playerName);
                
                console.log(`\n${playerName}:`);
                console.log(`  Combined: ${combinedStats.total_tricks} tricks, ${combinedStats.average_tricks} avg`);
                console.log(`  Individual: ${individualStats.total_tricks} tricks, ${individualStats.average_tricks} avg`);
                console.log(`  Has shared hands: ${hasShared}`);
                if (hasShared) {
                    console.log(`  Shared rounds: ${combinedStats.shared_rounds}, Shared tricks: ${combinedStats.shared_tricks}`);
                }
            }
        });
        
        return true;
    }
}

// Export for use in other scripts
window.TournamentEngine = TournamentEngine;