/**
 * Sample Data Generator
 * Generates realistic tournament data for testing
 */

class SampleDataGenerator {
    constructor() {
        // Sample family names for the tournament
        this.familyNames = [
            'James Ruston', 'Margaret Wilson', 'David Smith', 'Emma Jones',
            'Sarah Brown', 'Tom Wilson', 'Mary Ruston', 'John Smith',
            'Peter Jones', 'Lisa Wilson', 'Anne Brown', 'Robert Davis',
            'Michael Thompson', 'Jane Wilson', 'Charles Brown', 'Helen Smith',
            'William Davis', 'Susan Johnson', 'Thomas Wilson', 'Patricia Brown'
        ];
        
        // Player skill levels (affects average trick counts)
        this.playerSkills = new Map([
            ['James Ruston', 7.2],      // Very strong
            ['Margaret Wilson', 7.0],   // Strong
            ['Michael Thompson', 6.9],  // Strong
            ['David Smith', 6.8],       // Good
            ['Sarah Brown', 6.7],       // Good
            ['Tom Wilson', 6.6],        // Average+
            ['Emma Jones', 6.5],        // Average
            ['Mary Ruston', 6.5],       // Average
            ['John Smith', 6.4],        // Average
            ['Peter Jones', 6.3],       // Below average
            ['Lisa Wilson', 6.2],       // Below average
            ['Anne Brown', 6.2],        // Below average
            ['Robert Davis', 6.1],      // Weak
            ['Jane Wilson', 6.0],       // Weak
            ['Charles Brown', 5.9],     // Weak
            ['Helen Smith', 5.8],       // Very weak
            ['William Davis', 5.7],     // Very weak
            ['Susan Johnson', 5.6],     // Very weak
            ['Thomas Wilson', 5.5],     // Very weak
            ['Patricia Brown', 5.4]     // Very weak
        ]);
        
        this.trumpSuits = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
    }

    /**
     * Generate a complete tournament with realistic data
     */
    generateTournament(tournamentName, year, rounds = 8) {
        const csvData = [];
        const header = 'Tournament,Year,Round,Trump_Suit,Table,Player1,Player2,Tricks_Won,Opponent1,Opponent2,Opponent_Tricks';
        csvData.push(header);
        
        // Generate partnerships for each round
        for (let round = 1; round <= rounds; round++) {
            const trumpSuit = this.trumpSuits[(round - 1) % 4];
            const roundData = this.generateRound(tournamentName, year, round, trumpSuit);
            csvData.push(...roundData);
        }
        
        return csvData.join('\n');
    }

    /**
     * Generate partnerships and scores for a single round
     */
    generateRound(tournamentName, year, round, trumpSuit) {
        const roundData = [];
        const players = [...this.familyNames];
        
        // Shuffle players for this round (simplified partnership rotation)
        this.shuffleArray(players);
        
        // Create 5 tables with 4 players each
        for (let table = 0; table < 5; table++) {
            const tableNum = table + 1; // Table numbers start from 1
            const tableStart = table * 4;
            const tablePlayers = players.slice(tableStart, tableStart + 4);
            
            // Create partnerships: [0,1] vs [2,3]
            const partnership1 = [tablePlayers[0], tablePlayers[1]];
            const partnership2 = [tablePlayers[2], tablePlayers[3]];
            
            // Generate realistic scores based on player skills
            const scores = this.generatePartnershipScores(partnership1, partnership2, trumpSuit);
            
            // Create scorecard entries for both partnerships
            roundData.push(
                `${tournamentName},${year},${round},${trumpSuit},${tableNum},${partnership1[0]},${partnership1[1]},${scores.partnership1},${partnership2[0]},${partnership2[1]},${scores.partnership2}`
            );
            
            roundData.push(
                `${tournamentName},${year},${round},${trumpSuit},${tableNum},${partnership2[0]},${partnership2[1]},${scores.partnership2},${partnership1[0]},${partnership1[1]},${scores.partnership1}`
            );
        }
        
        return roundData;
    }

    /**
     * Generate realistic scores for two partnerships
     */
    generatePartnershipScores(partnership1, partnership2, trumpSuit) {
        // Calculate average skill levels for each partnership
        const skill1 = (this.playerSkills.get(partnership1[0]) + this.playerSkills.get(partnership1[1])) / 2;
        const skill2 = (this.playerSkills.get(partnership2[0]) + this.playerSkills.get(partnership2[1])) / 2;
        
        // Add some trump suit effects (very subtle)
        const trumpBonus1 = this.getTrumpBonus(partnership1, trumpSuit);
        const trumpBonus2 = this.getTrumpBonus(partnership2, trumpSuit);
        
        const adjustedSkill1 = skill1 + trumpBonus1;
        const adjustedSkill2 = skill2 + trumpBonus2;
        
        // Generate scores with some randomness
        const skillDiff = adjustedSkill1 - adjustedSkill2;
        const baseScore1 = 6.5 + (skillDiff * 0.5);
        
        // Add random variance
        const variance = (Math.random() - 0.5) * 2; // -1 to +1
        const score1 = Math.max(0, Math.min(13, Math.round(baseScore1 + variance)));
        const score2 = 13 - score1;
        
        return {
            partnership1: score1,
            partnership2: score2
        };
    }

    /**
     * Get small trump suit bonus for certain players
     */
    getTrumpBonus(partnership, trumpSuit) {
        // Some players perform slightly better with certain trump suits
        const bonuses = {
            'Hearts': ['James Ruston', 'Margaret Wilson'],
            'Diamonds': ['Michael Thompson', 'David Smith'],
            'Spades': ['Sarah Brown', 'Tom Wilson'],
            'Clubs': ['Emma Jones', 'Mary Ruston']
        };
        
        const bonusPlayers = bonuses[trumpSuit] || [];
        let bonus = 0;
        
        for (const player of partnership) {
            if (bonusPlayers.includes(player)) {
                bonus += 0.1; // Very small bonus
            }
        }
        
        return bonus;
    }

    /**
     * Shuffle array in place (Fisher-Yates algorithm)
     */
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    /**
     * Generate multiple years of tournament data
     */
    generateMultipleYears(startYear, endYear) {
        const tournaments = [];
        
        for (let year = startYear; year <= endYear; year++) {
            const tournamentName = this.generateTournamentName(year);
            const rounds = 8; // Simplified for demo
            const csvData = this.generateTournament(tournamentName, year, rounds);
            
            tournaments.push({
                year: year,
                name: tournamentName,
                csvData: csvData
            });
        }
        
        return tournaments;
    }

    /**
     * Generate tournament names based on year
     */
    generateTournamentName(year) {
        const names = [
            'Christmas Championship',
            'Holiday Classic',
            'Family Tournament',
            'Annual Whist Drive',
            'Boxing Day Battle',
            'New Year Classic'
        ];
        
        // Special names for milestone years
        if (year === 2024) return 'Ruby Anniversary Championship';
        if (year === 2020) return 'COVID Comeback Classic';
        if (year === 2000) return 'Millennium Championship';
        if (year === 1984) return 'Inaugural Tournament';
        
        return names[year % names.length];
    }

    /**
     * Generate player profiles with realistic data
     */
    generatePlayerProfiles() {
        const profiles = [];
        const birthYears = {
            'James Ruston': 1965,
            'Margaret Wilson': 1968,
            'David Smith': 1972,
            'Emma Jones': 2001,
            'Sarah Brown': 1978,
            'Tom Wilson': 1945,
            'Mary Ruston': 1970,
            'John Smith': 1983,
            'Peter Jones': 1955,
            'Lisa Wilson': 1992,
            'Anne Brown': 1960,
            'Robert Davis': 1975,
            'Michael Thompson': 1950,
            'Jane Wilson': 1988,
            'Charles Brown': 1963,
            'Helen Smith': 1957,
            'William Davis': 1981,
            'Susan Johnson': 1995,
            'Thomas Wilson': 1942,
            'Patricia Brown': 1985
        };
        
        const nicknames = {
            'James Ruston': 'The Master',
            'Margaret Wilson': 'The Ace',
            'Michael Thompson': 'The Professor',
            'David Smith': 'Steady Eddie',
            'Emma Jones': 'The Prodigy',
            'Tom Wilson': 'The Veteran',
            'Sarah Brown': 'Lucky Sarah',
            'Mary Ruston': 'The Rock'
        };
        
        for (const [name, skill] of this.playerSkills) {
            const birthYear = birthYears[name] || 1960;
            const currentAge = 2024 - birthYear;
            
            profiles.push({
                id: name.toLowerCase().replace(/\s+/g, '_'),
                name: name,
                nickname: nicknames[name] || '',
                birth_date: `${birthYear}-${Math.floor(Math.random() * 12) + 1}-${Math.floor(Math.random() * 28) + 1}`,
                current_age: currentAge,
                skill_level: skill,
                profile_image: `${name.toLowerCase().replace(/\s+/g, '_')}.jpg`
            });
        }
        
        return profiles;
    }

    /**
     * Generate photo gallery structure
     */
    generatePhotoGallery(year) {
        const photos = [
            'tournament_start.jpg',
            'round_4_action.jpg',
            'mid_tournament_break.jpg',
            'intense_final_rounds.jpg',
            'victory_celebration.jpg',
            'group_photo.jpg',
            'trophy_presentation.jpg',
            'family_gathering.jpg'
        ];
        
        return photos.map(photo => ({
            filename: photo,
            path: `/tournaments/${year}/photos/${photo}`,
            caption: this.generatePhotoCaption(photo, year),
            date: `${year}-12-25`
        }));
    }

    /**
     * Generate photo captions
     */
    generatePhotoCaption(filename, year) {
        const captions = {
            'tournament_start.jpg': `${year} Tournament begins with great fanfare`,
            'round_4_action.jpg': `Intense competition during the crucial Round 4`,
            'mid_tournament_break.jpg': `Strategic discussions during the traditional break`,
            'intense_final_rounds.jpg': `The tension builds as the final rounds approach`,
            'victory_celebration.jpg': `Champion celebrates another year of dominance`,
            'group_photo.jpg': `The complete ${year} tournament participants`,
            'trophy_presentation.jpg': `The prestigious trophy changes hands once again`,
            'family_gathering.jpg': `Four generations united by competitive spirit`
        };
        
        return captions[filename] || `Tournament moment from ${year}`;
    }
}

// Export for use in other scripts
window.SampleDataGenerator = SampleDataGenerator;