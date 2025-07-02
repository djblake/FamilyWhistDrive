/**
 * Family Tree Management System
 * Handles family relationships, statistics, and visualizations
 */

class FamilyTree {
    constructor() {
        this.families = new Map();
        this.players = new Map();
        this.rivalries = [];
        this.alliances = [];
        this.crossFamilyMarriages = [];
        this.tournamentEngine = null; // Will be injected
    }

    /**
     * Load family tree data from JSON
     */
    async loadFamilyData(familyDataUrl = '/data/family-tree.json') {
        try {
            const response = await fetch(familyDataUrl);
            const familyData = await response.json();
            
            this.processFamilyData(familyData);
            console.log('✅ Family tree data loaded successfully');
            return true;
        } catch (error) {
            console.error('❌ Error loading family data:', error);
            return false;
        }
    }

    /**
     * Process and structure family data
     */
    processFamilyData(familyData) {
        // Process families and create player mappings
        for (const [familyId, familyInfo] of Object.entries(familyData.families)) {
            this.families.set(familyId, familyInfo);
            
            // Process each generation
            for (const [genId, generation] of Object.entries(familyInfo.generations)) {
                for (const member of generation.members) {
                    member.family_id = familyId;
                    member.generation = parseInt(genId);
                    member.family_color = familyInfo.family_color;
                    member.family_name = familyInfo.family_name;
                    
                    this.players.set(member.id, member);
                }
            }
        }

        // Store rivalries and alliances
        this.rivalries = familyData.family_rivalries || [];
        this.alliances = familyData.family_alliances || [];
        this.crossFamilyMarriages = familyData.cross_family_marriages || [];
    }

    /**
     * Set tournament engine for statistics integration
     */
    setTournamentEngine(engine) {
        this.tournamentEngine = engine;
    }

    /**
     * Get family information by ID
     */
    getFamily(familyId) {
        return this.families.get(familyId);
    }

    /**
     * Get all families
     */
    getAllFamilies() {
        return Array.from(this.families.values());
    }

    /**
     * Get player family information
     */
    getPlayerFamily(playerId) {
        const player = this.players.get(playerId);
        if (!player) return null;
        
        return {
            player: player,
            family: this.families.get(player.family_id)
        };
    }

    /**
     * Get all players in a family
     */
    getFamilyMembers(familyId) {
        const members = [];
        for (const [playerId, player] of this.players) {
            if (player.family_id === familyId) {
                members.push(player);
            }
        }
        
        // Sort by generation and birth year
        return members.sort((a, b) => {
            if (a.generation !== b.generation) {
                return a.generation - b.generation;
            }
            return a.birth_year - b.birth_year;
        });
    }

    /**
     * Get players by generation across all families
     */
    getGeneration(generationNumber) {
        const generation = [];
        for (const [playerId, player] of this.players) {
            if (player.generation === generationNumber) {
                generation.push(player);
            }
        }
        
        return generation.sort((a, b) => a.birth_year - b.birth_year);
    }

    /**
     * Calculate family statistics using tournament engine
     */
    calculateFamilyStatistics(familyId) {
        if (!this.tournamentEngine) {
            console.warn('Tournament engine not set - cannot calculate family statistics');
            return null;
        }

        const familyMembers = this.getFamilyMembers(familyId);
        const family = this.getFamily(familyId);
        
        const stats = {
            family_name: family.family_name,
            family_color: family.family_color,
            total_members: familyMembers.length,
            active_members: familyMembers.filter(m => m.status === 'active').length,
            generations: family.generations ? Object.keys(family.generations).length : 0,
            tournament_wins: 0,
            total_tournaments: 0,
            total_tricks: 0,
            total_rounds: 0,
            top_performers: [],
            family_champions: [],
            member_stats: []
        };

        // Calculate aggregate statistics
        for (const member of familyMembers) {
            // Try different name formats to match tournament data
            const possibleNames = [
                member.name,
                member.name.replace(' Jr.', ''),
                member.name.replace(' Sr.', ''),
                member.id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
            ];

            let playerStats = null;
            for (const name of possibleNames) {
                playerStats = this.tournamentEngine.getPlayerStats(name);
                if (playerStats) break;
            }

            if (playerStats) {
                stats.total_tournaments += playerStats.tournaments_played;
                stats.tournament_wins += playerStats.tournament_wins;
                stats.total_tricks += playerStats.total_tricks;
                stats.total_rounds += playerStats.total_rounds;
                
                // Add to member stats
                stats.member_stats.push({
                    ...member,
                    tournament_stats: playerStats
                });

                // Track champions
                if (playerStats.tournament_wins > 0) {
                    stats.family_champions.push({
                        name: member.name,
                        nickname: member.nickname,
                        wins: playerStats.tournament_wins,
                        win_percentage: playerStats.win_percentage
                    });
                }
            }
        }

        // Calculate family averages
        stats.average_tricks = stats.total_rounds > 0 ? 
            (stats.total_tricks / stats.total_rounds).toFixed(2) : 0;
        stats.win_percentage = stats.total_tournaments > 0 ? 
            ((stats.tournament_wins / stats.total_tournaments) * 100).toFixed(1) : 0;

        // Sort family champions by wins
        stats.family_champions.sort((a, b) => b.wins - a.wins);

        // Get top 3 performers
        stats.top_performers = stats.member_stats
            .filter(m => m.tournament_stats)
            .sort((a, b) => b.tournament_stats.tournament_wins - a.tournament_stats.tournament_wins)
            .slice(0, 3)
            .map(m => ({
                name: m.name,
                nickname: m.nickname,
                wins: m.tournament_stats.tournament_wins,
                average: m.tournament_stats.average_tricks
            }));

        return stats;
    }

    /**
     * Calculate cross-family rivalry statistics
     */
    calculateRivalryStatistics(family1Id, family2Id) {
        const rivalry = this.rivalries.find(r => 
            r.families.includes(family1Id) && r.families.includes(family2Id)
        );

        if (!rivalry) {
            return null;
        }

        const family1Stats = this.calculateFamilyStatistics(family1Id);
        const family2Stats = this.calculateFamilyStatistics(family2Id);

        return {
            rivalry_info: rivalry,
            family1: {
                id: family1Id,
                stats: family1Stats
            },
            family2: {
                id: family2Id,
                stats: family2Stats
            },
            head_to_head: rivalry.head_to_head || {}
        };
    }

    /**
     * Get family lineage (ancestors and descendants)
     */
    getFamilyLineage(playerId) {
        const player = this.players.get(playerId);
        if (!player) return null;

        const lineage = {
            player: player,
            parents: [],
            children: [],
            siblings: [],
            spouse: null,
            grandparents: [],
            grandchildren: []
        };

        // Get parents
        if (player.parents) {
            lineage.parents = player.parents.map(parentId => this.players.get(parentId)).filter(Boolean);
        }

        // Get children
        if (player.children) {
            lineage.children = player.children.map(childId => this.players.get(childId)).filter(Boolean);
        }

        // Get spouse
        if (player.spouse) {
            lineage.spouse = this.players.get(player.spouse);
        }

        // Get siblings (same parents)
        if (player.parents) {
            for (const [siblingId, sibling] of this.players) {
                if (siblingId !== playerId && 
                    sibling.parents && 
                    player.parents.some(p => sibling.parents.includes(p))) {
                    lineage.siblings.push(sibling);
                }
            }
        }

        // Get grandparents (parents' parents)
        for (const parent of lineage.parents) {
            if (parent.parents) {
                const grandparents = parent.parents.map(gpId => this.players.get(gpId)).filter(Boolean);
                lineage.grandparents.push(...grandparents);
            }
        }

        // Get grandchildren (children's children)
        for (const child of lineage.children) {
            if (child.children) {
                const grandchildren = child.children.map(gcId => this.players.get(gcId)).filter(Boolean);
                lineage.grandchildren.push(...grandchildren);
            }
        }

        return lineage;
    }

    /**
     * Generate family tree visualization data
     */
    generateTreeVisualization(familyId) {
        const family = this.getFamily(familyId);
        const members = this.getFamilyMembers(familyId);
        
        if (!family || !members.length) return null;

        const treeData = {
            family_name: family.family_name,
            family_color: family.family_color,
            generations: {}
        };

        // Group by generation
        for (const member of members) {
            const gen = member.generation;
            if (!treeData.generations[gen]) {
                treeData.generations[gen] = {
                    generation_number: gen,
                    generation_name: family.generations[gen]?.generation_name || `Generation ${gen}`,
                    members: []
                };
            }
            
            treeData.generations[gen].members.push({
                ...member,
                tournament_stats: this.tournamentEngine ? 
                    this.tournamentEngine.getPlayerStats(member.name) : null
            });
        }

        return treeData;
    }

    /**
     * Get all family rivalries
     */
    getAllRivalries() {
        return this.rivalries.map(rivalry => ({
            ...rivalry,
            family1_stats: this.calculateFamilyStatistics(rivalry.families[0]),
            family2_stats: this.calculateFamilyStatistics(rivalry.families[1])
        }));
    }

    /**
     * Search players by name or family
     */
    searchPlayers(query) {
        const results = [];
        const searchTerm = query.toLowerCase();
        
        for (const [playerId, player] of this.players) {
            if (player.name.toLowerCase().includes(searchTerm) ||
                player.nickname.toLowerCase().includes(searchTerm) ||
                player.family_name.toLowerCase().includes(searchTerm)) {
                
                results.push({
                    ...player,
                    tournament_stats: this.tournamentEngine ? 
                        this.tournamentEngine.getPlayerStats(player.name) : null
                });
            }
        }
        
        return results;
    }

    /**
     * Export family tree data
     */
    exportFamilyData() {
        return {
            families: Object.fromEntries(this.families),
            players: Object.fromEntries(this.players),
            rivalries: this.rivalries,
            alliances: this.alliances,
            cross_family_marriages: this.crossFamilyMarriages,
            generated_at: new Date().toISOString()
        };
    }
}

// Export for use in other scripts
window.FamilyTree = FamilyTree;