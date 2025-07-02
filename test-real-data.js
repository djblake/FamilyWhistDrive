// Test the updated tournament engine with real Google Sheets data
const fetch = require('node-fetch');
global.fetch = fetch;
global.window = {};

// Load the tournament engine
const fs = require('fs');
const tournamentEngineCode = fs.readFileSync('assets/js/tournament-engine.js', 'utf8');
eval(tournamentEngineCode);

async function testRealData() {
    console.log('🧪 Testing real Google Sheets data loading...\n');
    
    const engine = new window.TournamentEngine();
    const sheetId = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
    
    try {
        console.log('📊 Loading data from Google Sheets...');
        const count = await engine.loadFromGoogleSheets(sheetId);
        
        console.log(`\n✅ Successfully loaded ${count} scorecards!`);
        
        // Check data issues
        const issuesData = engine.getDataIssues();
        console.log(`\n📊 Data validation results:`);
        if (issuesData.total === 0) {
            console.log('✅ No data validation issues found');
        } else {
            console.log(`⚠️  Found ${issuesData.total} data issue(s):`);
            Object.entries(issuesData.summary).forEach(([type, count]) => {
                console.log(`  - ${type.replace('_', ' ').toUpperCase()}: ${count}`);
            });
            
            // Show first few issues
            console.log('\nFirst few issues:');
            issuesData.issues.slice(0, 3).forEach((issue, i) => {
                let location = '';
                if (issue.row && issue.sheet) {
                    location = ` [${issue.sheet} Row ${issue.row}]`;
                } else if (issue.gameId) {
                    location = ` [Game ID: ${issue.gameId}]`;
                }
                console.log(`  ${i + 1}. ${issue.message}${location}`);
            });
        }
        
        // Check for shared hands
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
        
        console.log(`\n🤝 Shared hands found: ${sharedHands.length}`);
        if (sharedHands.length > 0) {
            console.log('Examples:');
            sharedHands.slice(0, 5).forEach((sh, i) => {
                console.log(`  ${i + 1}. ${sh.tournament} Round ${sh.round}: ${sh.field} = "${sh.names.join(` ${sh.delimiter} `)}"`);
            });
        }
        
        // Display tournament summary
        console.log(`\n🏆 Tournament data processed:`);
        const tournaments = Array.from(engine.tournaments.values());
        tournaments.forEach(tournament => {
            console.log(`  - ${tournament.name} ${tournament.year}: ${tournament.total_players} players, ${tournament.total_rounds} rounds`);
            if (tournament.winner) {
                console.log(`    Winner: ${tournament.winner}, Runner-up: ${tournament.runner_up || 'N/A'}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    }
}

testRealData();