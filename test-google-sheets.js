// Test script to validate Google Sheets data loading
// This simulates the browser environment for testing

// Mock fetch for Node.js environment
const fetch = require('node-fetch');
global.fetch = fetch;

// Mock window object for Node.js
global.window = {};

// Load the tournament engine
const fs = require('fs');
const path = require('path');

// Read the tournament engine file
const tournamentEngineCode = fs.readFileSync(path.join(__dirname, 'assets/js/tournament-engine.js'), 'utf8');

// Create a simple evaluation context
eval(tournamentEngineCode);

async function testGoogleSheetsLoading() {
    console.log('🧪 Testing Google Sheets data loading...\n');
    
    const engine = new window.TournamentEngine();
    const sheetId = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
    
    try {
        console.log('📊 Attempting to load data from Google Sheets...');
        const count = await engine.loadFromGoogleSheets(sheetId);
        
        console.log(`✅ Successfully loaded ${count} scorecards!`);
        
        // Display players data
        console.log('\n👥 Players loaded:');
        const players = Array.from(engine.playersLookup.values());
        console.log(`Total players: ${players.length}`);
        players.slice(0, 5).forEach(player => {
            console.log(`  - ${player.fullName} (ID: ${player.id})`);
        });
        
        // Check for shared hands
        console.log('\n🤝 Checking for shared hands...');
        const sharedHands = [];
        for (const scorecard of engine.rawScorecards) {
            const fields = ['Player1Names', 'Player2Names', 'Opponent1Names', 'Opponent2Names'];
            for (const field of fields) {
                if (scorecard[field] && scorecard[field].isShared) {
                    sharedHands.push({
                        field: field.replace('Names', ''),
                        names: scorecard[field].names,
                        delimiter: scorecard[field].delimiter,
                        tournament: scorecard.Tournament,
                        round: scorecard.Round
                    });
                }
            }
        }
        
        if (sharedHands.length > 0) {
            console.log(`Found ${sharedHands.length} shared hands:`);
            sharedHands.slice(0, 3).forEach(sh => {
                console.log(`  - ${sh.tournament} Round ${sh.round}: ${sh.field} = "${sh.names.join(` ${sh.delimiter} `)}"`);
            });
        } else {
            console.log('No shared hands detected');
        }
        
        // Display tournament summary
        console.log('\n🏆 Tournament summary:');
        const tournaments = Array.from(engine.tournaments.values());
        tournaments.forEach(tournament => {
            console.log(`  - ${tournament.name} ${tournament.year}: ${tournament.total_players} players, ${tournament.total_rounds} rounds`);
            console.log(`    Winner: ${tournament.winner}, Runner-up: ${tournament.runner_up}`);
        });
        
    } catch (error) {
        console.error('❌ Error loading data:', error.message);
        
        // If it's a validation error, show the details
        if (error.message.includes('Tricks don\'t add to 13')) {
            console.log('\n🔍 This appears to be a data validation error.');
            console.log('Please check your Google Sheets data to ensure:');
            console.log('1. Tricks_Won + Opponent_Tricks = 13 for every row');
            console.log('2. All required fields are filled in');
            console.log('3. Player IDs exist in the Players sheet');
        }
    }
}

// Install node-fetch if not available
try {
    require('node-fetch');
    testGoogleSheetsLoading();
} catch (e) {
    console.log('📦 Installing node-fetch...');
    require('child_process').execSync('npm install node-fetch@2', { stdio: 'inherit' });
    console.log('✅ node-fetch installed, running test...\n');
    testGoogleSheetsLoading();
}