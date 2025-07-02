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
     * Update cumulative player scores
     */
    updatePlayerScores(playerScores, roundData) {
        for (const table of roundData.tables) {
            for (const partnership of table.partnerships) {
                for (const player of partnership.players) {
                    if (!playerScores.has(player)) {
                        playerScores.set(player, { total_tricks: 0, rounds_played: 0 });
                    }
                    
                    const playerData = playerScores.get(player);
                    playerData.total_tricks += partnership.tricks;
                    playerData.rounds_played += 1;
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
            standings.push({
                player: player,
                total_tricks: data.total_tricks,
                rounds_played: data.rounds_played,
                average_tricks: (data.total_tricks / data.rounds_played).toFixed(2)
            });
        }
        
        // Sort by total tricks (descending)
        standings.sort((a, b) => b.total_tricks - a.total_tricks);
        
        // Add positions
        standings.forEach((standing, index) => {
            standing.position = index + 1;
        });
        
        return standings;
    }

    /**
     * Calculate comprehensive player statistics
     */
    calculatePlayerStatistics() {
        // This will calculate career stats across all tournaments
        for (const [tournamentKey, tournament] of this.tournaments) {
            for (const standing of tournament.final_standings) {
                const player = standing.player;
                
                if (!this.players.has(player)) {
                    this.players.set(player, {
                        name: player,
                        tournaments_played: 0,
                        total_tricks: 0,
                        total_rounds: 0,
                        tournament_wins: 0,
                        top_three_finishes: 0,
                        tournament_history: []
                    });
                }
                
                const playerData = this.players.get(player);
                playerData.tournaments_played++;
                playerData.total_tricks += standing.total_tricks;
                playerData.total_rounds += standing.rounds_played;
                
                if (standing.position === 1) {
                    playerData.tournament_wins++;
                }
                
                if (standing.position <= 3) {
                    playerData.top_three_finishes++;
                }
                
                playerData.tournament_history.push({
                    tournament: tournament.name,
                    year: tournament.year,
                    position: standing.position,
                    tricks: standing.total_tricks
                });
            }
        }
    }

    /**
     * Calculate partnership statistics
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
}

// Export for use in other scripts
window.TournamentEngine = TournamentEngine;