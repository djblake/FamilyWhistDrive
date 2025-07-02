// Simple test to check Google Sheets data access
const fetch = require('node-fetch');

async function testSheetsAccess() {
    const sheetId = '1HGfdlDOfGHOL6Q4MP_TnF8UNE6YihBW-5gQs6Ykl78k';
    
    console.log('🧪 Testing Google Sheets access...\n');
    
    try {
        // Test Players sheet (GID 0)
        console.log('📋 Testing Players sheet...');
        const playersUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
        const playersResponse = await fetch(playersUrl);
        
        if (!playersResponse.ok) {
            throw new Error(`Players sheet failed: ${playersResponse.statusText}`);
        }
        
        const playersData = await playersResponse.text();
        const playersLines = playersData.trim().split('\n');
        console.log(`✅ Players sheet loaded: ${playersLines.length - 1} rows`);
        console.log(`Headers: ${playersLines[0]}`);
        console.log(`Sample data: ${playersLines.slice(1, 3).join(', ')}`);
        
        // Test tournament sheets (try a few GIDs)
        console.log('\n🏆 Testing tournament sheets...');
        for (let gid = 1; gid <= 5; gid++) {
            try {
                const tournamentUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                const tournamentResponse = await fetch(tournamentUrl);
                
                if (tournamentResponse.ok) {
                    const tournamentData = await tournamentResponse.text();
                    const tournamentLines = tournamentData.trim().split('\n');
                    
                    if (tournamentLines.length > 1) {
                        console.log(`✅ GID ${gid}: ${tournamentLines.length - 1} rows`);
                        console.log(`   Headers: ${tournamentLines[0]}`);
                        
                        // Check for WhistGame pattern or tournament data
                        const headers = tournamentLines[0].toLowerCase();
                        if (headers.includes('tournament') || headers.includes('round') || headers.includes('trump')) {
                            console.log(`   📊 Appears to be tournament data`);
                            
                            // Check a few rows for data validation
                            for (let i = 1; i <= Math.min(3, tournamentLines.length - 1); i++) {
                                const values = tournamentLines[i].split(',');
                                const tricksWon = parseInt(values[8]); // Assuming Tricks_Won is column 8
                                const opponentTricks = parseInt(values[10]); // Assuming Opponent_Tricks is column 10
                                
                                if (!isNaN(tricksWon) && !isNaN(opponentTricks)) {
                                    const total = tricksWon + opponentTricks;
                                    if (total !== 13) {
                                        console.log(`   ⚠️  Row ${i}: Tricks don't add to 13 (${tricksWon} + ${opponentTricks} = ${total})`);
                                    } else {
                                        console.log(`   ✅ Row ${i}: Valid tricks (${tricksWon} + ${opponentTricks} = 13)`);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip failed GIDs
            }
        }
        
        console.log('\n🎯 Testing player ID parsing...');
        // Look for shared hands in the data
        for (let gid = 1; gid <= 3; gid++) {
            try {
                const tournamentUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
                const tournamentResponse = await fetch(tournamentUrl);
                
                if (tournamentResponse.ok) {
                    const tournamentData = await tournamentResponse.text();
                    const tournamentLines = tournamentData.trim().split('\n');
                    
                    for (let i = 1; i <= Math.min(5, tournamentLines.length - 1); i++) {
                        const values = tournamentLines[i].split(',');
                        
                        // Check player fields for shared hands
                        for (let j = 6; j <= 9; j++) { // Player1, Player2, Opponent1, Opponent2
                            const playerField = values[j];
                            if (playerField && (playerField.includes('+') || playerField.includes('/') || playerField.includes('&'))) {
                                console.log(`   🤝 Shared hand found in GID ${gid}, Row ${i}: "${playerField}"`);
                            }
                        }
                    }
                }
            } catch (e) {
                // Skip failed GIDs
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testSheetsAccess();