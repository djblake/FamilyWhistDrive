/**
 * Test script to verify WhistGame_1985 data loading
 */

// Load the tournament engine
if (typeof TournamentEngine === 'undefined') {
    // Import for Node.js environment
    const fs = require('fs');
    const path = require('path');
    
    // Simple eval to load the class (for testing only)
    const engineCode = fs.readFileSync(path.join(__dirname, 'assets/js/tournament-engine.js'), 'utf8');
    eval(engineCode);
}

async function testWhistGame1985() {
    console.log('🧪 Testing WhistGame_1985 data loading...\n');
    
    try {
        // Initialize tournament engine
        const engine = new TournamentEngine();
        const sheetId = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
        
        console.log('📊 Loading tournament data from Google Sheets...');
        
        // Test the sheet detection
        const sheets = await engine.getSheetsList(sheetId);
        console.log(`📋 Found ${sheets.length} sheets:`);
        
        let whistGame1985Found = false;
        for (const sheet of sheets) {
            console.log(`  - ${sheet.name} (gid: ${sheet.gid})`);
            if (sheet.name === 'WhistGame_1985') {
                whistGame1985Found = true;
                console.log('    ✅ WhistGame_1985 detected!');
                
                // Test sheet type detection
                const sheetType = await engine.detectSheetType(sheetId, sheet);
                console.log(`    🔍 Sheet type detected as: ${sheetType}`);
                
                if (sheetType === 'tournament') {
                    console.log('    🏆 Correctly identified as tournament sheet!');
                } else {
                    console.log('    ⚠️  Not identified as tournament sheet');
                }
            }
        }
        
        if (!whistGame1985Found) {
            console.log('❌ WhistGame_1985 sheet not found in sheet list');
            console.log('   This could mean:');
            console.log('   1. The sheet doesn\'t exist yet');
            console.log('   2. The sheet name is different');
            console.log('   3. There\'s an access issue');
        }
        
        console.log('\n🔄 Attempting full data load...');
        
        // Attempt to load all tournament data
        const totalScorecards = await engine.loadFromGoogleSheets(sheetId);
        console.log(`✅ Successfully loaded ${totalScorecards} total scorecards`);
        
        // Check if 1985 tournament was loaded
        const tournaments = engine.getAllTournaments();
        let tournament1985 = null;
        
        for (const tournament of tournaments) {
            console.log(`📈 Tournament loaded: ${tournament.name} (${tournament.year})`);
            if (tournament.year === 1985) {
                tournament1985 = tournament;
                console.log('    🎯 Found 1985 tournament data!');
            }
        }
        
        if (tournament1985) {
            console.log('\n📊 WhistGame_1985 Statistics:');
            console.log(`  - Tournament: ${tournament1985.name}`);
            console.log(`  - Year: ${tournament1985.year}`);
            console.log(`  - Players: ${tournament1985.total_players}`);
            console.log(`  - Rounds: ${tournament1985.total_rounds}`);
            console.log(`  - Winner: ${tournament1985.winner}`);
            console.log(`  - Total Tricks Played: ${tournament1985.final_standings.reduce((sum, p) => sum + p.total_tricks, 0)}`);
            
            console.log('\n🏆 Final Standings (Top 5):');
            tournament1985.final_standings.slice(0, 5).forEach((player, index) => {
                console.log(`  ${index + 1}. ${player.player}: ${player.total_tricks} tricks (avg: ${(player.total_tricks / tournament1985.total_rounds).toFixed(1)})`);
            });
        } else {
            console.log('\n❌ WhistGame_1985 tournament data not found in loaded tournaments');
        }
        
        console.log('\n✅ Test completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
if (typeof window === 'undefined') {
    // Node.js environment
    testWhistGame1985().catch(console.error);
} else {
    // Browser environment
    window.testWhistGame1985 = testWhistGame1985;
    console.log('🧪 Test function loaded. Run testWhistGame1985() to execute.');
}